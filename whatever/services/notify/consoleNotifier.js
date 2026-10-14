// Notificador por defecto: imprime el código en la terminal del backend.
// Esto sigue siendo un segundo factor real (el código no viaja al frontend,
// no se puede leer desde el navegador, y expira) — simplemente evita
// depender de un proveedor de correo configurado para poder demostrar el
// flujo completo de inmediato. Para producción, usar OTP_NOTIFIER=smtp.
async function send({ email, fullName, code }) {
  // eslint-disable-next-line no-console
  console.log(
    `\n[SIFCE] 🔐 Código de verificación para ${fullName} <${email}>: ${code}\n` +
    `        (modo consola — configura OTP_NOTIFIER=smtp para enviarlo por correo real)\n`
  );
  return { delivered: true, channel: 'console' };
}

module.exports = { send };
