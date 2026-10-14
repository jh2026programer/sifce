const crypto = require('crypto');

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) para que el código sea
// fácil de leer y transcribir cuando una empresa lo entrega a un candidato
// (por teléfono, en un volante impreso, etc.).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateAccessCode(length = 8) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

module.exports = { generateAccessCode };
