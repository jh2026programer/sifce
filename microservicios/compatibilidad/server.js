// ============================================================================
// Microservicio de COMPATIBILIDAD · endpoint (servidor HTTP).
//
//   GET  /salud            -> ¿está vivo?
//   POST /compatibilidad   -> calcula la compatibilidad global de un candidato
//
// Ejemplo de solicitud:
//   { "puntajes": { "formacion": 100, "experiencia": 80, "habilidades": 60, "idiomas": 50 },
//     "pesos":    { "formacion": 25,  "experiencia": 25, "habilidades": 25, "idiomas": 25 } }
//
// Arranque (desde la raíz del proyecto):  npm run ms:compatibilidad
// La API de SIFCE lo llama en MS_COMPATIBILIDAD_URL (whatever/.env).
// ============================================================================
const express = require('express');
const { validarSolicitud } = require('./validator');
const { calcularCompatibilidad } = require('./service');
const { registrarPeticiones, manejarErrores } = require('../comun/http');

const NOMBRE = 'compatibilidad';
const app = express();

app.use(registrarPeticiones(NOMBRE));
app.use(express.json({ limit: '10kb' }));

app.get('/salud', (req, res) => {
  res.json({ ok: true, servicio: NOMBRE });
});

app.post('/compatibilidad', (req, res) => {
  // 1) Validador: si los datos vienen mal, se responde 400 con la lista de errores.
  const errores = validarSolicitud(req.body);
  if (errores.length > 0) {
    return res.status(400).json({ ok: false, errores });
  }

  // 2) Servicio: aplica la regla de negocio.
  const resultado = calcularCompatibilidad(req.body);
  return res.json({ ok: true, resultado });
});

app.use(manejarErrores);

// Solo escucha si se ejecuta directamente (node server.js); las pruebas
// importan "app" sin abrir el puerto.
if (require.main === module) {
  const puerto = parseInt(process.env.MS_COMPATIBILIDAD_PORT || '4101', 10);
  const host = process.env.MS_HOST || '127.0.0.1'; // solo este PC (Docker llega por host.docker.internal)
  app.listen(puerto, host, () => {
    console.log(`[${NOMBRE}] Microservicio escuchando en http://localhost:${puerto}  (POST /compatibilidad, GET /salud)`);
  });
}

module.exports = app;
