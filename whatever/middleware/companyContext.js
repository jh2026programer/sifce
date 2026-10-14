const companyLinkModel = require('../../model/companyLink.model.js');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// ============================================================================
// Modelo privado por empresa: un candidato tiene una sola cuenta, pero para
// ver vacantes o postularse debe operar "dentro" de una empresa a la que ya
// esté vinculado (candidate_company_links). El cliente indica en qué entorno
// quiere operar mediante el encabezado X-Active-Company; el backend NUNCA
// confía en ese valor sin revalidar el vínculo contra la base de datos en
// cada request (mismo principio que ya se aplica en middleware/auth.js).
//
// Esto reemplaza el antiguo "listado público de vacantes" (RF16 original):
// ya no existe ninguna consulta que devuelva vacantes o empresas sin que el
// candidato esté vinculado primero.
// ============================================================================

async function resolveActiveCompany(req) {
  const headerValue = req.headers['x-active-company'];
  if (!headerValue) return null;

  return companyLinkModel.findLinkedCompanyForUser(req.user.id, headerValue);
}

// Uso obligatorio: rutas donde el candidato SIEMPRE debe operar dentro de un
// entorno de empresa (explorar vacantes, postularse, ver sus postulaciones).
const requireActiveCompany = asyncHandler(async (req, res, next) => {
  const company = await resolveActiveCompany(req);
  if (!company) {
    throw new AppError(
      'Selecciona primero la empresa en la que deseas operar (encabezado X-Active-Company ausente o inválido).',
      400
    );
  }
  if (company.status !== 'active') {
    throw new AppError('Esta empresa no se encuentra activa en la plataforma en este momento.', 403);
  }
  req.activeCompany = company;
  next();
});

// Uso opcional: rutas compartidas con otros roles (ej. detalle de vacante)
// donde, si el usuario es candidato, conviene saber su empresa activa sin
// bloquear la petición cuando no la envía.
const attachActiveCompanyIfPresent = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'candidate') return next();
  req.activeCompany = await resolveActiveCompany(req);
  next();
});

module.exports = { requireActiveCompany, attachActiveCompanyIfPresent };
