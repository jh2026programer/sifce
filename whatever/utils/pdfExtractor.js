const fs = require('fs');
const pdfParse = require('pdf-parse');

// Extrae el texto de un PDF de hoja de vida. Ante un PDF ilegible, escaneado
// sin capa de texto, corrupto, etc. no lanza excepción: devuelve un resultado
// con success=false para que el llamador informe claramente al usuario
// (Sección 10 / RNF-F1), en vez de romper la carga del archivo.
async function extractTextFromPdf(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
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
