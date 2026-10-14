const db = require('../../model/db');
const candidateModel = require('../../model/candidate.model.js');
const companyLinkModel = require('../../model/companyLink.model.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');
const { linkCandidateByCode } = require('../services/companyLinkService');

// Id del perfil de candidato del usuario autenticado (lo usan también los
// controladores de hojas de vida y postulaciones).
async function getProfileIdForUser(userId) {
  const id = await candidateModel.findProfileIdByUserId(userId);
  if (!id) throw new AppError('Perfil de candidato no encontrado.', 404);
  return id;
}

async function loadFullProfile(candidateId) {
  const profile = await candidateModel.findFullProfile(candidateId);
  if (!profile) throw new AppError('Perfil de candidato no encontrado.', 404);
  return profile;
}

// ---- RF06: perfil propio del candidato ----

const getMyProfile = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  view.ok(res, await loadFullProfile(candidateId));
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  await candidateModel.updateProfile(candidateId, req.body);

  await logActivity({ userId: req.user.id, action: 'update_candidate_profile' });
  view.ok(res, await loadFullProfile(candidateId));
});

// Agregar / quitar elementos de una sección del perfil (formación,
// experiencia, habilidades, idiomas, certificaciones).
function makeSectionHandlers(section) {
  return {
    add: asyncHandler(async (req, res) => {
      const candidateId = await getProfileIdForUser(req.user.id);
      view.created(res, await candidateModel.addSectionItem(section, candidateId, req.body));
    }),
    remove: asyncHandler(async (req, res) => {
      const candidateId = await getProfileIdForUser(req.user.id);
      const removed = await candidateModel.removeSectionItem(section, req.params.itemId, candidateId);
      if (!removed) throw new AppError('Registro no encontrado.', 404);
      view.done(res);
    }),
  };
}

const educationHandlers = makeSectionHandlers('education');
const experienceHandlers = makeSectionHandlers('experience');
const skillHandlers = makeSectionHandlers('skills');
const languageHandlers = makeSectionHandlers('languages');
const certificationHandlers = makeSectionHandlers('certifications');

// ---- Vista de la empresa sobre un candidato (Sección 8: gestión de candidatos) ----
// Solo permitido si el candidato tiene al menos una postulación a una vacante
// de la empresa del usuario autenticado (aislamiento de información, RNF-S4).
const getCandidateForCompany = asyncHandler(async (req, res) => {
  const applied = await candidateModel.hasAppliedToCompany(req.params.id, req.user.companyId);
  if (!applied) throw new AppError('Candidato no encontrado.', 404);

  view.ok(res, await loadFullProfile(req.params.id));
});

// ---- Vinculación privada por código (modelo de entornos por empresa) ----

// Lista las empresas a las que el candidato ya está vinculado — es la base
// del selector de "entorno" que ve al iniciar sesión. Nunca se expone una
// lista de empresas que el candidato NO haya vinculado explícitamente.
const listMyLinkedCompanies = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  view.ok(res, await companyLinkModel.listCompaniesForCandidate(candidateId));
});

// Vincula al candidato ya autenticado a una empresa adicional usando su
// código de acceso (Sección "vinculación mediante código único").
const linkCompany = asyncHandler(async (req, res) => {
  const candidateId = await getProfileIdForUser(req.user.id);
  const company = await linkCandidateByCode(db, candidateId, req.body.code);

  await logActivity({ userId: req.user.id, action: 'link_company', entityType: 'company', entityId: company.id });
  view.created(res, company);
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  educationHandlers,
  experienceHandlers,
  skillHandlers,
  languageHandlers,
  certificationHandlers,
  getCandidateForCompany,
  loadFullProfile,
  getProfileIdForUser,
  listMyLinkedCompanies,
  linkCompany,
};
