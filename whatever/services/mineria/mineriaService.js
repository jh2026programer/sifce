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
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { SECTORES, MODALIDADES, EDUCACION, INGLES, vectorizar } = require('./codificacion');

const ARCHIVO_MODELO = path.join(__dirname, 'modelo_seleccion.json');
const RAIZ = path.resolve(__dirname, '..', '..', '..');

// Se lee del disco (no con require) para poder recargarlo después de
// ejecutar la minería en vivo sin reiniciar la API.
let modelo = null;
function cargar() {
  if (!modelo) modelo = JSON.parse(fs.readFileSync(ARCHIVO_MODELO, 'utf8'));
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
// Un dato desconocido (NaN) se reemplaza por el promedio del entrenamiento:
// su aporte es 0, no sube ni baja la probabilidad.
function predecir(entrada) {
  const m = cargar();
  const x = vectorizar(entrada);
  let z = m.modelo.intercepto;
  const aportes = {};
  m.modelo.variables.forEach((v, j) => {
    if (Number.isNaN(x[j])) return;
    const aporte = v.coeficiente * ((x[j] - v.media) / v.desviacion);
    z += aporte;
    // Sector y modalidad se muestran como un solo factor cada uno.
    let clave = v.etiqueta;
    if (v.nombre.startsWith('sector_')) clave = 'Sector';
    else if (v.nombre.startsWith('modalidad_')) clave = 'Modalidad';
    else if (v.etiquetaNo && x[j] === 0) clave = v.etiquetaNo;
    // "Inglés avanzado en tecnología" solo se explica en vacantes de
    // tecnología; en otros sectores su aporte cuenta, pero no se lista.
    if (v.nombre === 'ingles_avanzado_tecnologia' && entrada.sector !== 'Tecnología') return;
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

// --- Predicción automática a partir de una postulación real de SIFCE ----------------
const normalizar = (t) => (t || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const SECTOR_POR_PALABRA = [
  ['tecnolog', 'Tecnología'], ['software', 'Tecnología'], ['sistemas', 'Tecnología'],
  ['retail', 'Retail'], ['comercio', 'Retail'], ['ventas', 'Retail'],
  ['salud', 'Salud'], ['clinic', 'Salud'], ['hospital', 'Salud'],
  ['financ', 'Finanzas'], ['banc', 'Finanzas'], ['seguro', 'Finanzas'],
  ['manufactur', 'Manufactura'], ['industri', 'Manufactura'], ['produccion', 'Manufactura'],
  ['educa', 'Educación'], ['colegio', 'Educación'], ['universidad', 'Educación'],
  ['logist', 'Logística'], ['transporte', 'Logística'],
];
function sectorDe(texto) {
  const t = normalizar(texto);
  const par = SECTOR_POR_PALABRA.find(([palabra]) => t.includes(palabra));
  return par ? par[1] : null;
}

// El nivel educativo más alto según los títulos que registró el candidato.
function educacionDe(registros) {
  const niveles = (registros || []).map((r) => {
    const t = normalizar(`${r.degree} ${r.field_of_study || ''}`);
    if (/maestr|magister|master/.test(t)) return 5;
    if (/especializ/.test(t)) return 4;
    if (/tecnolog/.test(t)) return 2;
    if (/tecnic/.test(t)) return 1;
    if (/bachiller/.test(t)) return 0;
    return 3; // ingeniería, licenciatura, administración...: profesional
  });
  return niveles.length ? EDUCACION[Math.max(...niveles)] : null;
}

function inglesDe(idiomas) {
  const ingles = (idiomas || []).find((l) => /ingl|english/.test(normalizar(l.language)));
  if (!ingles) return 'Ninguno';
  const nivel = normalizar(ingles.level);
  if (nivel.includes('nativ')) return 'Nativo';
  if (nivel.includes('avanz')) return 'Avanzado';
  if (nivel.includes('intermed')) return 'Intermedio';
  if (nivel.includes('basic')) return 'Básico';
  return 'Ninguno';
}

// "$3.500.000 - $5.000.000 COP" → 4.250.000 (promedio de los valores del texto).
function salarioDe(texto) {
  const valores = (texto || '').match(/\d[\d.,]*/g) || [];
  const numeros = valores.map((v) => Number(v.replace(/[.,]/g, ''))).filter((n) => n >= 100000);
  return numeros.length ? numeros.reduce((a, b) => a + b, 0) / numeros.length : NaN;
}

const MODALIDAD = { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial' };

// Arma la entrada del modelo con lo que SIFCE sabe de la postulación. Lo que
// SIFCE no registra (edad, salario aspirado) queda desconocido y se informa.
function entradaDesdePostulacion({ sectorEmpresa, vacante, perfil, resultadoIa, compatibilidad }) {
  const supuestos = [
    'Edad: SIFCE no la registra; no influye en la predicción.',
    'Salario aspirado: SIFCE no lo registra; se asume que el candidato acepta lo ofrecido.',
  ];
  const sector = sectorDe(sectorEmpresa);
  if (!sector) supuestos.push(`Sector "${sectorEmpresa || 'sin definir'}" no reconocido; no influye en la predicción.`);
  const educacion = educacionDe(perfil.education);
  if (!educacion) supuestos.push('Sin formación registrada; el nivel educativo no influye en la predicción.');
  const salarioOfrecido = salarioDe(vacante.salary);

  return {
    entrada: {
      sector,
      modalidad: MODALIDAD[normalizar(vacante.modality)] || null,
      edad: NaN,
      nivel_educativo: educacion,
      anios_experiencia: (perfil.experience || []).reduce((suma, e) => suma + (Number(e.years) || 0), 0),
      experiencia_requerida: Number(vacante.min_experience_years) || 0,
      // El puntaje de habilidades de la IA ya es el % de habilidades cumplidas.
      habilidades_requeridas: 100,
      habilidades_cumplidas: Number(resultadoIa.skillsScore),
      nivel_ingles: inglesDe(perfil.languages),
      certificaciones: (perfil.certifications || []).length,
      salario_ofrecido: salarioOfrecido,
      // Sin salario aspirado se asume que acepta lo ofrecido (brecha 0).
      salario_aspirado: salarioOfrecido,
      compatibilidad: Number(compatibilidad),
    },
    supuestos,
  };
}

function predecirPostulacion(datos) {
  const { entrada, supuestos } = entradaDesdePostulacion(datos);
  return { ...predecir(entrada), supuestos, calculada: new Date().toISOString() };
}

// --- Minería en vivo: recolección + depuración + análisis con los 100.000 datos ----
const SCRIPTS = [
  { paso: 'Recolección: generar 100.000 postulaciones', script: 'mineria-datos/generar_dataset.js' },
  { paso: 'Depuración, análisis y entrenamiento del modelo', script: 'mineria-datos/entrenar_modelo.js' },
];
let ejecutando = false;

function correr(script) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [path.join(RAIZ, script)],
      { cwd: RAIZ, timeout: 180000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout))
    );
  });
}

// En la imagen de Docker no van los scripts de minería: ahí no se puede ejecutar en vivo.
function mineriaEnVivoDisponible() {
  return SCRIPTS.every((s) => fs.existsSync(path.join(RAIZ, s.script)));
}

async function ejecutarEnVivo() {
  if (ejecutando) return { ocupado: true };
  ejecutando = true;
  try {
    const pasos = [];
    for (const { paso, script } of SCRIPTS) {
      const inicio = Date.now();
      // eslint-disable-next-line no-await-in-loop
      const salida = await correr(script);
      // Sin los códigos de color de la consola (\x1b[33m...), que en la página se verían como basura.
      // eslint-disable-next-line no-control-regex
      const limpia = salida.replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n');
      pasos.push({ paso, segundos: Math.round((Date.now() - inicio) / 100) / 10, salida: limpia });
    }
    modelo = null; // vuelve a leer el modelo recién entrenado
    return { pasos, resumen: resumen() };
  } finally {
    ejecutando = false;
  }
}

module.exports = {
  resumen, validar, predecir, OPCIONES, predecirPostulacion, entradaDesdePostulacion,
  ejecutarEnVivo, mineriaEnVivoDisponible,
};
