// ============================================================================
// Minería de datos de SIFCE · Paso 1: RECOLECCIÓN DE DATOS
//
// Genera un dataset SINTÉTICO de 100.000 postulaciones, con la misma forma que
// los datos que produce SIFCE (candidato, vacante, puntajes de la IA,
// compatibilidad y resultado del proceso de selección), y con suciedad
// controlada para practicar la depuración:
//
//   70.000  filas limpias                       (70 %)
//   10.000  filas con valores atípicos (outliers) (10 %)
//    8.000  filas con celdas vacías              ( 8 %)  \
//    7.000  filas con datos erróneos             ( 7 %)   > 20 % de datos "sucios"
//    5.000  filas duplicadas (copias exactas)    ( 5 %)  /
//  -------
//  100.000  filas en total
//
// Es reproducible: la misma SEMILLA produce siempre el mismo archivo.
// Uso (desde la raíz del proyecto):  node mineria-datos/generar_dataset.js
// Salidas en mineria-datos/datos/:
//   postulaciones_sifce.csv          el dataset para Orange
//   control_calidad.csv              qué anomalía se sembró en cada fila y el perfil real
//                                    del candidato (para verificar la depuración y el clustering)
// ============================================================================
const fs = require('fs');
const path = require('path');

const SEMILLA = 20261029;
const TOTAL = 100000;
const CANT = { atipicos: 10000, vacios: 8000, erroneos: 7000, duplicados: 5000 };
const UNICAS = TOTAL - CANT.duplicados; // 95.000 filas distintas

// --- Azar reproducible (mulberry32) ------------------------------------------
let estado = SEMILLA;
function azar() {
  estado = (estado + 0x6d2b79f5) | 0;
  let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + azar() * (b - a);
const entero = (a, b) => Math.floor(entre(a, b + 1));
const normal = (media, desv) => {
  const u = 1 - azar();
  const v = azar();
  return media + desv * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const limitar = (x, a, b) => Math.max(a, Math.min(b, x));
const redondear = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;
function elegir(opciones) {
  // opciones: [[valor, peso], ...]
  const total = opciones.reduce((s, o) => s + o[1], 0);
  let r = azar() * total;
  for (const [valor, peso] of opciones) {
    r -= peso;
    if (r <= 0) return valor;
  }
  return opciones.at(-1)[0];
}
function barajar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// --- Catálogos ---------------------------------------------------------------
const EDUCACION = ['Bachiller', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización', 'Maestría'];
const INGLES = ['Ninguno', 'Básico', 'Intermedio', 'Avanzado', 'Nativo'];
const ETAPAS = ['Postulado', 'Revisión', 'Entrevista', 'Prueba técnica', 'Oferta'];
const CIUDADES = [['Bogotá', 32], ['Medellín', 20], ['Cali', 14], ['Bucaramanga', 12], ['Barranquilla', 12], ['Cartagena', 10]];

// Empresas: sector, peso (cuántas postulaciones recibe) y pesos de evaluación
// de la empresa (formación / experiencia / habilidades / idiomas), como en SIFCE.
const EMPRESAS = [
  { nombre: 'TechNova Soluciones', sector: 'Tecnología', peso: 18, pesos: [20, 25, 40, 15] },
  { nombre: 'DataSur Analytics', sector: 'Tecnología', peso: 12, pesos: [20, 25, 40, 15] },
  { nombre: 'Grupo Andino Retail', sector: 'Retail', peso: 16, pesos: [15, 35, 35, 15] },
  { nombre: 'Clínica Horizonte', sector: 'Salud', peso: 12, pesos: [40, 30, 20, 10] },
  { nombre: 'Banco Cordillera', sector: 'Finanzas', peso: 12, pesos: [30, 30, 25, 15] },
  { nombre: 'Manufacturas del Valle', sector: 'Manufactura', peso: 11, pesos: [20, 40, 30, 10] },
  { nombre: 'Colegio Nueva Era', sector: 'Educación', peso: 8, pesos: [40, 30, 20, 10] },
  { nombre: 'LogiExpress', sector: 'Logística', peso: 11, pesos: [15, 40, 35, 10] },
];

// Cargos por sector: salario base (COP), experiencia requerida, educación
// requerida (índice en EDUCACION), modalidades posibles, idioma requerido
// (índice en INGLES) y cuántas habilidades pide la vacante.
const CARGOS = {
  Tecnología: [
    { cargo: 'Desarrollador Backend', salario: 6500000, exp: [2, 5], edu: 3, mod: [['Remoto', 50], ['Híbrido', 40], ['Presencial', 10]], ingles: 2, hab: [5, 8] },
    { cargo: 'Desarrollador Frontend', salario: 5800000, exp: [1, 4], edu: 3, mod: [['Remoto', 50], ['Híbrido', 40], ['Presencial', 10]], ingles: 2, hab: [5, 8] },
    { cargo: 'Analista de Datos', salario: 5200000, exp: [1, 3], edu: 3, mod: [['Remoto', 35], ['Híbrido', 50], ['Presencial', 15]], ingles: 2, hab: [4, 7] },
    { cargo: 'QA Tester', salario: 4200000, exp: [1, 3], edu: 2, mod: [['Remoto', 40], ['Híbrido', 45], ['Presencial', 15]], ingles: 2, hab: [4, 6] },
    { cargo: 'Ingeniero DevOps', salario: 7800000, exp: [3, 6], edu: 3, mod: [['Remoto', 55], ['Híbrido', 40], ['Presencial', 5]], ingles: 3, hab: [5, 8] },
  ],
  Retail: [
    { cargo: 'Asesor de Ventas', salario: 1800000, exp: [0, 1], edu: 0, mod: [['Presencial', 100]], ingles: 0, hab: [3, 4] },
    { cargo: 'Jefe de Tienda', salario: 3800000, exp: [3, 5], edu: 2, mod: [['Presencial', 100]], ingles: 1, hab: [4, 6] },
    { cargo: 'Analista de Inventarios', salario: 3000000, exp: [1, 3], edu: 2, mod: [['Presencial', 70], ['Híbrido', 30]], ingles: 1, hab: [3, 5] },
  ],
  Salud: [
    { cargo: 'Enfermero(a)', salario: 3400000, exp: [1, 3], edu: 3, mod: [['Presencial', 100]], ingles: 0, hab: [4, 6] },
    { cargo: 'Médico General', salario: 7500000, exp: [1, 4], edu: 3, mod: [['Presencial', 100]], ingles: 1, hab: [4, 7] },
    { cargo: 'Auxiliar Administrativo', salario: 2000000, exp: [0, 2], edu: 1, mod: [['Presencial', 80], ['Híbrido', 20]], ingles: 0, hab: [3, 4] },
  ],
  Finanzas: [
    { cargo: 'Analista Financiero', salario: 5000000, exp: [2, 4], edu: 3, mod: [['Híbrido', 60], ['Presencial', 30], ['Remoto', 10]], ingles: 2, hab: [4, 7] },
    { cargo: 'Asesor Comercial', salario: 2600000, exp: [0, 2], edu: 1, mod: [['Presencial', 70], ['Híbrido', 30]], ingles: 1, hab: [3, 5] },
    { cargo: 'Auditor', salario: 6200000, exp: [3, 6], edu: 4, mod: [['Híbrido', 50], ['Presencial', 50]], ingles: 2, hab: [4, 7] },
  ],
  Manufactura: [
    { cargo: 'Operario de Producción', salario: 1700000, exp: [0, 1], edu: 0, mod: [['Presencial', 100]], ingles: 0, hab: [2, 4] },
    { cargo: 'Supervisor de Producción', salario: 3900000, exp: [3, 6], edu: 2, mod: [['Presencial', 100]], ingles: 1, hab: [4, 6] },
    { cargo: 'Ingeniero de Procesos', salario: 5600000, exp: [2, 5], edu: 3, mod: [['Presencial', 70], ['Híbrido', 30]], ingles: 2, hab: [4, 7] },
  ],
  Educación: [
    { cargo: 'Docente', salario: 3200000, exp: [1, 3], edu: 3, mod: [['Presencial', 85], ['Híbrido', 15]], ingles: 1, hab: [3, 5] },
    { cargo: 'Coordinador Académico', salario: 4800000, exp: [4, 7], edu: 4, mod: [['Presencial', 80], ['Híbrido', 20]], ingles: 2, hab: [4, 6] },
  ],
  Logística: [
    { cargo: 'Auxiliar de Bodega', salario: 1700000, exp: [0, 1], edu: 0, mod: [['Presencial', 100]], ingles: 0, hab: [2, 3] },
    { cargo: 'Conductor', salario: 2300000, exp: [1, 3], edu: 0, mod: [['Presencial', 100]], ingles: 0, hab: [2, 4] },
    { cargo: 'Coordinador Logístico', salario: 4500000, exp: [3, 5], edu: 3, mod: [['Presencial', 60], ['Híbrido', 40]], ingles: 2, hab: [4, 6] },
  ],
};

// Perfiles de candidato (de aquí salen los grupos que debe encontrar el clustering).
const PERFILES = [
  { perfil: 'Junior', peso: 35, edad: [18, 26], exp: [0, 3], edu: [[0, 15], [1, 20], [2, 25], [3, 40]], ingles: [[0, 15], [1, 35], [2, 35], [3, 15]] },
  { perfil: 'Semisenior', peso: 30, edad: [25, 35], exp: [3, 8], edu: [[1, 10], [2, 20], [3, 50], [4, 20]], ingles: [[0, 8], [1, 25], [2, 40], [3, 22], [4, 5]] },
  { perfil: 'Senior', peso: 20, edad: [33, 58], exp: [8, 25], edu: [[2, 10], [3, 40], [4, 35], [5, 15]], ingles: [[0, 5], [1, 15], [2, 35], [3, 35], [4, 10]] },
  { perfil: 'Reconversión', peso: 15, edad: [35, 55], exp: [0, 3], edu: [[0, 25], [1, 30], [2, 25], [3, 20]], ingles: [[0, 35], [1, 40], [2, 20], [3, 5]] },
];

// Fechas entre ene-2025 y sep-2026, con más postulaciones en ene-mar y jul-ago.
const DIA = 86400000;
const INICIO = Date.UTC(2025, 0, 1);
const FIN = Date.UTC(2026, 8, 30);
function fechaPostulacion() {
  for (;;) {
    const t = INICIO + Math.floor(azar() * ((FIN - INICIO) / DIA + 1)) * DIA;
    const mes = new Date(t).getUTCMonth();
    const peso = [0, 1, 2, 6, 7].includes(mes) ? 1 : 0.6;
    if (azar() < peso) return new Date(t).toISOString().slice(0, 10);
  }
}

// Perfil real de cada candidato: NO va en el dataset (el clustering debe
// descubrirlo); se guarda en el archivo de control para verificar.
const perfiles = new Map();

// --- Una postulación limpia --------------------------------------------------
function postulacion(n) {
  const empresa = elegir(EMPRESAS.map((e) => [e, e.peso]));
  const vac = CARGOS[empresa.sector][entero(0, CARGOS[empresa.sector].length - 1)];
  const per = elegir(PERFILES.map((p) => [p, p.peso]));

  const edad = entero(per.edad[0], per.edad[1]);
  const anios = limitar(redondear(entre(per.exp[0], per.exp[1]), 1), 0, edad - 16);
  const edu = elegir(per.edu);
  const ingles = elegir(per.ingles);
  const sectorTec = empresa.sector === 'Tecnología';
  const certificaciones = limitar(Math.round(normal(sectorTec ? 2.5 : 1.2, 1.3) + (per.perfil === 'Senior' ? 1 : 0)), 0, 10);
  const expReq = entero(vac.exp[0], vac.exp[1]);
  const habReq = entero(vac.hab[0], vac.hab[1]);
  const pHab = limitar(0.35 + 0.06 * certificaciones + 0.02 * Math.min(anios, 10) + (per.perfil === 'Reconversión' ? -0.15 : 0), 0.05, 0.95);
  let habCumple = 0;
  for (let i = 0; i < habReq; i++) if (azar() < pHab) habCumple++;

  // Puntajes 0-100 de la IA (formación, experiencia, habilidades, idiomas).
  const difEdu = edu - vac.edu;
  const pForm = limitar(normal(difEdu >= 0 ? 92 : difEdu === -1 ? 62 : 30, 6), 0, 100);
  const pExp = limitar(normal(expReq === 0 ? 95 : Math.min(100, (anios / expReq) * 100), 5), 0, 100);
  const pHabP = limitar(normal((habCumple / habReq) * 100, 4), 0, 100);
  const difIng = ingles - vac.ingles;
  const pIdi = limitar(normal(difIng >= 0 ? 95 : difIng === -1 ? 60 : 25, 6), 0, 100);
  const [wF, wE, wH, wI] = empresa.pesos;
  const compat = (pForm * wF + pExp * wE + pHabP * wH + pIdi * wI) / 100;
  const nivel = compat >= 75 ? 'Alta' : compat >= 50 ? 'Media' : 'Baja';

  // Salarios: lo que ofrece la vacante y lo que pide el candidato.
  const salarioOfrecido = Math.round(vac.salario * entre(0.9, 1.15) / 10000) * 10000;
  const factor = entre(0.85, 1.2) + 0.012 * anios + (per.perfil === 'Senior' ? 0.05 : 0) + (azar() < 0.12 ? entre(0.2, 0.5) : 0);
  const salarioAspirado = Math.round(salarioOfrecido * factor / 10000) * 10000;
  const brecha = (salarioAspirado - salarioOfrecido) / salarioOfrecido;

  // Probabilidad de ser seleccionado (los patrones que la minería debe encontrar).
  let z = -10.2 + 0.115 * compat;
  if (sectorTec && ingles >= 3) z += 1.1; // inglés avanzado pesa en tecnología
  if (certificaciones >= 3) z += 0.5;
  if (brecha > 0.3) z -= 2.4; // pedir mucho más de lo ofrecido baja la probabilidad
  if (per.perfil === 'Reconversión') z -= 0.4;
  const seleccionado = azar() < 1 / (1 + Math.exp(-z));

  // Hasta qué etapa llegó y cómo terminó.
  let etapa;
  let estado;
  if (seleccionado) {
    etapa = 'Oferta';
    estado = 'Seleccionado';
  } else {
    const avance = limitar(Math.floor(compat / 25 + normal(0, 0.7)), 0, 3);
    etapa = ETAPAS[avance];
    estado = brecha > 0.3 && azar() < 0.45 ? 'Retirado' : azar() < 0.06 ? 'Retirado' : 'Rechazado';
  }
  const diasPorEtapa = { Postulado: [1, 7], Revisión: [3, 15], Entrevista: [10, 30], 'Prueba técnica': [15, 40], Oferta: [20, 50] };
  const dias = entero(...diasPorEtapa[etapa]);

  const paginas = limitar(entero(1, 2) + (anios > 8 ? 1 : 0) + (azar() < 0.15 ? 1 : 0), 1, 5);
  const palabras = Math.round(paginas * entre(280, 420) + anios * 15);
  const tiempoIa = redondear(limitar(Math.exp(normal(1.6, 0.35)) + palabras / 900, 1, 30), 2);

  perfiles.set(`P${String(n).padStart(6, '0')}`, per.perfil);
  return {
    id_postulacion: `P${String(n).padStart(6, '0')}`,
    fecha_postulacion: fechaPostulacion(),
    empresa: empresa.nombre,
    sector: empresa.sector,
    cargo: vac.cargo,
    modalidad: elegir(vac.mod),
    ciudad: elegir(CIUDADES),
    edad,
    nivel_educativo: EDUCACION[edu],
    anios_experiencia: anios,
    experiencia_requerida: expReq,
    habilidades_requeridas: habReq,
    habilidades_cumplidas: habCumple,
    nivel_ingles: INGLES[ingles],
    certificaciones,
    salario_ofrecido: salarioOfrecido,
    salario_aspirado: salarioAspirado,
    paginas_cv: paginas,
    palabras_cv: palabras,
    puntaje_formacion: redondear(pForm, 1),
    puntaje_experiencia: redondear(pExp, 1),
    puntaje_habilidades: redondear(pHabP, 1),
    puntaje_idiomas: redondear(pIdi, 1),
    compatibilidad: redondear(compat, 2),
    nivel_compatibilidad: nivel,
    tiempo_analisis_ia_seg: tiempoIa,
    dias_en_proceso: dias,
    etapa_maxima: etapa,
    estado_final: estado,
    seleccionado: seleccionado ? 'Sí' : 'No',
  };
}

// --- Suciedad controlada -----------------------------------------------------
// Atípico: valor extremo pero posible (no es un error de digitación).
const ATIPICOS = [
  ['salario_aspirado', (f) => Math.round(f.salario_ofrecido * entre(3, 8) / 10000) * 10000],
  ['anios_experiencia', (f) => { f.edad = entero(60, 72); return redondear(entre(38, 50), 1); }],
  ['palabras_cv', () => entero(6000, 20000)],
  ['tiempo_analisis_ia_seg', () => redondear(entre(60, 300), 2)],
  ['dias_en_proceso', () => entero(150, 400)],
  ['certificaciones', () => entero(15, 30)],
  ['paginas_cv', () => entero(12, 30)],
];
function ensuciarAtipico(f) {
  const usados = [];
  const veces = azar() < 0.8 ? 1 : 2;
  for (const [col, valor] of barajar([...ATIPICOS]).slice(0, veces)) {
    f[col] = valor(f);
    usados.push(col);
  }
  return `atipico:${usados.join('+')}`;
}

// Vacío: entre 1 y 3 celdas sin dato (nunca el id).
const COLUMNAS_VACIABLES = [
  'fecha_postulacion', 'empresa', 'sector', 'cargo', 'modalidad', 'ciudad', 'edad', 'nivel_educativo',
  'anios_experiencia', 'nivel_ingles', 'certificaciones', 'salario_aspirado', 'palabras_cv',
  'puntaje_formacion', 'puntaje_experiencia', 'puntaje_habilidades', 'puntaje_idiomas', 'compatibilidad',
  'tiempo_analisis_ia_seg', 'dias_en_proceso', 'seleccionado',
];
function ensuciarVacio(f) {
  const cols = barajar([...COLUMNAS_VACIABLES]).slice(0, entero(1, 3));
  cols.forEach((c) => { f[c] = ''; });
  return `vacio:${cols.join('+')}`;
}

// Erróneo: valor imposible, mal escrito o contradictorio.
const ERRORES = [
  ['edad', () => elegir([[-entero(1, 30), 1], [0, 1], [entero(120, 999), 2]])],
  ['compatibilidad', () => redondear(elegir([[entre(101, 250), 2], [-entre(1, 50), 1]]), 2)],
  ['puntaje_habilidades', () => redondear(entre(101, 180), 1)],
  ['anios_experiencia', (f) => (azar() < 0.5 ? -redondear(entre(1, 10), 1) : Number(f.edad) + entero(1, 15))],
  ['salario_aspirado', () => elegir([[0, 1], [-entero(1, 50) * 100000, 1], [entero(1, 9) * 1000, 1]])],
  ['habilidades_cumplidas', (f) => f.habilidades_requeridas + entero(1, 5)],
  ['ciudad', (f) => elegir([['bogota', 1], ['BOGOTÁ', 1], ['Medellin', 1], ['medellín ', 1], ['Cali.', 1], ['Barranquila', 1], [` ${f.ciudad}`, 1]])],
  ['modalidad', () => elegir([['remoto', 1], ['Remotoo', 1], ['hibrido', 1], ['PRESENCIAL', 1], ['Presencial ', 1]])],
  ['nivel_ingles', () => elegir([['intermedio', 1], ['Avanzdo', 1], ['B1', 1], ['basico', 1]])],
  ['fecha_postulacion', () => elegir([['2027-03-15', 1], ['2030-01-01', 1], ['1900-01-01', 1]])],
  ['seleccionado', (f) => { f.estado_final = 'Rechazado'; return 'Sí'; }], // contradicción con estado_final
];
function ensuciarErroneo(f) {
  const [col, valor] = ERRORES[entero(0, ERRORES.length - 1)];
  f[col] = valor(f);
  return `erroneo:${col}`;
}

// --- Generación --------------------------------------------------------------
const filas = [];
for (let i = 1; i <= UNICAS; i++) filas.push(postulacion(i));

// Se reparte la suciedad sobre filas distintas, elegidas al azar.
const indices = barajar([...Array(UNICAS).keys()]);
const control = new Array(UNICAS).fill('limpio');
let k = 0;
for (let i = 0; i < CANT.atipicos; i++, k++) control[indices[k]] = ensuciarAtipico(filas[indices[k]]);
for (let i = 0; i < CANT.vacios; i++, k++) control[indices[k]] = ensuciarVacio(filas[indices[k]]);
for (let i = 0; i < CANT.erroneos; i++, k++) control[indices[k]] = ensuciarErroneo(filas[indices[k]]);

// Duplicados: copias exactas (mismo id incluido) de filas tomadas al azar.
const salida = filas.map((f, i) => ({ f, tipo: control[i] }));
for (let i = 0; i < CANT.duplicados; i++) {
  const original = salida[entero(0, UNICAS - 1)];
  salida.push({ f: { ...original.f }, tipo: `duplicado_de:${original.f.id_postulacion}` });
}
barajar(salida);

// --- Escritura ---------------------------------------------------------------
const columnas = Object.keys(filas[0]);
const csv = (v) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dir = path.join(__dirname, 'datos');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, 'postulaciones_sifce.csv'),
  [columnas.join(','), ...salida.map(({ f }) => columnas.map((c) => csv(f[c])).join(','))].join('\n') + '\n'
);
fs.writeFileSync(
  path.join(dir, 'control_calidad.csv'),
  ['fila,id_postulacion,anomalia,perfil_real', ...salida.map(({ f, tipo }, i) => `${i + 2},${f.id_postulacion},${tipo},${perfiles.get(f.id_postulacion)}`)].join('\n') + '\n'
);

// Resumen en consola.
const cuenta = (prefijo) => salida.filter((s) => s.tipo.startsWith(prefijo)).length;
const seleccionados = filas.filter((f) => f.seleccionado === 'Sí').length;
console.log(`Filas: ${salida.length}  |  columnas: ${columnas.length}`);
console.log(`limpias ${cuenta('limpio')}, atípicas ${cuenta('atipico')}, con vacíos ${cuenta('vacio')}, erróneas ${cuenta('erroneo')}, duplicadas ${cuenta('duplicado')}`);
console.log(`Seleccionados (sobre filas únicas): ${seleccionados} (${redondear((seleccionados / UNICAS) * 100, 1)} %)`);
