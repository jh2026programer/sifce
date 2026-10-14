const vacancyModel = require('../../model/vacancy.model.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { requireCompanyId, assertBelongsToCompany } = require('../utils/scope');
const { logActivity } = require('../services/activityLogService');

async function findOwnVacancyOrThrow(id, req) {
  const vacancy = await vacancyModel.findById(id);
  if (!vacancy) throw new AppError('Vacante no encontrada.', 404);
  assertBelongsToCompany(vacancy.company_id, req);
  return vacancy;
}

// RF05 - Gestión de Vacantes (Administrador de Empresa, Reclutador)
const listMyCompanyVacancies = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  view.ok(res, await vacancyModel.listByCompany(companyId));
});

const getVacancy = asyncHandler(async (req, res) => {
  const vacancy = await vacancyModel.findByIdWithCompanyStatus(req.params.id);
  if (!vacancy) throw new AppError('Vacante no encontrada.', 404);

  // Personal de empresa: debe pertenecer a esa empresa (RNF-S4).
  // Candidato: la vacante debe pertenecer a su entorno de empresa ACTIVO
  // (al que ya está vinculado por código) — ya no existe una vista pública
  // de vacantes de cualquier empresa (modelo privado por empresa).
  if (['company_admin', 'recruiter'].includes(req.user.role)) {
    assertBelongsToCompany(vacancy.company_id, req);
  } else if (req.user.role === 'candidate') {
    const activeCompanyId = req.activeCompany?.id;
    if (!activeCompanyId || vacancy.company_id !== activeCompanyId || vacancy.status !== 'active' || vacancy.company_status !== 'active') {
      throw new AppError('Vacante no encontrada.', 404);
    }
  }

  view.ok(res, vacancy);
});

const createVacancy = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  if (!req.body.title) throw new AppError('El título de la vacante es obligatorio.', 400);

  const vacancy = await vacancyModel.create(companyId, req.user.id, req.body);

  await logActivity({ userId: req.user.id, companyId, action: 'create_vacancy', entityType: 'vacancy', entityId: vacancy.id });
  view.created(res, vacancy);
});

const updateVacancy = asyncHandler(async (req, res) => {
  await findOwnVacancyOrThrow(req.params.id, req);
  const vacancy = await vacancyModel.update(req.params.id, req.body);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'update_vacancy', entityType: 'vacancy', entityId: req.params.id });
  view.ok(res, vacancy);
});

// RF05 - activar/cerrar (status: active | closed | draft)
const setVacancyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!vacancyModel.STATUSES.includes(status)) throw new AppError('Estado inválido.', 400);

  await findOwnVacancyOrThrow(req.params.id, req);
  const vacancy = await vacancyModel.setStatus(req.params.id, status);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: `vacancy_${status}`, entityType: 'vacancy', entityId: req.params.id });
  view.ok(res, vacancy);
});

// RF16 (redefinido) - Consulta de Vacantes Disponibles DENTRO del entorno de
// empresa activo del candidato. Ya no es un listado público ni cruzado entre
// empresas: requiere requireActiveCompany (ver routes/vacancies.routes.js).
const browseActiveVacancies = asyncHandler(async (req, res) => {
  const { title, modality } = req.query;
  view.ok(res, await vacancyModel.listActiveForCompany(req.activeCompany.id, { title, modality }));
});

module.exports = {
  listMyCompanyVacancies, getVacancy, createVacancy, updateVacancy, setVacancyStatus, browseActiveVacancies,
};
