// ============================================================================
// Microservicio de COMPATIBILIDAD · servicio (la regla de negocio).
//
// Compatibilidad global = promedio ponderado de los 4 criterios:
//
//   (formación × peso + experiencia × peso + habilidades × peso + idiomas × peso) / 100
//
// Los puntajes (0-100) los da la IA; los pesos los configura cada empresa
// (por defecto 25 % cada uno). Además clasifica el resultado en un nivel para
// que el reclutador lo lea de un vistazo. La decisión final sigue siendo
// humana: esto solo ordena y recomienda.
// ============================================================================
const { CRITERIOS } = require('./validator');

// Límites de cada nivel de compatibilidad.
const NIVELES = [
  { minimo: 75, nivel: 'alta' },
  { minimo: 50, nivel: 'media' },
  { minimo: 0, nivel: 'baja' },
];

const redondear = (n) => Math.round(n * 100) / 100;

function clasificar(compatibilidad) {
  return NIVELES.find((n) => compatibilidad >= n.minimo).nivel;
}

// Recibe una solicitud ya validada por validator.js.
function calcularCompatibilidad({ puntajes, pesos }) {
  // Cuánto aporta cada criterio al total, para que se vea de dónde sale el número.
  const detalle = CRITERIOS.map((criterio) => ({
    criterio,
    puntaje: puntajes[criterio],
    peso: redondear(pesos[criterio]),
    aporte: redondear((puntajes[criterio] * pesos[criterio]) / 100),
  }));

  const compatibilidad = redondear(
    CRITERIOS.reduce((suma, criterio) => suma + puntajes[criterio] * pesos[criterio], 0) / 100
  );

  return { compatibilidad, nivel: clasificar(compatibilidad), detalle };
}

module.exports = { calcularCompatibilidad, clasificar, NIVELES };
