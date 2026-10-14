const AppError = require('./AppError');

// ============================================================================
// Aislamiento de datos por empresa (Sección 7 del prompt / RNF-S4).
//
// Regla dura: ningún controlador debe construir una consulta SQL sobre
// vacantes, candidatos postulados, criterios, etapas, usuarios internos o
// resultados de IA sin pasar el company_id del usuario autenticado. Estas
// funciones son el único punto donde se decide "a qué empresa pertenece
// este request", para no repetir (y potencialmente olvidar) esa lógica en
// cada controlador.
// ============================================================================

// Para rutas de company_admin / recruiter: siempre existe una empresa y toda
// consulta debe filtrar por ella. El superadmin NUNCA debe llamar estas
// rutas (se le bloquea antes vía middleware authorize).
function requireCompanyId(req) {
  if (!req.user.companyId) {
    throw new AppError('Esta acción requiere pertenecer a una empresa.', 403);
  }
  return req.user.companyId;
}

// Verifica que un recurso ya cargado (con su company_id) pertenezca a la
// empresa del usuario autenticado. Se usa después de un SELECT ... WHERE id=$1
// para dar un 404 (no 403) y no revelar si el recurso existe en otra empresa.
function assertBelongsToCompany(resourceCompanyId, req) {
  const companyId = requireCompanyId(req);
  if (resourceCompanyId !== companyId) {
    throw new AppError('Recurso no encontrado.', 404);
  }
}

module.exports = { requireCompanyId, assertBelongsToCompany };
