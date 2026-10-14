const db = require('../../model/db');
const userModel = require('../../model/user.model.js');
const userView = require('../presenters/user.view.js');
const view = require('../presenters/response');
const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { requireCompanyId, assertBelongsToCompany } = require('../utils/scope');
const { logActivity } = require('../services/activityLogService');

const COMPANY_ROLES = ['recruiter', 'company_admin'];
const ALL_ROLES = ['superadmin', 'company_admin', 'recruiter', 'candidate'];

function assertPasswordLength(password) {
  if (password.length < 8) throw new AppError('La contraseña debe tener al menos 8 caracteres.', 400);
}

// RF03 - Gestión de Perfil de Usuario (datos propios de la cuenta)
const updateMyAccount = asyncHandler(async (req, res) => {
  const { fullName, password } = req.body;
  const fields = {};

  if (fullName) fields.full_name = fullName.trim();
  if (password) {
    assertPasswordLength(password);
    fields.password_hash = await authService.hashPassword(password);
  }
  if (Object.keys(fields).length === 0) throw new AppError('No se proporcionaron datos para actualizar.', 400);

  const user = await userModel.update(req.user.id, fields);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'update_own_profile' });
  view.ok(res, userView.account(user));
});

// RF18 - Gestión de Usuarios de la Empresa (listar reclutadores/administradores propios)
const listCompanyUsers = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  view.ok(res, await userModel.listByCompany(companyId));
});

// RF18 - crear un reclutador dentro de la empresa del administrador autenticado
const createCompanyUser = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password) throw new AppError('Nombre, correo y contraseña son obligatorios.', 400);
  if (!COMPANY_ROLES.includes(role)) {
    throw new AppError('El rol debe ser "recruiter" o "company_admin".', 400);
  }
  if (await userModel.emailExists(email)) throw new AppError('Ese correo electrónico ya está registrado.', 409);

  const passwordHash = await authService.hashPassword(password);
  const user = await userModel.create(db, { companyId, role, fullName, email, passwordHash });

  await logActivity({ userId: req.user.id, companyId, action: 'create_company_user', entityType: 'user', entityId: user.id });
  view.created(res, userView.companyUser(user));
});

// RF18 - editar/activar/desactivar un usuario de la propia empresa
const updateCompanyUser = asyncHandler(async (req, res) => {
  const companyId = requireCompanyId(req);
  const { id } = req.params;
  const { fullName, isActive, role } = req.body;

  const target = await userModel.findById(id);
  if (!target) throw new AppError('Usuario no encontrado.', 404);
  assertBelongsToCompany(target.company_id, req);

  if (role !== undefined && !COMPANY_ROLES.includes(role)) throw new AppError('Rol inválido.', 400);
  const fields = { full_name: fullName, is_active: isActive, role };
  if (Object.values(fields).every((v) => v === undefined)) {
    throw new AppError('No se proporcionaron datos para actualizar.', 400);
  }

  const user = await userModel.update(id, fields);

  await logActivity({ userId: req.user.id, companyId, action: 'update_company_user', entityType: 'user', entityId: id });
  view.ok(res, userView.companyUserUpdated(user));
});

// ---- Gestión global de usuarios (Superadministrador) ----
// El superadministrador ve y administra TODAS las cuentas de la plataforma:
// buscar/filtrar, editar nombre, activar/desactivar, restablecer contraseña y
// desbloquear cuentas bloqueadas por intentos fallidos. Nunca puede
// desactivar a un superadministrador (evita que la plataforma quede sin
// nadie que la administre).

async function findPlatformUserOrThrow(id) {
  const user = await userModel.findById(id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);
  return user;
}

const listAllUsers = asyncHandler(async (req, res) => {
  const { q, role, companyId, status } = req.query;
  if (role && !ALL_ROLES.includes(role)) throw new AppError('Rol inválido.', 400);
  if (status && !['active', 'inactive', 'locked'].includes(status)) throw new AppError('Estado inválido.', 400);

  view.ok(res, await userModel.listAll({ q: q && q.trim(), role, companyId, status }));
});

const updatePlatformUser = asyncHandler(async (req, res) => {
  const target = await findPlatformUserOrThrow(req.params.id);
  const { fullName, isActive } = req.body;

  if (fullName !== undefined && !String(fullName).trim()) throw new AppError('El nombre no puede quedar vacío.', 400);
  if (isActive !== undefined && typeof isActive !== 'boolean') throw new AppError('isActive debe ser verdadero o falso.', 400);
  if (isActive === false && target.role === 'superadmin') {
    throw new AppError('No es posible desactivar a un superadministrador.', 400);
  }
  if (fullName === undefined && isActive === undefined) {
    throw new AppError('No se proporcionaron datos para actualizar.', 400);
  }

  const user = await userModel.update(target.id, {
    full_name: fullName !== undefined ? String(fullName).trim() : undefined,
    is_active: isActive,
  });

  await logActivity({
    userId: req.user.id, action: 'platform_update_user', entityType: 'user', entityId: target.id,
    metadata: { fullName, isActive },
  });
  view.ok(res, userView.platformUser(user));
});

const resetPlatformUserPassword = asyncHandler(async (req, res) => {
  const target = await findPlatformUserOrThrow(req.params.id);
  const { password } = req.body;
  if (!password) throw new AppError('Debes indicar la nueva contraseña.', 400);
  assertPasswordLength(password);

  // Restablecer la contraseña también levanta un bloqueo vigente: el usuario
  // debe poder entrar con la nueva clave de inmediato.
  await userModel.update(target.id, { password_hash: await authService.hashPassword(password) });
  const user = await userModel.clearLock(target.id);

  await logActivity({ userId: req.user.id, action: 'platform_reset_password', entityType: 'user', entityId: target.id });
  view.ok(res, userView.platformUser(user));
});

const unlockPlatformUser = asyncHandler(async (req, res) => {
  const target = await findPlatformUserOrThrow(req.params.id);
  const user = await userModel.clearLock(target.id);

  await logActivity({ userId: req.user.id, action: 'platform_unlock_user', entityType: 'user', entityId: target.id });
  view.ok(res, userView.platformUser(user));
});

module.exports = {
  updateMyAccount,
  listCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  listAllUsers,
  updatePlatformUser,
  resetPlatformUserPassword,
  unlockPlatformUser,
};
