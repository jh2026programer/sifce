const AppError = require('../utils/AppError');

// Middleware de fábrica: authorize('superadmin', 'company_admin') solo deja
// pasar a los roles indicados. Debe usarse siempre DESPUÉS de authenticate.
// Esto implementa el control de acceso por rol exigido en la Sección 6 y
// RNF-S2 para cada RF que define "Actores" específicos.
function authorize(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(new AppError('No autenticado.', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('No tienes permisos para realizar esta acción.', 403));
    }
    return next();
  };
}

module.exports = authorize;
