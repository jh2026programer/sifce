// MODEL — tabla selection_stages (RF15).
const db = require('./db');

// Etapas base con las que nace toda empresa (editables luego).
const DEFAULT_STAGES = [
  ['Postulado', 'postulado', 1],
  ['En revisión', 'en_revision', 2],
  ['Preseleccionado', 'preseleccionado', 3],
  ['Entrevista', 'entrevista', 4],
  ['Seleccionado', 'seleccionado', 5],
  ['Rechazado', 'rechazado', 6],
];

const STATUS_CODES = DEFAULT_STAGES.map(([, code]) => code);

async function listByCompany(companyId) {
  const { rows } = await db.query('SELECT * FROM selection_stages WHERE company_id = $1 ORDER BY sort_order', [companyId]);
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM selection_stages WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(executor, companyId, { name, statusCode, sortOrder, description }) {
  const { rows } = await executor.query(
    `INSERT INTO selection_stages (company_id, name, status_code, sort_order, description)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [companyId, name.trim(), statusCode, sortOrder || 0, description || null]
  );
  return rows[0];
}

async function createDefaults(executor, companyId) {
  for (const [name, statusCode, sortOrder] of DEFAULT_STAGES) {
    await create(executor, companyId, { name, statusCode, sortOrder });
  }
}

async function update(id, { name, description, sortOrder }) {
  const { rows } = await db.query(
    `UPDATE selection_stages SET name = COALESCE($1, name), description = COALESCE($2, description),
       sort_order = COALESCE($3, sort_order) WHERE id = $4 RETURNING *`,
    [name, description, sortOrder, id]
  );
  return rows[0] || null;
}

module.exports = { DEFAULT_STAGES, STATUS_CODES, listByCompany, findById, create, createDefaults, update };
