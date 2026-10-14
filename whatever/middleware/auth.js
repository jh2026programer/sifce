const jwt = require('jsonwebtoken');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const userModel = require('../../model/user.model.js');

// RNF-S2: el acceso a cualquier ruta protegida requiere un token válido.
// El payload del token solo contiene identificadores; el usuario se recarga
// desde la base de datos en cada request para respetar cambios de estado
// (por ejemplo, un usuario desactivado por su administrador).
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Debes iniciar sesión para acceder a este recurso.', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    throw new AppError('Sesión inválida o expirada. Inicia sesión nuevamente.', 401);
  }

  const user = await userModel.findSessionUser(payload.userId);

  if (!user) {
    throw new AppError('El usuario asociado a esta sesión ya no existe.', 401);
  }
  if (!user.is_active) {
    throw new AppError('Tu cuenta ha sido desactivada. Contacta al administrador de tu empresa.', 403);
  }
  // RF04: si el Superadministrador desactiva la empresa, sus usuarios pierden
  // el acceso de inmediato, incluso con una sesión ya iniciada.
  if (user.company_id && user.company_status !== 'active') {
    throw new AppError('La empresa asociada a tu cuenta se encuentra desactivada en la plataforma.', 403);
  }

  req.user = {
    id: user.id,
    companyId: user.company_id,
    role: user.role,
    fullName: user.full_name,
    email: user.email,
  };
  next();
});

module.exports = { authenticate };
