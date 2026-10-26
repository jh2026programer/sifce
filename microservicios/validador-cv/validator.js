// ============================================================================
// Microservicio VALIDADOR DE HOJAS DE VIDA · validador.
//
// Revisa el archivo ANTES de intentar leerlo:
//   - que llegue como PDF (Content-Type application/pdf),
//   - que no esté vacío ni supere el tamaño máximo (RF07: 5 MB),
//   - que de verdad sea un PDF (sus primeros bytes son "%PDF-"), y no otro
//     archivo al que solo le cambiaron la extensión.
// Devuelve la lista de errores (vacía si el archivo es válido).
// ============================================================================

const MAX_MB = parseInt(process.env.MS_CV_MAX_MB || '5', 10);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const FIRMA_PDF = '%PDF-';

function validarArchivo({ buffer, contentType }) {
  const errores = [];

  const tipo = (contentType || '').split(';')[0].trim().toLowerCase();
  if (tipo !== 'application/pdf') {
    errores.push('El archivo debe enviarse como PDF (Content-Type: application/pdf).');
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    errores.push('El archivo está vacío.');
    return errores;
  }

  if (buffer.length > MAX_BYTES) {
    errores.push(`El archivo supera el tamaño máximo de ${MAX_MB} MB.`);
  }

  if (buffer.subarray(0, FIRMA_PDF.length).toString('latin1') !== FIRMA_PDF) {
    errores.push('El contenido no es un PDF real (le falta la firma "%PDF-").');
  }

  return errores;
}

module.exports = { validarArchivo, MAX_MB, MAX_BYTES };
