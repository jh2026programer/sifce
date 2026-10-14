// MODEL — tabla companies (RF04, RF19 y código de acceso privado).
const db = require('./db');

async function findAll() {
  const { rows } = await db.query('SELECT * FROM companies ORDER BY created_at DESC');
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByAccessCode(executor, code) {
  const { rows } = await executor.query('SELECT * FROM companies WHERE access_code = $1', [code]);
  return rows[0] || null;
}

async function create(executor, { name, sector, description, location, contactEmail, contactPhone, status = 'active', accessCode }) {
  const { rows } = await executor.query(
    `INSERT INTO companies (name, sector, description, location, contact_email, contact_phone, status, access_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name.trim(), sector || null, description || null, location || null, contactEmail || null, contactPhone || null, status, accessCode]
  );
  return rows[0];
}

// Solo actualiza los campos enviados (COALESCE conserva el valor actual).
async function update(id, { name, sector, description, location, contactEmail, contactPhone }) {
  const { rows } = await db.query(
    `UPDATE companies SET
       name = COALESCE($1, name), sector = COALESCE($2, sector), description = COALESCE($3, description),
       location = COALESCE($4, location), contact_email = COALESCE($5, contact_email),
       contact_phone = COALESCE($6, contact_phone), updated_at = now()
     WHERE id = $7 RETURNING *`,
    [name, sector, description, location, contactEmail, contactPhone, id]
  );
  return rows[0] || null;
}

async function setStatus(id, status) {
  const { rows } = await db.query(
    'UPDATE companies SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

async function setAccessCode(id, code) {
  const { rows } = await db.query(
    'UPDATE companies SET access_code = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [code, id]
  );
  return rows[0] || null;
}

// Código de error de PostgreSQL cuando el access_code generado ya existe.
function isAccessCodeCollision(err) {
  return err.code === '23505' && err.constraint === 'companies_access_code_key';
}

module.exports = { findAll, findById, findByAccessCode, create, update, setStatus, setAccessCode, isAccessCodeCollision };
