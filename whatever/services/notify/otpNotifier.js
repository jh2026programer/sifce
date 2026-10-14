const config = require('../../config/env');
const consoleNotifier = require('./consoleNotifier');
const smtpNotifier = require('./smtpNotifier');

// Mismo patrón de adaptador que services/ai/aiProvider.js: el resto del
// backend solo llama a notifier.send(...), sin saber si el código termina
// en la terminal o en un correo real.
function getNotifier() {
  return config.otp.notifier === 'smtp' ? smtpNotifier : consoleNotifier;
}

module.exports = { send: (payload) => getNotifier().send(payload) };
