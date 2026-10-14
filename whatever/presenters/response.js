// ============================================================================
// PRESENTADOR (whatever/presenters) — formato de las respuestas HTTP de la API.
//
// En una API REST la "vista" no es HTML: es la representación JSON que recibe
// el cliente. Todas las respuestas del backend salen por aquí, con un mismo
// sobre: { success, data } en éxito y { success: false, message, ... } en
// error. Así el frontend siempre sabe dónde buscar cada cosa.
// ============================================================================

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function created(res, data) {
  return ok(res, data, 201);
}

// Respuesta de éxito sin datos (ej. una eliminación).
function done(res) {
  return res.json({ success: true });
}

// Respuesta de éxito con solo un mensaje informativo.
function message(res, text) {
  return res.json({ success: true, message: text });
}

function error(res, status, { message: text, details, stack }) {
  return res.status(status).json({ success: false, message: text, details, stack });
}

module.exports = { ok, created, done, message, error };
