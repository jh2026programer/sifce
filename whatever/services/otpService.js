const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const otpModel = require('../../model/otp.model.js');
const userModel = require('../../model/user.model.js');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const otpNotifier = require('./notify/otpNotifier');

function generateNumericCode(digits = 6) {
  // Rango exacto de 6 dígitos (100000-999999): evita códigos con ceros a la
  // izquierda que se prestan a confusión al leerlos en pantalla o en un correo.
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return crypto.randomInt(min, max + 1).toString();
}

// Genera un código, lo guarda hasheado (nunca en texto plano) y lo envía por
// el canal configurado (consola en demo, correo real si OTP_NOTIFIER=smtp).
async function createAndSendOtp(user) {
  const code = generateNumericCode();
  const codeHash = await bcrypt.hash(code, config.bcryptSaltRounds);
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);

  const otpId = await otpModel.create(user.id, codeHash, expiresAt);

  await otpNotifier.send({ email: user.email, fullName: user.full_name, code });

  return { otpId };
}

// Enmascara el correo para mostrarlo en el frontend sin revelarlo completo
// (ej. "m****a@correo.demo") — detalle menor de privacidad en la UI.
function maskEmail(email) {
  const [user, domain] = email.split('@');
  if (!domain || user.length <= 2) return email;
  return `${user[0]}${'*'.repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}@${domain}`;
}

// Verifica un código contra el registro guardado. Lanza AppError con un
// mensaje claro para cada caso (expirado, ya usado, demasiados intentos,
// código incorrecto) en vez de un genérico "inválido".
async function verifyOtp(otpId, code) {
  const record = await otpModel.findById(otpId);
  if (!record) throw new AppError('Código no encontrado o ya expiró. Solicita uno nuevo.', 404);
  if (record.consumed) throw new AppError('Este código ya fue utilizado. Solicita uno nuevo.', 409);
  if (new Date(record.expires_at) < new Date()) throw new AppError('El código expiró. Solicita uno nuevo.', 410);
  if (record.attempts >= config.otp.maxAttempts) {
    throw new AppError('Se agotaron los intentos para este código. Solicita uno nuevo.', 429);
  }

  const valid = await bcrypt.compare(code, record.code_hash);
  if (!valid) {
    await otpModel.incrementAttempts(otpId);
    const remaining = config.otp.maxAttempts - (record.attempts + 1);
    throw new AppError(
      remaining > 0 ? `Código incorrecto. Te quedan ${remaining} intento(s).` : 'Código incorrecto. Se agotaron los intentos, solicita uno nuevo.',
      400
    );
  }

  await otpModel.markConsumed(otpId);
  return record.user_id;
}

// Reenvío: invalida el código anterior (si sigue vigente) y genera uno nuevo.
// Un límite simple por tiempo (no más de uno cada 30s) evita que se use como
// vía para enviar correo masivo.
async function resendOtp(otpId) {
  const record = await otpModel.findById(otpId);
  if (!record) throw new AppError('Solicitud de verificación no encontrada. Vuelve a iniciar sesión.', 404);
  if (record.consumed) throw new AppError('Esta verificación ya se completó. Vuelve a iniciar sesión.', 409);

  const secondsSinceCreated = (Date.now() - new Date(record.created_at).getTime()) / 1000;
  if (secondsSinceCreated < 30) {
    throw new AppError(`Espera ${Math.ceil(30 - secondsSinceCreated)} segundos antes de solicitar otro código.`, 429);
  }

  const user = await userModel.findById(record.user_id);
  if (!user) throw new AppError('Usuario no encontrado.', 404);

  await otpModel.markConsumed(otpId);
  return createAndSendOtp(user);
}

module.exports = { createAndSendOtp, verifyOtp, resendOtp, maskEmail };
