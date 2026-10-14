// MODEL — tabla login_otp_codes (verificación en dos pasos). Solo guarda el
// hash del código, nunca el código en texto plano.
const db = require('./db');

async function create(userId, codeHash, expiresAt) {
  const { rows } = await db.query(
    'INSERT INTO login_otp_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3) RETURNING id',
    [userId, codeHash, expiresAt]
  );
  return rows[0].id;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM login_otp_codes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function incrementAttempts(id) {
  await db.query('UPDATE login_otp_codes SET attempts = attempts + 1 WHERE id = $1', [id]);
}

async function markConsumed(id) {
  await db.query('UPDATE login_otp_codes SET consumed = true WHERE id = $1', [id]);
}

module.exports = { create, findById, incrementAttempts, markConsumed };
