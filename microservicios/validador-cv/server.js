// ============================================================================
// Microservicio VALIDADOR DE HOJAS DE VIDA · endpoint (servidor HTTP).
//
//   GET  /salud        -> ¿está vivo?
//   POST /validar-cv   -> recibe el PDF (cuerpo binario, Content-Type
//                         application/pdf), lo valida y devuelve su texto y
//                         los datos detectados.
//
// Respuestas:
//   200 { ok: true,  resultado: { texto, datos } }
//   400 { ok: false, errores }   el archivo no es un PDF válido
//   422 { ok: false, errores }   es un PDF, pero no se puede leer o no tiene texto
//
// Arranque (desde la raíz del proyecto):  npm run ms:validador-cv
// La API de SIFCE lo llama en MS_VALIDADOR_CV_URL (whatever/.env).
// ============================================================================
const express = require('express');
const { validarArchivo, MAX_BYTES } = require('./validator');
const { analizarCv } = require('./service');
const { registrarPeticiones, manejarErrores } = require('../comun/http');

const NOMBRE = 'validador-cv';
const app = express();

app.use(registrarPeticiones(NOMBRE));

app.get('/salud', (req, res) => {
  res.json({ ok: true, servicio: NOMBRE });
});

// El PDF llega crudo en el cuerpo. Se acepta un poco más del máximo para que
// sea el validador (y no Express) quien explique que el archivo es muy grande.
app.post('/validar-cv', express.raw({ type: () => true, limit: MAX_BYTES + 1024 }), async (req, res, next) => {
  try {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    // 1) Validador: tipo, tamaño y firma del PDF.
    const errores = validarArchivo({ buffer, contentType: req.get('content-type') });
    if (errores.length > 0) {
      return res.status(400).json({ ok: false, errores });
    }

    // 2) Servicio: extraer el texto y detectar los datos.
    const resultado = await analizarCv(buffer);
    if (!resultado.valido) {
      return res.status(422).json({ ok: false, errores: resultado.errores });
    }
    return res.json({ ok: true, resultado: { texto: resultado.texto, datos: resultado.datos } });
  } catch (err) {
    return next(err);
  }
});

app.use(manejarErrores);

// Solo escucha si se ejecuta directamente (node server.js); las pruebas
// importan "app" sin abrir el puerto.
if (require.main === module) {
  const puerto = parseInt(process.env.MS_VALIDADOR_CV_PORT || '4102', 10);
  const host = process.env.MS_HOST || '127.0.0.1'; // solo este PC (Docker llega por host.docker.internal)
  app.listen(puerto, host, () => {
    console.log(`[${NOMBRE}] Microservicio escuchando en http://localhost:${puerto}  (POST /validar-cv, GET /salud)`);
  });
}

module.exports = app;
