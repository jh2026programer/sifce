const reportModel = require('../../model/report.model.js');
const reportView = require('../presenters/report.view.js');
const view = require('../presenters/response');
const asyncHandler = require('../utils/asyncHandler');
const { requireCompanyId } = require('../utils/scope');

// ============================================================================
// Módulo de reportes (solicitado por el cliente: "que los administradores
// puedan generar reportes"). Todo queda acotado a la empresa del usuario
// autenticado — mismo principio de aislamiento que el resto del sistema.
// ============================================================================

// Resumen general para el dashboard y la pantalla de reportes.
const getSummary = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  const data = await reportModel.getSummaryData(companyId);
  view.ok(res, reportView.summary(data));
});

// Exportación plana de TODAS las postulaciones de la empresa, pensada para
// generar un reporte descargable (CSV) desde el frontend.
const exportApplications = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  view.ok(res, await reportModel.exportApplications(companyId));
});

module.exports = { getSummary, exportApplications };
