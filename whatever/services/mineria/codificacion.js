// ============================================================================
// Minería de datos · codificación de una postulación para el modelo.
//
// Convierte los datos de un candidato (como llegan del simulador de la página
// o de una fila del dataset) en el vector de números que usa la regresión
// logística. Lo usan el entrenamiento (mineria-datos/entrenar_modelo.js) y la
// API (mineriaService), así las dos partes codifican siempre igual.
// ============================================================================

const SECTORES = ['Tecnología', 'Retail', 'Salud', 'Finanzas', 'Manufactura', 'Educación', 'Logística'];
const MODALIDADES = ['Remoto', 'Híbrido', 'Presencial'];
const EDUCACION = ['Bachiller', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización', 'Maestría'];
const INGLES = ['Ninguno', 'Básico', 'Intermedio', 'Avanzado', 'Nativo'];

// Variables del modelo, en orden. "etiqueta" es lo que ve el usuario;
// "etiquetaNo" es la de una variable sí/no cuando el candidato NO la cumple.
const VARIABLES = [
  { nombre: 'compatibilidad', etiqueta: 'Compatibilidad con la vacante' },
  { nombre: 'cobertura_habilidades', etiqueta: 'Habilidades cumplidas (%)' },
  { nombre: 'nivel_ingles', etiqueta: 'Nivel de inglés' },
  { nombre: 'ingles_avanzado_tecnologia', etiqueta: 'Inglés avanzado en tecnología', etiquetaNo: 'Sin inglés avanzado (en tecnología)' },
  { nombre: 'nivel_educativo', etiqueta: 'Nivel educativo' },
  { nombre: 'anios_experiencia', etiqueta: 'Años de experiencia' },
  { nombre: 'experiencia_requerida', etiqueta: 'Experiencia que pide la vacante' },
  { nombre: 'certificaciones', etiqueta: 'Certificaciones' },
  { nombre: 'edad', etiqueta: 'Edad' },
  { nombre: 'brecha_salarial', etiqueta: 'Brecha salarial (aspirado vs. ofrecido)' },
  { nombre: 'pide_mas_30', etiqueta: 'Pide más del 30 % sobre lo ofrecido', etiquetaNo: 'No pide más del 30 % sobre lo ofrecido' },
  ...SECTORES.map((s) => ({ nombre: `sector_${s}`, etiqueta: `Sector ${s}` })),
  ...MODALIDADES.map((m) => ({ nombre: `modalidad_${m}`, etiqueta: `Modalidad ${m}` })),
];

const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));

// entrada: { sector, modalidad, edad, nivel_educativo, anios_experiencia,
//   experiencia_requerida, habilidades_requeridas, habilidades_cumplidas,
//   nivel_ingles, certificaciones, salario_ofrecido, salario_aspirado,
//   compatibilidad }  →  arreglo de números en el orden de VARIABLES.
function vectorizar(e) {
  const ingles = INGLES.indexOf(e.nivel_ingles);
  const brecha = num(e.salario_aspirado) / num(e.salario_ofrecido) - 1;
  const valores = {
    compatibilidad: num(e.compatibilidad),
    cobertura_habilidades: (num(e.habilidades_cumplidas) / num(e.habilidades_requeridas)) * 100,
    nivel_ingles: ingles,
    ingles_avanzado_tecnologia: e.sector === 'Tecnología' && ingles >= 3 ? 1 : 0,
    nivel_educativo: EDUCACION.indexOf(e.nivel_educativo),
    anios_experiencia: num(e.anios_experiencia),
    experiencia_requerida: num(e.experiencia_requerida),
    certificaciones: num(e.certificaciones),
    edad: num(e.edad),
    brecha_salarial: brecha * 100,
    pide_mas_30: brecha > 0.3 ? 1 : 0,
  };
  SECTORES.forEach((s) => { valores[`sector_${s}`] = e.sector === s ? 1 : 0; });
  MODALIDADES.forEach((m) => { valores[`modalidad_${m}`] = e.modalidad === m ? 1 : 0; });
  return VARIABLES.map((v) => valores[v.nombre]);
}

module.exports = { SECTORES, MODALIDADES, EDUCACION, INGLES, VARIABLES, vectorizar };
