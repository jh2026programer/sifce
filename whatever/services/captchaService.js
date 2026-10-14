const config = require('../config/env');
const AppError = require('../utils/AppError');

// ============================================================================
// Verificación de CAPTCHA ("no soy un robot") usando Google reCAPTCHA v2.
//
// Requiere una clave de sitio (pública, va en el frontend) y una clave
// secreta (privada, va en el backend), gratuitas en
// https://www.google.com/recaptcha/admin/create — elige el tipo
// "reCAPTCHA v2" / "Casilla 'No soy un robot'".
//
// Deshabilitado por defecto (CAPTCHA_ENABLED=false) para que el registro
// funcione de inmediato sin depender de esas claves; actívalo cuando las
// tengas. Ver docs/SEGURIDAD.md.
// ============================================================================

async function verifyCaptcha(token, remoteIp) {
  if (!config.captcha.enabled) {
    return true; // CAPTCHA desactivado: no bloquea el registro (modo demo)
  }

  if (!token) {
    throw new AppError('Debes completar la verificación "no soy un robot".', 400);
  }
  if (!config.captcha.secretKey) {
    throw new AppError('CAPTCHA_ENABLED=true pero falta CAPTCHA_SECRET_KEY en whatever/.env.', 503);
  }

  const params = new URLSearchParams({ secret: config.captcha.secretKey, response: token });
  if (remoteIp) params.append('remoteip', remoteIp);

  let response;
  try {
    response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  } catch (err) {
    throw new AppError(`No fue posible verificar el CAPTCHA: ${err.message}`, 503);
  }

  const data = await response.json();
  if (!data.success) {
    throw new AppError('La verificación "no soy un robot" no pudo confirmarse. Intenta nuevamente.', 400);
  }
  return true;
}

module.exports = { verifyCaptcha };
