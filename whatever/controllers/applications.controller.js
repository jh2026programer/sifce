const db = require('../../model/db');
const applicationModel = require('../../model/application.model.js');
const aiResultModel = require('../../model/aiResult.model.js');
const vacancyModel = require('../../model/vacancy.model.js');
const resumeModel = require('../../model/resume.model.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { requireCompanyId, assertBelongsToCompany } = require('../utils/scope');
const compatibilityService = require('../services/compatibilityService');
const { getProfileIdForUser } = require('./candidates.controller.js');
const { logActivity } = require('../services/activityLogService');

async function getVacancyOrThrow(vacancyId) {
  const vacancy = await vacancyModel.findById(vacancyId);
  if (!vacancy) throw new AppError('Vacante no encontrada.', 404);
  return vacancy;
}

// Postulación de la empresa del usuario autenticado (404 si es de otra).
async function getOwnApplicationOrThrow(id, req) {
  const application = await applicationModel.findByIdWithCompany(id);
  if (!application) throw new AppError('Postulación no encontrada.', 404);
  assertBelongsToCompany(application.company_id, req);
  return application;
}

// RF08 - Postulación a Vacantes (dentro del entorno de empresa activo)
const applyToVacancy = asyncHandler(async (req, res) => {
  const { vacancyId, resumeId } = req.body;
  if (!vacancyId) throw new AppError('Debes indicar la vacante a la que deseas postularte.', 400);

  const vacancy = await getVacancyOrThrow(vacancyId);
  if (vacancy.company_id !== req.activeCompany.id) {
    // No se revela si la vacante existe en otra empresa (aislamiento, RNF-S4).
    throw new AppError('Vacante no encontrada.', 404);
  }
  if (vacancy.status !== 'active') {
    throw new AppError('Esta vacante no está activa y no admite nuevas postulaciones.', 400);
  }

  const candidateId = await getProfileIdForUser(req.user.id);

  const existingApplication = await applicationModel.findByVacancyAndCandidate(vacancyId, candidateId);
  // Solo se bloquea si ya existe una postulación ACTIVA. Si la única
  // postulación previa fue retirada por el propio candidato, se le permite
  // postularse de nuevo (se reactiva ese mismo registro en vez de crear uno
  // duplicado, ya que vacancy_id+candidate_id es único en la base).
  if (existingApplication && existingApplication.status !== 'retirado') {
    throw new AppError('Ya te has postulado a esta vacante.', 409);
  }

  const resume = resumeId
    ? await resumeModel.findOwned(resumeId, candidateId)
    : await resumeModel.findLatestForCandidate(candidateId);
  if (!resume) throw new AppError('Debes cargar tu hoja de vida antes de postularte.', 400);

  const application = await db.withTransaction(async (client) => {
    if (existingApplication) {
      // Reactivar la postulación retirada anteriormente.
      const reactivated = await applicationModel.reactivate(client, existingApplication.id, resume.id);
      await applicationModel.addStageHistory(client, {
        applicationId: reactivated.id, fromStatus: 'retirado', toStatus: 'postulado', changedBy: req.user.id,
      });
      // El análisis anterior ya no aplica (pudo cambiar el CV o el tiempo
      // transcurrido) — se reinicia para que se vuelva a calcular.
      await aiResultModel.resetToPending(client, reactivated.id);
      return reactivated;
    }

    const created = await applicationModel.create(client, { vacancyId, candidateId, resumeId: resume.id });
    await applicationModel.addStageHistory(client, {
      applicationId: created.id, fromStatus: null, toStatus: 'postulado', changedBy: req.user.id,
    });
    await aiResultModel.createPending(client, created.id);
    return created;
  });

  await logActivity({ userId: req.user.id, action: 'apply_to_vacancy', entityType: 'application', entityId: application.id });

  // RF09 - se dispara el análisis de IA en segundo plano (RNF-R1: no bloquea
  // la respuesta de la postulación; RNF-R3: el frontend consulta el estado
  // "processing" mientras tanto).
  compatibilityService.runAnalysis({ applicationId: application.id }).catch(() => {});

  view.created(res, application);
});

// RF17 - Consulta de Estado de Postulación (candidato, dentro del entorno activo)
const listMyApplications = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  view.ok(res, await applicationModel.listForCandidateInCompany(candidateId, req.activeCompany.id));
});

// RF10 - listar postulaciones de una vacante con su compatibilidad (base del ranking)
const listApplicationsForVacancy = asyncHandler(async (req, res) => {
  const vacancy = await getVacancyOrThrow(req.params.vacancyId);
  assertBelongsToCompany(vacancy.company_id, req);
  view.ok(res, await applicationModel.listForVacancy(req.params.vacancyId));
});

// RF10 - Generación de Ranking de Candidatos (ordenado por compatibilidad)
const getRankingForVacancy = asyncHandler(async (req, res) => {
  const vacancy = await getVacancyOrThrow(req.params.vacancyId);
  assertBelongsToCompany(vacancy.company_id, req);
  view.ok(res, await applicationModel.rankingForVacancy(req.params.vacancyId));
});

// RF09 / RF11 - detalle de una postulación con explicación del resultado de IA
const getApplicationDetail = asyncHandler(async (req, res) => {
  const application = await applicationModel.findDetail(req.params.id);
  if (!application) throw new AppError('Postulación no encontrada.', 404);

  if (['company_admin', 'recruiter'].includes(req.user.role)) {
    assertBelongsToCompany(application.company_id, req);
  } else if (req.user.role === 'candidate') {
    const candidateId = await getProfileIdForUser(req.user.id);
    if (application.candidate_id !== candidateId) throw new AppError('Postulación no encontrada.', 404);
  }

  const [aiAnalysis, stageHistory] = await Promise.all([
    aiResultModel.findByApplicationId(req.params.id),
    applicationModel.findStageHistory(req.params.id),
  ]);

  view.ok(res, { ...application, aiAnalysis, stageHistory });
});

// RF13 - Gestión del Proceso de Selección (cambio de etapa)
const updateApplicationStage = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!applicationModel.COMPANY_STATUSES.includes(status)) throw new AppError('Estado inválido.', 400);

  const application = await getOwnApplicationOrThrow(req.params.id, req);

  await db.withTransaction(async (client) => {
    await applicationModel.setStatus(client, req.params.id, status);
    await applicationModel.addStageHistory(client, {
      applicationId: req.params.id, fromStatus: application.status, toStatus: status, changedBy: req.user.id,
    });
  });

  await logActivity({
    userId: req.user.id, companyId: req.user.companyId, action: 'update_application_stage',
    entityType: 'application', entityId: req.params.id, metadata: { from: application.status, to: status },
  });

  view.ok(res, { id: req.params.id, status });
});

// RF12 - Comparación de Candidatos
const compareApplications = asyncHandler(async (req, res) => {
  const { applicationIds } = req.body;
  if (!Array.isArray(applicationIds) || applicationIds.length < 2) {
    throw new AppError('Debes seleccionar al menos dos postulaciones para comparar.', 400);
  }

  const rows = await applicationModel.findForComparison(applicationIds);
  if (rows.length !== applicationIds.length) throw new AppError('Una o más postulaciones no existen.', 404);

  const companyId = requireCompanyId(req);
  const sameCompany = rows.every((r) => r.company_id === companyId);
  if (!sameCompany) throw new AppError('Solo puedes comparar postulaciones de tu propia empresa.', 403);

  const sameVacancy = rows.every((r) => r.vacancy_id === rows[0].vacancy_id);
  if (!sameVacancy) throw new AppError('Solo puedes comparar postulaciones de una misma vacante.', 400);

  view.ok(res, rows);
});

// Reintentar el análisis de IA cuando falló (RNF-F4)
const retryAnalysis = asyncHandler(async (req, res) => {
  await getOwnApplicationOrThrow(req.params.id, req);

  compatibilityService.runAnalysis({ applicationId: req.params.id }).catch(() => {});
  view.message(res, 'Se reinició el análisis de compatibilidad.');
});

// RF13 (extendido) - el candidato retira su propia postulación. Es un
// estado distinto de "rechazado" (esa decisión es de la empresa); "retirado"
// lo decide el candidato y queda registrado igual en el historial.
const withdrawApplication = asyncHandler(async (req, res) => {
  const application = await applicationModel.findById(req.params.id);
  if (!application) throw new AppError('Postulación no encontrada.', 404);

  const candidateId = await getProfileIdForUser(req.user.id);
  if (application.candidate_id !== candidateId) throw new AppError('Postulación no encontrada.', 404);

  if (application.status === 'retirado') {
    throw new AppError('Ya habías retirado esta postulación.', 409);
  }
  if (application.status === 'seleccionado') {
    throw new AppError('Ya fuiste seleccionado en este proceso; contacta directamente a la empresa si deseas declinar.', 400);
  }

  await db.withTransaction(async (client) => {
    await applicationModel.setStatus(client, req.params.id, 'retirado');
    await applicationModel.addStageHistory(client, {
      applicationId: req.params.id, fromStatus: application.status, toStatus: 'retirado', changedBy: req.user.id,
    });
  });

  await logActivity({ userId: req.user.id, action: 'withdraw_application', entityType: 'application', entityId: req.params.id });
  view.ok(res, { id: req.params.id, status: 'retirado' });
});

module.exports = {
  applyToVacancy,
  listMyApplications,
  listApplicationsForVacancy,
  getRankingForVacancy,
  getApplicationDetail,
  updateApplicationStage,
  compareApplications,
  retryAnalysis,
  withdrawApplication,
};
