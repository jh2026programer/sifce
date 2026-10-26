// ============================================================================
// Cliente de los microservicios de SIFCE (carpeta microservicios/).
//
// La API ya no calcula la compatibilidad ni lee los PDF por su cuenta: se lo
// pide por HTTP a dos programas independientes:
//   - compatibilidad  (POST {MS_COMPATIBILIDAD_URL}/compatibilidad)
//   - validador-cv    (POST {MS_VALIDADOR_CV_URL}/validar-cv)
//
// Tolerancia a fallas: si un microservicio no está configurado o no responde,
// la API ejecuta el MISMO código del microservicio dentro de su propio
// proceso (respaldo). Así SIFCE sigue funcionando y la métrica
// sifce_microservice_requests_total{mode="fallback"} deja ver el problema.
// ============================================================================
const config = require('../config/env');
const metrics = require('./metrics');
const compatValidator = require('../../microservicios/compatibilidad/validator');
const compatService = require('../../microservicios/compatibilidad/service');
const cvValidator = require('../../microservicios/validador-cv/validator');
const cvService = require('../../microservicios/validador-cv/service');

const { compatibilidadUrl, validadorCvUrl, timeoutMs } = config.microservicios;

// Error de datos: el microservicio respondió, pero rechazó la solicitud.
// No tiene sentido usar el respaldo, porque también la rechazaría.
class DatosRechazados extends Error {}

async function post(url, body, contentType) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// Intenta el microservicio y, si no responde, usa el respaldo local.
async function conRespaldo(servicio, url, remoto, local) {
  if (!url) {
    metrics.recordMicroservice(servicio, 'local');
    return { ...(await local()), modo: 'local' };
  }
  try {
    const resultado = await remoto();
    metrics.recordMicroservice(servicio, 'remote');
    return { ...resultado, modo: 'remote' };
  } catch (err) {
    if (err instanceof DatosRechazados) throw err;
    // eslint-disable-next-line no-console
    console.warn(`[microservicios] ${servicio} no respondió en ${url} (${err.message}); se usa el respaldo interno.`);
    metrics.recordMicroservice(servicio, 'fallback');
    return { ...(await local()), modo: 'fallback' };
  }
}

// --- Compatibilidad ---------------------------------------------------------
// puntajes y pesos: { formacion, experiencia, habilidades, idiomas }.
// Devuelve { compatibilidad, nivel, detalle, modo }.
function calcularCompatibilidad(puntajes, pesos) {
  const solicitud = { puntajes, pesos };

  return conRespaldo(
    'compatibilidad',
    compatibilidadUrl,
    async () => {
      const { status, json } = await post(`${compatibilidadUrl}/compatibilidad`, JSON.stringify(solicitud), 'application/json');
      if (status === 200 && json.ok) return json.resultado;
      if (status === 400) {
        throw new DatosRechazados(`Datos de compatibilidad inválidos: ${(json.errores || []).join(' ')}`);
      }
      throw new Error(`respondió ${status}`);
    },
    async () => {
      const errores = compatValidator.validarSolicitud(solicitud);
      if (errores.length > 0) throw new DatosRechazados(`Datos de compatibilidad inválidos: ${errores.join(' ')}`);
      return compatService.calcularCompatibilidad(solicitud);
    }
  );
}

// --- Validador de hojas de vida ---------------------------------------------
// Devuelve { success, text, error, datos, modo }: success/text/error es lo que
// guarda resumeModel.saveExtraction. Un CV inválido no es una excepción: se
// informa en "error" para que el candidato sepa qué pasó.
function validarCv(buffer) {
  const invalido = (errores) => ({ success: false, text: '', error: errores.join(' '), datos: null });

  return conRespaldo(
    'validador-cv',
    validadorCvUrl,
    async () => {
      const { status, json } = await post(`${validadorCvUrl}/validar-cv`, buffer, 'application/pdf');
      if (status === 200 && json.ok) {
        return { success: true, text: json.resultado.texto, error: null, datos: json.resultado.datos };
      }
      if (status === 400 || status === 422) return invalido(json.errores || ['Hoja de vida inválida.']);
      throw new Error(`respondió ${status}`);
    },
    async () => {
      const errores = cvValidator.validarArchivo({ buffer, contentType: 'application/pdf' });
      if (errores.length > 0) return invalido(errores);
      const r = await cvService.analizarCv(buffer);
      if (!r.valido) return invalido(r.errores);
      return { success: true, text: r.texto, error: null, datos: r.datos };
    }
  );
}

module.exports = { calcularCompatibilidad, validarCv };
