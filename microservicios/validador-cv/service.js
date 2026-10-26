// ============================================================================
// Microservicio VALIDADOR DE HOJAS DE VIDA · servicio.
//
// Lee el PDF ya validado, extrae su texto (lo que después analiza la IA) y
// detecta algunos datos básicos: correo, teléfono, habilidades conocidas,
// páginas y palabras. Si el PDF no se puede leer o es un escaneo sin texto,
// lo informa con un mensaje claro en vez de fallar (Sección 10 / RNF-F1).
// ============================================================================
const pdfParse = require('pdf-parse');

// Menos texto que esto no alcanza para analizar a un candidato: casi siempre
// es un documento escaneado como imagen.
const MIN_CARACTERES = 20;

// Habilidades que se reconocen en el texto (sin tildes y en minúscula).
const HABILIDADES_CONOCIDAS = [
  'javascript', 'typescript', 'node.js', 'express', 'react', 'angular', 'vue', 'html', 'css',
  'python', 'java', 'c#', 'php', 'kotlin', 'sql', 'postgresql', 'mysql', 'mongodb',
  'docker', 'kubernetes', 'git', 'aws', 'azure', 'linux', 'selenium', 'figma',
  'excel', 'power bi', 'scrum', 'contabilidad', 'ventas', 'atencion al cliente',
  'liderazgo', 'trabajo en equipo', 'ingles',
];

const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function detectarHabilidades(texto) {
  const t = normalizar(texto);
  return HABILIDADES_CONOCIDAS.filter((h) =>
    new RegExp(`(^|[^a-z0-9])${escaparRegex(h)}($|[^a-z0-9])`).test(t)
  );
}

function detectarDatos(texto, paginas) {
  const correo = texto.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  const telefono = texto.match(/(?:\+?\d{2,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  return {
    paginas,
    palabras: texto.split(/\s+/).filter(Boolean).length,
    correo: correo ? correo[0] : null,
    telefono: telefono ? telefono[0].trim() : null,
    habilidades: detectarHabilidades(texto),
  };
}

// Recibe un buffer ya validado por validator.js.
// Devuelve { valido: true, texto, datos } o { valido: false, errores }.
async function analizarCv(buffer) {
  let data;
  try {
    // Uint8Array propio (no el Buffer de Node): pdf.js valida el tipo con
    // instanceof y en entornos aislados (como Jest) un Buffer externo no pasa
    // esa validación y el PDF se lee mal ("bad XRef entry").
    data = await pdfParse(new Uint8Array(buffer));
  } catch (err) {
    return { valido: false, errores: [`No fue posible procesar el PDF: ${err.message}`] };
  }

  const texto = (data.text || '').trim();
  if (texto.length < MIN_CARACTERES) {
    return {
      valido: false,
      errores: ['El PDF no contiene texto legible (posiblemente es un documento escaneado como imagen).'],
    };
  }

  return { valido: true, texto, datos: detectarDatos(texto, data.numpages) };
}

module.exports = { analizarCv, detectarDatos, detectarHabilidades, HABILIDADES_CONOCIDAS };
