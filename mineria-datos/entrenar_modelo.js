// ============================================================================
// Minería de datos de SIFCE · pasos 2, 3 y 4 en código (para la página web).
//
// Hace con el dataset lo mismo que el diagrama de Orange y deja el resultado
// listo para que SIFCE lo muestre y lo use para predecir:
//
//   2. Depuración   duplicados, categorías mal escritas, datos erróneos,
//                   atípicos, filas sin variable objetivo e imputación
//                   (mismas reglas que las fórmulas de Orange, README paso 2).
//   3. Análisis     tasas de selección por variable, embudo, estacionalidad,
//                   regresión logística (70 % entrenamiento / 30 % prueba)
//                   y k-Means para encontrar perfiles de candidato.
//   4. Resultado    whatever/services/mineria/modelo_seleccion.json
//                   (lo lee la API: GET /mineria/resumen y POST /mineria/prediccion).
//
// Uso (desde la raíz):  node mineria-datos/entrenar_modelo.js
// Requiere haber generado antes el dataset (generar_dataset.js).
// ============================================================================
const fs = require('fs');
const path = require('path');
const { VARIABLES, EDUCACION, INGLES, SECTORES, vectorizar } = require('../whatever/services/mineria/codificacion');

const DATOS = path.join(__dirname, 'datos');
const SALIDA = path.join(__dirname, '..', 'whatever', 'services', 'mineria', 'modelo_seleccion.json');

// Azar reproducible (mismo algoritmo que el generador).
let estado = 4242;
function azar() {
  estado = (estado + 0x6d2b79f5) | 0;
  let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const r2 = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const pct = (a, b) => (b ? r2((a / b) * 100, 1) : 0);

// --- Lectura -------------------------------------------------------------------
function leerCsv(archivo) {
  const lineas = fs.readFileSync(archivo, 'utf8').trim().split(/\r?\n/);
  const cab = lineas[0].split(',');
  return { cab, lineas: lineas.slice(1) };
}
const { cab, lineas } = leerCsv(path.join(DATOS, 'postulaciones_sifce.csv'));
const control = new Map(
  leerCsv(path.join(DATOS, 'control_calidad.csv')).lineas.map((l) => {
    const [, id, , perfil] = l.split(',');
    return [id, perfil];
  })
);

// =============================================================================
// 2. DEPURACIÓN
// =============================================================================
const pasos = [{ paso: 'Datos recolectados', filas: lineas.length }];

// 2.1 Duplicados exactos.
const unicas = [...new Set(lineas)];
pasos.push({ paso: 'Sin duplicados', filas: unicas.length });

// 2.2 Categorías mal escritas (Edit Domain en Orange).
const CORRECCIONES = {
  ciudad: { BOGOTÁ: 'Bogotá', bogota: 'Bogotá', Medellin: 'Medellín', medellín: 'Medellín', 'Cali.': 'Cali', Barranquila: 'Barranquilla' },
  modalidad: { PRESENCIAL: 'Presencial', Remotoo: 'Remoto', remoto: 'Remoto', hibrido: 'Híbrido' },
  nivel_ingles: { Avanzdo: 'Avanzado', basico: 'Básico', intermedio: 'Intermedio', B1: 'Intermedio' },
};
const NUMERICAS = [
  'edad', 'anios_experiencia', 'experiencia_requerida', 'habilidades_requeridas', 'habilidades_cumplidas',
  'certificaciones', 'salario_ofrecido', 'salario_aspirado', 'paginas_cv', 'palabras_cv', 'puntaje_formacion',
  'puntaje_experiencia', 'puntaje_habilidades', 'puntaje_idiomas', 'compatibilidad', 'tiempo_analisis_ia_seg',
  'dias_en_proceso',
];
let corregidas = 0;
const filas = unicas.map((l) => {
  const v = l.split(',');
  const f = {};
  cab.forEach((c, i) => {
    let x = (v[i] ?? '').trim();
    if (CORRECCIONES[c] && CORRECCIONES[c][x]) { x = CORRECCIONES[c][x]; corregidas++; }
    f[c] = NUMERICAS.includes(c) ? (x === '' ? NaN : Number(x)) : x;
  });
  return f;
});

// 2.3 Datos erróneos (fórmula "dato_erroneo" de Orange). Comparar con un vacío
// da falso, igual que en Orange; una fecha vacía sí se descarta (no se imputa).
const fueraDeRango = (x, a, b) => x < a || x > b;
function erroneo(f) {
  return (
    fueraDeRango(f.edad, 18, 75) || f.anios_experiencia < 0 || f.anios_experiencia > f.edad - 14 ||
    fueraDeRango(f.compatibilidad, 0, 100) || f.puntaje_habilidades > 100 || f.salario_aspirado < 500000 ||
    f.habilidades_cumplidas > f.habilidades_requeridas || f.fecha_postulacion === '' ||
    f.fecha_postulacion < '2025-01-01' || f.fecha_postulacion > '2026-09-30' ||
    (f.seleccionado === 'Sí' && f.estado_final !== 'Seleccionado') ||
    (f.seleccionado === 'No' && f.estado_final === 'Seleccionado')
  );
}
// 2.4 Valores atípicos (fórmula "valor_atipico" de Orange).
function atipico(f) {
  return (
    f.anios_experiencia > 35 || f.palabras_cv > 5000 || f.paginas_cv > 8 || f.certificaciones > 12 ||
    f.tiempo_analisis_ia_seg > 40 || f.dias_en_proceso > 60 || f.salario_aspirado > 2.5 * f.salario_ofrecido
  );
}
const quitadas = { erroneos: 0, atipicos: 0, sinObjetivo: 0 };
const limpias = filas.filter((f) => {
  if (erroneo(f)) { quitadas.erroneos++; return false; }
  if (atipico(f)) { quitadas.atipicos++; return false; }
  if (f.seleccionado === '') { quitadas.sinObjetivo++; return false; }
  return true;
});
pasos.push({ paso: 'Sin errores ni atípicos', filas: limpias.length });

// 2.5 Imputación: promedio en números, valor más frecuente en categorías.
let imputadas = 0;
cab.forEach((c) => {
  if (c === 'id_postulacion' || c === 'seleccionado') return;
  if (NUMERICAS.includes(c)) {
    const vals = limpias.map((f) => f[c]).filter((x) => !Number.isNaN(x));
    const media = vals.reduce((s, x) => s + x, 0) / vals.length;
    limpias.forEach((f) => { if (Number.isNaN(f[c])) { f[c] = r2(media); imputadas++; } });
  } else {
    const cuenta = {};
    limpias.forEach((f) => { if (f[c] !== '') cuenta[f[c]] = (cuenta[f[c]] || 0) + 1; });
    const moda = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0];
    limpias.forEach((f) => { if (f[c] === '') { f[c] = moda; imputadas++; } });
  }
});
pasos.push({ paso: 'Vacíos imputados', filas: limpias.length });

// =============================================================================
// 3. ANÁLISIS
// =============================================================================
const N = limpias.length;
const esSi = (f) => f.seleccionado === 'Sí';
const totalSel = limpias.filter(esSi).length;

function tasaPor(clave, orden, filtro = () => true) {
  const g = {};
  limpias.filter(filtro).forEach((f) => {
    const k = clave(f);
    g[k] = g[k] || { n: 0, s: 0 };
    g[k].n++;
    if (esSi(f)) g[k].s++;
  });
  return (orden || Object.keys(g)).filter((k) => g[k]).map((k) => ({ grupo: k, postulaciones: g[k].n, tasa_seleccion: pct(g[k].s, g[k].n) }));
}
const brechaDe = (f) => f.salario_aspirado / f.salario_ofrecido - 1;
const etiquetaBrecha = (f) => (brechaDe(f) > 0.3 ? 'Pide más del 30 %' : 'Pide hasta 30 %');

const analisis = {
  por_compatibilidad: tasaPor((f) => f.nivel_compatibilidad, ['Baja', 'Media', 'Alta']),
  ingles_por_sector: INGLES.map((ing) => {
    const t = (filtro) => {
      const g = limpias.filter((f) => f.nivel_ingles === ing && filtro(f));
      return pct(g.filter(esSi).length, g.length);
    };
    return { nivel_ingles: ing, tecnologia: t((f) => f.sector === 'Tecnología'), otros_sectores: t((f) => f.sector !== 'Tecnología') };
  }),
  por_brecha_salarial: ['Pide hasta 30 %', 'Pide más del 30 %'].map((k) => {
    const g = limpias.filter((f) => etiquetaBrecha(f) === k);
    return {
      grupo: k,
      postulaciones: g.length,
      tasa_seleccion: pct(g.filter(esSi).length, g.length),
      tasa_retiro: pct(g.filter((f) => f.estado_final === 'Retirado').length, g.length),
    };
  }),
  por_sector: tasaPor((f) => f.sector, SECTORES),
  por_educacion: tasaPor((f) => f.nivel_educativo, EDUCACION),
  embudo: ['Postulado', 'Revisión', 'Entrevista', 'Prueba técnica', 'Oferta'].map((etapa, i, todas) => ({
    etapa,
    // Cuántos llegaron AL MENOS a esta etapa.
    candidatos: limpias.filter((f) => todas.indexOf(f.etapa_maxima) >= i).length,
  })),
  por_mes: (() => {
    const g = {};
    limpias.forEach((f) => { const m = f.fecha_postulacion.slice(0, 7); g[m] = (g[m] || 0) + 1; });
    return Object.keys(g).sort().map((mes) => ({ mes, postulaciones: g[mes] }));
  })(),
};

// --- Regresión logística --------------------------------------------------------
const X = limpias.map((f) => vectorizar(f));
const Y = limpias.map((f) => (esSi(f) ? 1 : 0));
const orden = [...Array(N).keys()];
for (let i = N - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [orden[i], orden[j]] = [orden[j], orden[i]]; }
const corte = Math.floor(N * 0.7);
const ent = orden.slice(0, corte);
const pru = orden.slice(corte);
const P = VARIABLES.length;

// Estandarización con media y desviación del conjunto de entrenamiento.
const media = new Array(P).fill(0);
const desv = new Array(P).fill(0);
ent.forEach((i) => X[i].forEach((x, j) => { media[j] += x / ent.length; }));
ent.forEach((i) => X[i].forEach((x, j) => { desv[j] += (x - media[j]) ** 2 / ent.length; }));
for (let j = 0; j < P; j++) desv[j] = Math.sqrt(desv[j]) || 1;
const Z = X.map((fila) => fila.map((x, j) => (x - media[j]) / desv[j]));

const sigmoide = (z) => 1 / (1 + Math.exp(-z));
let w = new Array(P).fill(0);
let b = 0;
const LAMBDA = 0.001;
const TASA = 0.5;
for (let it = 0; it < 600; it++) {
  const gw = new Array(P).fill(0);
  let gb = 0;
  for (const i of ent) {
    const zi = Z[i];
    let s = b;
    for (let j = 0; j < P; j++) s += w[j] * zi[j];
    const err = sigmoide(s) - Y[i];
    gb += err;
    for (let j = 0; j < P; j++) gw[j] += err * zi[j];
  }
  b -= (TASA * gb) / ent.length;
  w = w.map((wj, j) => wj - TASA * (gw[j] / ent.length + LAMBDA * wj));
}
const probar = (i) => { let s = b; for (let j = 0; j < P; j++) s += w[j] * Z[i][j]; return sigmoide(s); };

// Evaluación en el 30 % de prueba (datos que el modelo nunca vio).
const UMBRAL = 0.5;
const probs = pru.map((i) => ({ p: probar(i), y: Y[i] }));
const matriz = { vp: 0, fp: 0, vn: 0, fn: 0 };
probs.forEach(({ p, y }) => {
  const pred = p >= UMBRAL ? 1 : 0;
  if (pred && y) matriz.vp++; else if (pred && !y) matriz.fp++; else if (!pred && !y) matriz.vn++; else matriz.fn++;
});
const exactitud = (matriz.vp + matriz.vn) / probs.length;
const precision = matriz.vp / (matriz.vp + matriz.fp);
const sensibilidad = matriz.vp / (matriz.vp + matriz.fn);
const f1 = (2 * precision * sensibilidad) / (precision + sensibilidad);
// AUC: probabilidad de que un seleccionado reciba más puntaje que un no seleccionado.
const ordenados = [...probs].sort((a, b2) => a.p - b2.p);
let rangos = 0;
let pos = 0;
ordenados.forEach((o, k) => { if (o.y) { rangos += k + 1; pos++; } });
const neg = probs.length - pos;
const auc = (rangos - (pos * (pos + 1)) / 2) / (pos * neg);
const roc = [];
for (let u = 1; u >= -0.0001; u -= 0.05) {
  const vp = probs.filter((o) => o.p >= u && o.y).length;
  const fp = probs.filter((o) => o.p >= u && !o.y).length;
  roc.push({ umbral: r2(Math.max(u, 0)), tasa_falsos_positivos: r2(fp / neg, 3), tasa_verdaderos_positivos: r2(vp / pos, 3) });
}
const basePrueba = probs.filter((o) => !o.y).length / probs.length;

// =============================================================================
// Patrones de comportamiento: k-Means (k = 4) sobre el perfil del candidato
// =============================================================================
const RASGOS = [
  (f) => f.edad,
  (f) => f.anios_experiencia,
  (f) => EDUCACION.indexOf(f.nivel_educativo),
  (f) => INGLES.indexOf(f.nivel_ingles),
  (f) => f.certificaciones,
];
const R = limpias.map((f) => RASGOS.map((g) => g(f)));
const rm = RASGOS.map((_, j) => R.reduce((s, x) => s + x[j], 0) / N);
const rd = RASGOS.map((_, j) => Math.sqrt(R.reduce((s, x) => s + (x[j] - rm[j]) ** 2, 0) / N) || 1);
const RZ = R.map((x) => x.map((v, j) => (v - rm[j]) / rd[j]));
const dist2 = (a, c) => a.reduce((s, v, j) => s + (v - c[j]) ** 2, 0);
const K = 4;
// k-means++ para elegir los centros iniciales.
const centros = [RZ[Math.floor(azar() * N)]];
while (centros.length < K) {
  const d = RZ.map((x) => Math.min(...centros.map((c) => dist2(x, c))));
  let r = azar() * d.reduce((s, x) => s + x, 0);
  let i = 0;
  while ((r -= d[i]) > 0) i++;
  centros.push(RZ[i]);
}
let grupo = new Array(N).fill(0);
for (let it = 0; it < 40; it++) {
  grupo = RZ.map((x) => { let m = 0; for (let c = 1; c < K; c++) if (dist2(x, centros[c]) < dist2(x, centros[m])) m = c; return m; });
  for (let c = 0; c < K; c++) {
    const miembros = RZ.filter((_, i) => grupo[i] === c);
    centros[c] = RASGOS.map((_, j) => miembros.reduce((s, x) => s + x[j], 0) / miembros.length);
  }
}
const resumenGrupos = [...Array(K).keys()].map((c) => {
  const g = limpias.filter((_, i) => grupo[i] === c);
  const prom = (h) => r2(g.reduce((s, f) => s + h(f), 0) / g.length, 1);
  const moda = (h) => { const m = {}; g.forEach((f) => { m[h(f)] = (m[h(f)] || 0) + 1; }); return Object.entries(m).sort((a, b2) => b2[1] - a[1])[0][0]; };
  const perfilReal = moda((f) => control.get(f.id_postulacion));
  return {
    postulaciones: g.length,
    edad_promedio: prom((f) => f.edad),
    experiencia_promedio: prom((f) => f.anios_experiencia),
    certificaciones_promedio: prom((f) => f.certificaciones),
    educacion_frecuente: moda((f) => f.nivel_educativo),
    ingles_frecuente: moda((f) => f.nivel_ingles),
    tasa_seleccion: pct(g.filter(esSi).length, g.length),
    tasa_retiro: pct(g.filter((f) => f.estado_final === 'Retirado').length, g.length),
    perfil_real_mayoritario: perfilReal,
    coincidencia_perfil_real: pct(g.filter((f) => control.get(f.id_postulacion) === perfilReal).length, g.length),
  };
});
// Nombre de cada grupo según sus rasgos (no según el archivo de control).
const porExp = [...resumenGrupos].sort((a, b2) => a.experiencia_promedio - b2.experiencia_promedio);
const nombres = new Map();
nombres.set(porExp.at(-1), 'Experimentados');
const jovenes = porExp.slice(0, 3).sort((a, b2) => a.edad_promedio - b2.edad_promedio);
nombres.set(jovenes[0], 'Recién egresados');
const restantes = porExp.slice(0, 3).filter((g) => g !== jovenes[0]);
const reconv = restantes.sort((a, b2) => (b2.edad_promedio - b2.experiencia_promedio) - (a.edad_promedio - a.experiencia_promedio))[0];
nombres.set(reconv, 'Cambio de carrera');
resumenGrupos.forEach((g) => { if (!nombres.has(g)) nombres.set(g, 'En crecimiento'); });
const perfiles = resumenGrupos
  .map((g) => ({ perfil: nombres.get(g), ...g }))
  .sort((a, b2) => b2.postulaciones - a.postulaciones);

// =============================================================================
// 4. RESULTADO
// =============================================================================
const resultado = {
  generado: new Date().toISOString(),
  fuente: 'Dataset sintético de minería de datos (mineria-datos/postulaciones_sifce.csv)',
  depuracion: {
    pasos,
    duplicados: lineas.length - unicas.length,
    categorias_corregidas: corregidas,
    erroneos_eliminados: quitadas.erroneos,
    atipicos_eliminados: quitadas.atipicos,
    sin_objetivo_eliminados: quitadas.sinObjetivo,
    valores_imputados: imputadas,
  },
  resumen: {
    postulaciones_analizadas: N,
    seleccionados: totalSel,
    tasa_seleccion: pct(totalSel, N),
  },
  analisis,
  modelo: {
    tipo: 'Regresión logística (L2)',
    entrenamiento: ent.length,
    prueba: pru.length,
    umbral: UMBRAL,
    intercepto: b,
    variables: VARIABLES.map((v, j) => ({ ...v, media: media[j], desviacion: desv[j], coeficiente: w[j] })),
    metricas: {
      exactitud: r2(exactitud * 100, 1),
      exactitud_sin_modelo: r2(basePrueba * 100, 1),
      precision: r2(precision * 100, 1),
      sensibilidad: r2(sensibilidad * 100, 1),
      f1: r2(f1 * 100, 1),
      auc: r2(auc, 3),
    },
    matriz_confusion: matriz,
    roc,
  },
  perfiles,
};
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(resultado, null, 2) + '\n');

console.log('Depuración:', pasos.map((p) => `${p.paso} ${p.filas}`).join(' → '));
console.log('Quitadas:', quitadas, '| categorías corregidas', corregidas, '| valores imputados', imputadas);
console.log('Modelo:', resultado.modelo.metricas, 'matriz', matriz);
console.log('Perfiles:', perfiles.map((g) => `${g.perfil} n=${g.postulaciones} sel=${g.tasa_seleccion}% (real: ${g.perfil_real_mayoritario} ${g.coincidencia_perfil_real}%)`).join(' | '));
console.log('Guardado en', path.relative(process.cwd(), SALIDA));
