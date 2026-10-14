// MODEL — tabla evaluation_criteria (RF14).
const db = require('./db');

const CATEGORIES = ['formacion', 'experiencia', 'habilidades', 'idiomas'];

async function listByCompany(companyId) {
  const { rows } = await db.query(
    'SELECT * FROM evaluation_criteria WHERE company_id = $1 ORDER BY category, name',
    [companyId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM evaluation_criteria WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(companyId, { category, name, weight }) {
  const { rows } = await db.query(
    'INSERT INTO evaluation_criteria (company_id, category, name, weight) VALUES ($1,$2,$3,$4) RETURNING *',
    [companyId, category, name.trim(), weight ?? 25]
  );
  return rows[0];
}

async function update(id, { name, weight }) {
  const { rows } = await db.query(
    `UPDATE evaluation_criteria SET name = COALESCE($1, name), weight = COALESCE($2, weight), updated_at = now()
     WHERE id = $3 RETURNING *`,
    [name, weight, id]
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query('DELETE FROM evaluation_criteria WHERE id = $1', [id]);
}

// Suma de pesos por categoría configurados por la empresa (para la IA).
async function sumWeightsByCategory(companyId) {
  const { rows } = await db.query(
    `SELECT category, SUM(weight) AS total_weight
     FROM evaluation_criteria WHERE company_id = $1 GROUP BY category`,
    [companyId]
  );
  return rows;
}

module.exports = { CATEGORIES, listByCompany, findById, create, update, remove, sumWeightsByCategory };
