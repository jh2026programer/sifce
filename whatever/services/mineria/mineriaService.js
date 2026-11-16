// ============================================================================
// Minería de datos · servicio de SIFCE.
//
// Usa el resultado del entrenamiento (modelo_seleccion.json, generado por
// mineria-datos/entrenar_modelo.js) para:
//   - resumen():   lo encontrado en la minería (depuración, análisis, métricas
//                  del modelo y perfiles de candidato) para las gráficas.
//   - predecir():  la probabilidad de que un candidato sea seleccionado y los
//                  factores que más la suben o la bajan.
// ============================================================================
const { SECTORES, MODALIDADES, EDUCACION, INGLES, vectorizar } = require('./codificacion');

let modelo = null;
function cargar() {
  // eslint-disable-next-line global-require
  if (!modelo) modelo = require('./modelo_seleccion.json');
  return modelo;
}

function resumen() {
  const m = cargar();
  return {
    generado: m.generado,
    fuente: m.fuente,
    depuracion: m.depuracion,
    resumen: m.resumen,
    analisis: m.analisis,
    modelo: {
      tipo: m.modelo.tipo,
      entrenamiento: m.modelo.entrenamiento,
      prueba: m.modelo.prueba,
      umbral: m.modelo.umbral,
      metricas: m.modelo.metricas,
      matriz_confusion: m.modelo.matriz_confusion,
      roc: m.modelo.roc,
      // Peso de cada variable (sobre datos estandarizados): positivo sube la
      // probabilidad de ser seleccionado, negativo la baja.
      importancia: m.modelo.variables
        .map((v) => ({ variable: v.etiqueta, peso: Math.round(v.coeficiente * 1000) / 1000 }))
        .sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso)),
    },
    perfiles: m.perfiles,
  };
}

// --- Validación de la entrada del simulador --------------------------------------
const NUMEROS = {
  edad: [18, 75],
  anios_experiencia: [0, 50],
  experiencia_requerida: [0, 20],
  habilidades_requeridas: [1, 20],
  habilidades_cumplidas: [0, 20],
  certificaciones: [0, 30],
  salario_ofrecido: [500000, 100000000],
  salario_aspirado: [500000, 100000000],
  compatibilidad: [0, 100],
};
const OPCIONES = { sector: SECTORES, modalidad: MODALIDADES, nivel_educativo: EDUCACION, nivel_ingles: INGLES };

function validar(e) {
  const errores = [];
  if (!e || typeof e !== 'object') return ['Envía los datos del candidato.'];
  Object.entries(OPCIONES).forEach(([campo, opciones]) => {
    if (!opciones.includes(e[campo])) errores.push(`"${campo}" debe ser uno de: ${opciones.join(', ')}.`);
  });
  Object.entries(NUMEROS).forEach(([campo, [min, max]]) => {
    const n = Number(e[campo]);
    if (e[campo] === '' || e[campo] === null || e[campo] === undefined || !Number.isFinite(n)) errores.push(`"${campo}" debe ser un número.`);
    else if (n < min || n > max) errores.push(`"${campo}" debe estar entre ${min} y ${max}.`);
  });
  if (errores.length === 0) {
    if (Number(e.habilidades_cumplidas) > Number(e.habilidades_requeridas)) {
      errores.push('Las habilidades cumplidas no pueden ser más que las requeridas.');
    }
    if (Number(e.anios_experiencia) > Number(e.edad) - 14) {
      errores.push('Los años de experiencia no son coherentes con la edad.');
    }
  }
  return errores;
}

// --- Predicción -----------------------------------------------------------------
function predecir(entrada) {
  const m = cargar();
  const x = vectorizar(entrada);
  let z = m.modelo.intercepto;
  const aportes = {};
  m.modelo.variables.forEach((v, j) => {
    const aporte = v.coeficiente * ((x[j] - v.media) / v.desviacion);
    z += aporte;
    // Sector y modalidad se muestran como un solo factor cada uno.
    let clave = v.etiqueta;
    if (v.nombre.startsWith('sector_')) clave = 'Sector';
    else if (v.nombre.startsWith('modalidad_')) clave = 'Modalidad';
    else if (v.etiquetaNo && x[j] === 0) clave = v.etiquetaNo;
    aportes[clave] = (aportes[clave] || 0) + aporte;
  });
  const probabilidad = 1 / (1 + Math.exp(-z));
  const factores = Object.entries(aportes)
    .map(([factor, aporte]) => ({ factor, aporte: Math.round(aporte * 100) / 100 }))
    .filter((f) => Math.abs(f.aporte) >= 0.05)
    .sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte));

  return {
    probabilidad: Math.round(probabilidad * 1000) / 10,
    seleccionado: probabilidad >= m.modelo.umbral ? 'Sí' : 'No',
    umbral: m.modelo.umbral * 100,
    suben: factores.filter((f) => f.aporte > 0).slice(0, 4),
    bajan: factores.filter((f) => f.aporte < 0).slice(0, 4),
    modelo: { tipo: m.modelo.tipo, exactitud: m.modelo.metricas.exactitud, auc: m.modelo.metricas.auc },
  };
}

module.exports = { resumen, validar, predecir, OPCIONES };
