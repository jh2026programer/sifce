const activityLogModel = require('../../model/activityLog.model.js');

// Registra una actividad relevante del usuario (RNF-S5: registro de
// actividades). Se hace "best effort": si el log falla, no debe tumbar la
// operación principal que originó el registro.
async function logActivity(entry) {
  try {
    await activityLogModel.create(entry);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[activityLog] No se pudo registrar la actividad:', err.message);
  }
}

module.exports = { logActivity };
