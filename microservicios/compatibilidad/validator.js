// ============================================================================
// Microservicio de COMPATIBILIDAD · validador.
//
// Revisa que la solicitud traiga todo lo necesario ANTES de calcular nada:
// los 4 puntajes que dio la IA y los 4 pesos que configuró la empresa.
// Devuelve la lista de errores (vacía si la solicitud es válida).
// ============================================================================

// Los cuatro criterios de evaluación de SIFCE (RF14).
const CRITERIOS = ['formacion', 'experiencia', 'habilidades', 'idiomas'];

// Los pesos se reparten en porcentajes; se tolera medio punto de diferencia
// por los decimales que quedan al normalizar los pesos de la empresa.
const TOLERANCIA_SUMA_PESOS = 0.5;

function esNumero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function validarSolicitud(body) {
  const errores = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['El cuerpo de la solicitud debe ser un objeto JSON con "puntajes" y "pesos".'];
  }

  const { puntajes, pesos } = body;

  if (!puntajes || typeof puntajes !== 'object') {
    errores.push('Falta el objeto "puntajes".');
  } else {
    CRITERIOS.forEach((criterio) => {
      const valor = puntajes[criterio];
      if (valor === undefined) errores.push(`Falta el puntaje de "${criterio}".`);
      else if (!esNumero(valor)) errores.push(`El puntaje de "${criterio}" debe ser un número.`);
      else if (valor < 0 || valor > 100) errores.push(`El puntaje de "${criterio}" debe estar entre 0 y 100.`);
    });
  }

  if (!pesos || typeof pesos !== 'object') {
    errores.push('Falta el objeto "pesos".');
  } else {
    let suma = 0;
    let pesosValidos = true;
    CRITERIOS.forEach((criterio) => {
      const valor = pesos[criterio];
      if (valor === undefined) {
        errores.push(`Falta el peso de "${criterio}".`);
        pesosValidos = false;
      } else if (!esNumero(valor) || valor < 0 || valor > 100) {
        errores.push(`El peso de "${criterio}" debe ser un número entre 0 y 100.`);
        pesosValidos = false;
      } else {
        suma += valor;
      }
    });
    if (pesosValidos && Math.abs(suma - 100) > TOLERANCIA_SUMA_PESOS) {
      errores.push(`Los pesos deben sumar 100 (suman ${Number(suma.toFixed(2))}).`);
    }
  }

  return errores;
}

module.exports = { CRITERIOS, validarSolicitud };
