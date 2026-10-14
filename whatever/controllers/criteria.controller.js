const criteriaModel = require('../../model/criteria.model.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { requireCompanyId, assertBelongsToCompany } = require('../utils/scope');
const { logActivity } = require('../services/activityLogService');

async function findOwnCriterionOrThrow(id, req) {
  const criterion = await criteriaModel.findById(id);
  if (!criterion) throw new AppError('Criterio no encontrado.', 404);
  assertBelongsToCompany(criterion.company_id, req);
  return criterion;
}

// RF14 - Configuración de Criterios de Evaluación
const listCriteria = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  view.ok(res, await criteriaModel.listByCompany(companyId));
});

const createCriterion = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  const { category, name, weight } = req.body;

  if (!criteriaModel.CATEGORIES.includes(category)) {
    throw new AppError(`La categoría debe ser una de: ${criteriaModel.CATEGORIES.join(', ')}.`, 400);
  }
  if (!name) throw new AppError('El nombre del criterio es obligatorio.', 400);

  const criterion = await criteriaModel.create(companyId, { category, name, weight });

  await logActivity({ userId: req.user.id, companyId, action: 'create_criterion', entityType: 'criterion', entityId: criterion.id });
  view.created(res, criterion);
});

const updateCriterion = asyncHandler(async (req, res) => {
  await findOwnCriterionOrThrow(req.params.id, req);
  const criterion = await criteriaModel.update(req.params.id, req.body);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'update_criterion', entityType: 'criterion', entityId: req.params.id });
  view.ok(res, criterion);
});

const deleteCriterion = asyncHandler(async (req, res) => {
  await findOwnCriterionOrThrow(req.params.id, req);
  await criteriaModel.remove(req.params.id);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'delete_criterion', entityType: 'criterion', entityId: req.params.id });
  view.done(res);
});

module.exports = { listCriteria, createCriterion, updateCriterion, deleteCriterion };
