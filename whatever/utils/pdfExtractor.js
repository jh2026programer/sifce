const fs = require('fs');
const pdfParse = require('pdf-parse');

// Extrae el texto de un PDF de hoja de vida. Ante un PDF ilegible, escaneado
// sin capa de texto, corrupto, etc. no lanza excepción: devuelve un resultado
// con success=false para que el llamador informe claramente al usuario
// (Sección 10 / RNF-F1), en vez de romper la carga del archivo.
async function extractTextFromPdf(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    // Uint8Array propio (no el Buffer de fs): pdf.js valida el tipo con
    // instanceof, y en entornos aislados (como Jest) un Buffer creado fuera
    // no pasa esa validación y el PDF se lee mal ("bad XRef entry").
    const data = await pdfParse(new Uint8Array(buffer));
    const text = (data.text || '').trim();

    if (!text || text.length < 20) {
      return {
        success: false,
        text: '',
        error: 'El PDF no contiene texto legible (posiblemente es un documento escaneado como imagen).',
      };
    }

    return { success: true, text, error: null };
  } catch (err) {
    return {
      success: false,
      text: '',
      error: `No fue posible procesar el PDF: ${err.message}`,
    };
  }
}

module.exports = { extractTextFromPdf };
