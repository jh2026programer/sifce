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

// Minería en vivo: genera los 100.000 registros, los depura, entrena el
// modelo y recalcula los resultados en ese momento (unos 10 segundos).
const ejecutarEnVivo = asyncHandler(async (req, res) => {
  if (!mineriaService.mineriaEnVivoDisponible()) {
    throw new AppError('La minería en vivo solo está disponible ejecutando SIFCE desde el proyecto (npm run dev:api).', 503);
  }
  const resultado = await mineriaService.ejecutarEnVivo();
  if (resultado.ocupado) throw new AppError('La minería ya se está ejecutando. Espera a que termine.', 409);
  view.ok(res, resultado);
});

module.exports = { getResumen, predecir, ejecutarEnVivo };
