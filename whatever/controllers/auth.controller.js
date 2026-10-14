const db = require('../../model/db');
const userModel = require('../../model/user.model.js');
const candidateModel = require('../../model/candidate.model.js');
const companyModel = require('../../model/company.model.js');
const stageModel = require('../../model/stage.model.js');
const userView = require('../presenters/user.view.js');
const view = require('../presenters/response');
const config = require('../config/env');
const authService = require('../services/authService');
const otpService = require('../services/otpService');
const { verifyCaptcha } = require('../services/captchaService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityLogService');
const { generateAccessCode } = require('../utils/accessCode');
const { linkCandidateByCode } = require('../services/companyLinkService');
const metrics = require('../services/metrics');

const sessionFor = (user) => userView.session(user, authService.generateToken(user));

// RF01 - Autenticación de Usuario, con bloqueo por intentos fallidos
// (RNF-S3/S4: protección contra fuerza bruta) y verificación en dos pasos
// (OTP) cuando está habilitada (ver whatever/.env.example: OTP_ENABLED).
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Correo y contraseña son obligatorios.', 400);

  const user = await userModel.findByEmailWithCompanyStatus(email);

  // Mensaje genérico: no revelar si el correo existe o no.
  if (!user) {
    metrics.recordLogin('invalid');
    throw new AppError('Credenciales inválidas.', 401);
  }
  if (!user.is_active || (user.company_id && user.company_status !== 'active')) {
    metrics.recordLogin('inactive');
    throw new AppError(
      user.is_active
        ? 'La empresa asociada a esta cuenta se encuentra desactivada en la plataforma.'
        : 'Tu cuenta está desactivada. Contacta a tu administrador.',
      403
    );
  }

  // Bloqueo por intentos fallidos: si la cuenta está bloqueada, ni siquiera
  // se compara la contraseña (evita seguir "adivinando" mientras está bloqueada).
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    metrics.recordLogin('locked');
    throw new AppError(
      `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta de nuevo en ${minutesLeft} minuto(s).`,
      429
    );
  }

  const valid = await authService.comparePassword(password, user.password_hash);
  if (!valid) {
    const attempts = user.failed_login_attempts + 1;
    if (attempts >= config.loginLockout.maxAttempts) {
      const lockedUntil = new Date(Date.now() + config.loginLockout.lockMinutes * 60 * 1000);
      await userModel.lockUntil(user.id, lockedUntil);
      await logActivity({ userId: user.id, action: 'account_locked' });
      metrics.recordLogin('invalid');
      metrics.recordLockout();
      throw new AppError(
        `Demasiados intentos fallidos. La cuenta quedó bloqueada por ${config.loginLockout.lockMinutes} minutos.`,
        429
      );
    }
    await userModel.setFailedAttempts(user.id, attempts);
    metrics.recordLogin('invalid');
    throw new AppError('Credenciales inválidas.', 401);
  }

  // Contraseña correcta: limpiar contador de intentos fallidos.
  if (user.failed_login_attempts > 0 || user.locked_until) {
    await userModel.clearLock(user.id);
  }

  if (config.otp.enabled) {
    const { otpId } = await otpService.createAndSendOtp(user);
    await logActivity({ userId: user.id, companyId: user.company_id, action: 'login_otp_sent' });
    return view.ok(res, { requiresOtp: true, otpId, maskedEmail: otpService.maskEmail(user.email) });
  }

  await logActivity({ userId: user.id, companyId: user.company_id, action: 'login' });
  metrics.recordLogin('success');
  view.ok(res, sessionFor(user));
});

// Segundo paso del login: valida el código OTP y, si es correcto, recién ahí
// emite el token de sesión (antes de esto no existe ninguna sesión activa).
const verifyLoginOtp = asyncHandler(async (req, res) => {
  const { otpId, code } = req.body;
  if (!otpId || !code) throw new AppError('Falta el identificador de verificación o el código.', 400);

  const userId = await otpService.verifyOtp(otpId, code.trim());
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Usuario no encontrado.', 404);
  if (!user.is_active) throw new AppError('Tu cuenta está desactivada. Contacta a tu administrador.', 403);

  await logActivity({ userId: user.id, companyId: user.company_id, action: 'login' });
  view.ok(res, sessionFor(user));
});

// Reenvía un nuevo código OTP (con un pequeño límite de tiempo entre envíos).
const resendLoginOtp = asyncHandler(async (req, res) => {
  const { otpId } = req.body;
  if (!otpId) throw new AppError('Falta el identificador de verificación.', 400);

  const { otpId: newOtpId } = await otpService.resendOtp(otpId);
  view.ok(res, { otpId: newOtpId });
});

// RF02 - Registro de Usuario (candidato, autoservicio). Opcionalmente recibe
// el código de acceso de una empresa para vincularse a su entorno privado en
// el mismo paso (caso típico: el candidato llega por invitación directa de
// esa empresa). Protegido con CAPTCHA cuando está habilitado (CAPTCHA_ENABLED).
const registerCandidate = asyncHandler(async (req, res) => {
  const { fullName, email, password, companyCode, captchaToken } = req.body;
  if (!fullName || !email || !password) throw new AppError('Nombre, correo y contraseña son obligatorios.', 400);
  if (password.length < 8) throw new AppError('La contraseña debe tener al menos 8 caracteres.', 400);

  await verifyCaptcha(captchaToken, req.ip);

  if (await userModel.emailExists(email)) throw new AppError('Ese correo electrónico ya está registrado.', 409);

  const passwordHash = await authService.hashPassword(password);
  const { user, linkedCompany } = await db.withTransaction(async (client) => {
    const newUser = await userModel.create(client, { role: 'candidate', fullName, email, passwordHash });
    const candidateId = await candidateModel.createProfile(client, newUser.id);

    let company = null;
    if (companyCode && companyCode.trim()) {
      company = await linkCandidateByCode(client, candidateId, companyCode);
    }
    return { user: newUser, linkedCompany: company };
  });

  await logActivity({ userId: user.id, action: 'register_candidate' });
  view.created(res, { ...sessionFor(user), linkedCompany });
});

// RF02 / RF04 - Registro de una nueva empresa junto con su Administrador
// (autoservicio: una empresa se da de alta y su primer administrador queda
// creado en la misma operación; el Superadministrador conserva la potestad
// de activar/desactivar la empresa después, RF04). Protegido con CAPTCHA
// cuando está habilitado.
const registerCompany = asyncHandler(async (req, res) => {
  const { companyName, sector, adminFullName, email, password, captchaToken } = req.body;
  if (!companyName || !adminFullName || !email || !password) {
    throw new AppError('Nombre de la empresa, nombre del administrador, correo y contraseña son obligatorios.', 400);
  }
  if (password.length < 8) throw new AppError('La contraseña debe tener al menos 8 caracteres.', 400);

  await verifyCaptcha(captchaToken, req.ip);

  if (await userModel.emailExists(email)) throw new AppError('Ese correo electrónico ya está registrado.', 409);

  const passwordHash = await authService.hashPassword(password);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { company, user } = await db.withTransaction(async (client) => {
        const newCompany = await companyModel.create(client, { name: companyName, sector, accessCode: generateAccessCode() });
        const admin = await userModel.create(client, {
          companyId: newCompany.id, role: 'company_admin', fullName: adminFullName, email, passwordHash,
        });
        // Etapas por defecto del proceso de selección (RF15), editables luego.
        await stageModel.createDefaults(client, newCompany.id);
        return { company: newCompany, user: admin };
      });

      await logActivity({ userId: user.id, companyId: company.id, action: 'register_company' });
      return view.created(res, { ...sessionFor(user), company });
    } catch (err) {
      // Colisión improbable en el código único de empresa: reintentar con uno nuevo.
      if (companyModel.isAccessCodeCollision(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new AppError('No fue posible completar el registro. Intenta nuevamente.', 500);
});

// RF03 - obtiene el propio perfil (usado por el frontend al refrescar sesión)
const me = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  view.ok(res, userView.me(user));
});

// Config pública (sin autenticar): le dice al frontend si debe mostrar el
// widget de CAPTCHA y con qué clave de sitio (pública, no la secreta).
const publicConfig = asyncHandler(async (req, res) => {
  view.ok(res, {
    captchaEnabled: config.captcha.enabled,
    captchaSiteKey: config.captcha.enabled ? config.captcha.siteKey : null,
  });
});

module.exports = {
  login, verifyLoginOtp, resendLoginOtp, registerCandidate, registerCompany, me, publicConfig,
};
