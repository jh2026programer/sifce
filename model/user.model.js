// MODEL — tabla users (RF01, RF02, RF03, RF18 y gestión global del superadmin).
const db = require('./db');

const normalizeEmail = (email) => email.toLowerCase().trim();

// Usuario + estado de su empresa, usado por el login.
async function findByEmailWithCompanyStatus(email) {
  const { rows } = await db.query(
    `SELECT u.*, c.status AS company_status FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.email = $1`,
    [normalizeEmail(email)]
  );
  return rows[0] || null;
}

// Usuario de la sesión, recargado en cada request por middleware/auth.js.
async function findSessionUser(id) {
  const { rows } = await db.query(
    `SELECT u.id, u.company_id, u.role, u.full_name, u.email, u.is_active, c.status AS company_status
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function emailExists(email) {
  const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [normalizeEmail(email)]);
  return rows.length > 0;
}

// executor: db o un client de transacción (ver db.withTransaction).
async function create(executor, { companyId = null, role, fullName, email, passwordHash }) {
  const { rows } = await executor.query(
    `INSERT INTO users (company_id, role, full_name, email, password_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, role, fullName.trim(), normalizeEmail(email), passwordHash]
  );
  return rows[0];
}

// Actualiza solo los campos presentes en `fields` (claves = nombres de columna).
async function update(id, fields) {
  const columns = Object.keys(fields).filter((k) => fields[k] !== undefined);
  if (columns.length === 0) return null;
  const sets = columns.map((c, i) => `${c} = $${i + 1}`);
  const values = columns.map((c) => fields[c]);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${columns.length + 1} RETURNING *`,
    [...values, id]
  );
  return rows[0] || null;
}

// RF18 - usuarios internos de una empresa.
async function listByCompany(companyId) {
  const { rows } = await db.query(
    `SELECT id, full_name, email, role, is_active, created_at FROM users
     WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  );
  return rows;
}

// Gestión global del superadministrador: todos los usuarios de la plataforma,
// con filtros opcionales. `status` admite: active | inactive | locked.
async function listAll({ q, role, companyId, status } = {}) {
  const conditions = [];
  const values = [];
  // Agrega un valor parametrizado y devuelve su marcador ($1, $2, ...).
  const param = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (q) {
    const p = param(`%${q}%`);
    conditions.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p})`);
  }
  if (role) conditions.push(`u.role = ${param(role)}`);
  if (companyId) conditions.push(`u.company_id = ${param(companyId)}`);
  if (status === 'active') conditions.push('u.is_active = true');
  if (status === 'inactive') conditions.push('u.is_active = false');
  if (status === 'locked') conditions.push('u.locked_until IS NOT NULL AND u.locked_until > now()');

  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.company_id, c.name AS company_name,
            u.failed_login_attempts, u.locked_until, u.created_at,
            (u.locked_until IS NOT NULL AND u.locked_until > now()) AS is_locked
     FROM users u LEFT JOIN companies c ON c.id = u.company_id
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY u.created_at DESC`,
    values
  );
  return rows;
}

// --- Bloqueo por intentos fallidos (protección contra fuerza bruta) ---

async function setFailedAttempts(id, attempts) {
  await db.query('UPDATE users SET failed_login_attempts = $1 WHERE id = $2', [attempts, id]);
}

async function lockUntil(id, lockedUntil) {
  await db.query('UPDATE users SET failed_login_attempts = 0, locked_until = $1 WHERE id = $2', [lockedUntil, id]);
}

async function clearLock(id) {
  const { rows } = await db.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  findByEmailWithCompanyStatus,
  findSessionUser,
  findById,
  emailExists,
  create,
  update,
  listByCompany,
  listAll,
  setFailedAttempts,
  lockUntil,
  clearLock,
};
