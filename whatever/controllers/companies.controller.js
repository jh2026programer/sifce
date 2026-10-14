const db = require('../../model/db');
const companyModel = require('../../model/company.model.js');
const userModel = require('../../model/user.model.js');
const stageModel = require('../../model/stage.model.js');
const userView = require('../presenters/user.view.js');
const view = require('../presenters/response');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');
const { generateAccessCode } = require('../utils/accessCode');
const authService = require('../services/authService');

// ---- RF04: Gestión de Empresas en la Plataforma (Superadministrador) ----

const listCompanies = asyncHandler(async (req, res) => {
  view.ok(res, await companyModel.findAll());
});

const getCompanyById = asyncHandler(async (req, res) => {
  const company = await companyModel.findById(req.params.id);
  if (!company) throw new AppError('Empresa no encontrada.', 404);
  view.ok(res, company);
});

// CORRECCIÓN: antes, una empresa creada por el Superadministrador quedaba
// SIN administrador (sin correo/contraseña), por lo que era visible en la
// base de datos pero nadie podía iniciar sesión en ella — quedaba inservible.
// Ahora esta operación exige y crea las credenciales del primer
// Administrador de Empresa en la MISMA transacción que la empresa, igual
// que el registro público (Sección 27: "no marques como completado algo que
// no esté implementado" — antes se marcaba como creada una empresa que en
// realidad no era operable).
const createCompany = asyncHandler(async (req, res) => {
  const {
    name, sector, description, location, contactEmail, contactPhone,
    adminFullName, adminEmail, adminPassword,
  } = req.body;

  if (!name) throw new AppError('El nombre de la empresa es obligatorio.', 400);
  if (!adminFullName || !adminEmail || !adminPassword) {
    throw new AppError(
      'Debes indicar el nombre, correo y contraseña del Administrador de Empresa: sin estas credenciales, la empresa quedaría creada pero nadie podría acceder a ella.',
      400
    );
  }
  if (adminPassword.length < 8) throw new AppError('La contraseña del administrador debe tener al menos 8 caracteres.', 400);

  if (await userModel.emailExists(adminEmail)) throw new AppError('Ese correo electrónico ya está registrado.', 409);

  const passwordHash = await authService.hashPassword(adminPassword);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { company, admin } = await db.withTransaction(async (client) => {
        const newCompany = await companyModel.create(client, {
          name, sector, description, location, contactEmail, contactPhone, accessCode: generateAccessCode(),
        });
        const newAdmin = await userModel.create(client, {
          companyId: newCompany.id, role: 'company_admin', fullName: adminFullName, email: adminEmail, passwordHash,
        });
        await stageModel.createDefaults(client, newCompany.id);
        return { company: newCompany, admin: newAdmin };
      });

      await logActivity({ userId: req.user.id, action: 'create_company', entityType: 'company', entityId: company.id });
      return view.created(res, { company, admin: userView.account(admin) });
    } catch (err) {
      if (companyModel.isAccessCodeCollision(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new AppError('No fue posible generar un código de acceso único. Intenta nuevamente.', 500);
});

const setCompanyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'active' | 'inactive'
  if (!['active', 'inactive'].includes(status)) throw new AppError('Estado inválido.', 400);

  const company = await companyModel.setStatus(req.params.id, status);
  if (!company) throw new AppError('Empresa no encontrada.', 404);

  await logActivity({ userId: req.user.id, action: `company_${status}`, entityType: 'company', entityId: company.id });
  view.ok(res, company);
});

// El Superadministrador puede editar la información de CUALQUIER empresa
// (a diferencia de updateMyCompany, que solo permite editar la propia).
const updateCompanyById = asyncHandler(async (req, res) => {
  const company = await companyModel.update(req.params.id, req.body);
  if (!company) throw new AppError('Empresa no encontrada.', 404);

  await logActivity({ userId: req.user.id, action: 'update_company', entityType: 'company', entityId: req.params.id });
  view.ok(res, company);
});

// ---- RF19: Configuración de la Información de la Empresa Propia ----

const getMyCompany = asyncHandler(async (req, res) => {
  if (!req.user.companyId) throw new AppError('No perteneces a ninguna empresa.', 403);
  const company = await companyModel.findById(req.user.companyId);
  if (!company) throw new AppError('Empresa no encontrada.', 404);
  view.ok(res, company);
});

const updateMyCompany = asyncHandler(async (req, res) => {
  if (!req.user.companyId) throw new AppError('No perteneces a ninguna empresa.', 403);
  const company = await companyModel.update(req.user.companyId, req.body);

  await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'update_own_company' });
  view.ok(res, company);
});

// El código se puede rotar si se filtró o si la empresa quiere dejar de
// aceptar nuevos candidatos con el código anterior. Los candidatos YA
// vinculados no pierden acceso: el código solo se usa para vincular, no para
// mantener el vínculo (Sección "vinculación mediante código único").
const regenerateAccessCode = asyncHandler(async (req, res) => {
  if (!req.user.companyId) throw new AppError('No perteneces a ninguna empresa.', 403);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const company = await companyModel.setAccessCode(req.user.companyId, generateAccessCode());
      await logActivity({ userId: req.user.id, companyId: req.user.companyId, action: 'regenerate_access_code' });
      return view.ok(res, company);
    } catch (err) {
      if (companyModel.isAccessCodeCollision(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new AppError('No fue posible generar un nuevo código único. Intenta nuevamente.', 500);
});

module.exports = {
  listCompanies, getCompanyById, createCompany, setCompanyStatus, updateCompanyById,
  getMyCompany, updateMyCompany, regenerateAccessCode,
};
