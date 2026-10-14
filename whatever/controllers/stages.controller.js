const db = require('../../model/db');
const stageModel = require('../../model/stage.model.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { requireCompanyId, assertBelongsToCompany } = require('../utils/scope');
const { logActivity } = require('../services/activityLogService');

// RF15 - Configuración de Etapas del Proceso de Selección
const listStages = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  view.ok(res, await stageModel.listByCompany(companyId));
});

const updateStage = asyncHandler(async (req, res) => {
  const existing = await stageModel.findById(req.params.id);
  if (!existing) throw new AppError('Etapa no encontrada.', 404);
  assertBelongsToCompany(existing.company_id, req);

  const stage = await stageModel.update(req.params.id, req.body);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'update_stage', entityType: 'stage', entityId: req.params.id });
  view.ok(res, stage);
});

// Nota: las 6 etapas base (RF13) son fijas en su status_code para no romper
// el flujo de application_stage_history; lo configurable por empresa es el
// nombre visible, la descripción y el orden de presentación (RF15).
const createStage = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  const { name, statusCode, sortOrder, description } = req.body;

  if (!stageModel.STATUS_CODES.includes(statusCode)) {
    throw new AppError(`El código de estado debe ser uno de: ${stageModel.STATUS_CODES.join(', ')}.`, 400);
  }
  if (!name) throw new AppError('El nombre de la etapa es obligatorio.', 400);

  const stage = await stageModel.create(db, companyId, { name, statusCode, sortOrder, description });

  await logActivity({ userId: req.user.id, companyId, action: 'create_stage', entityType: 'stage', entityId: stage.id });
  view.created(res, stage);
});

module.exports = { listStages, updateStage, createStage };
