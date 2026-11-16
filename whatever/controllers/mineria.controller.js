const mineriaService = require('../services/mineria/mineriaService');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ============================================================================
// Minería de datos: resultados del análisis de 100.000 postulaciones
// (dataset sintético) y predicción de selección con el modelo entrenado.
// ============================================================================

const getResumen = asyncHandler(async (req, res) => {
  view.ok(res, mineriaService.resumen());
});

const predecir = asyncHandler(async (req, res) => {
  const errores = mineriaService.validar(req.body);
  if (errores.length > 0) throw new AppError('Revisa los datos del candidato.', 400, errores);
  view.ok(res, mineriaService.predecir(req.body));
});

module.exports = { getResumen, predecir };
