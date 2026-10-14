const nodemailer = require('nodemailer');
const config = require('../../config/env');
const AppError = require('../../utils/AppError');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure, // true para el puerto 465, false para 587/25 (STARTTLS)
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

// Envía el código por correo real. Ver docs/SEGURIDAD.md para cómo obtener
// credenciales SMTP gratuitas (por ejemplo, una contraseña de aplicación de
// Gmail) sin depender de un servicio de pago.
async function send({ email, fullName, code }) {
  if (!config.smtp.host || !config.smtp.user) {
    throw new AppError(
      'OTP_NOTIFIER=smtp requiere SMTP_HOST, SMTP_USER y SMTP_PASS configurados en whatever/.env.',
      503
    );
  }

  try {
    await getTransporter().sendMail({
      from: config.smtp.from,
      to: email,
      subject: `Tu código de verificación SIFCE: ${code}`,
      text: `Hola ${fullName},\n\nTu código de verificación es: ${code}\n\nEste código vence en ${config.otp.ttlMinutes} minutos. Si no intentaste iniciar sesión, ignora este correo.`,
      html: `<p>Hola ${fullName},</p><p>Tu código de verificación es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p><p>Este código vence en ${config.otp.ttlMinutes} minutos. Si no intentaste iniciar sesión, ignora este correo.</p>`,
    });
    return { delivered: true, channel: 'smtp' };
  } catch (err) {
    throw new AppError(`No fue posible enviar el correo de verificación: ${err.message}`, 502);
  }
}

module.exports = { send };
