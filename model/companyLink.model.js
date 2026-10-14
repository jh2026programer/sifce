// MODEL — tabla candidate_company_links (modelo privado por empresa).
// Un candidato solo puede operar en las empresas a las que se vinculó con el
// código de acceso de cada una.
const db = require('./db');

async function exists(executor, candidateId, companyId) {
  const { rows } = await executor.query(
    'SELECT id FROM candidate_company_links WHERE candidate_id = $1 AND company_id = $2',
    [candidateId, companyId]
  );
  return rows.length > 0;
}

async function create(executor, candidateId, companyId) {
  await executor.query(
    'INSERT INTO candidate_company_links (candidate_id, company_id) VALUES ($1, $2)',
    [candidateId, companyId]
  );
}

// Empresas vinculadas a un candidato (base del selector de entornos).
async function listCompaniesForCandidate(candidateId) {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.sector, c.location, c.status, l.linked_at
     FROM candidate_company_links l JOIN companies c ON c.id = l.company_id
     WHERE l.candidate_id = $1 ORDER BY l.linked_at DESC`,
    [candidateId]
  );
  return rows;
}

// Empresa (completa) si el usuario candidato está vinculado a ella; si no, null.
// La usa middleware/companyContext.js para revalidar X-Active-Company.
async function findLinkedCompanyForUser(userId, companyId) {
  const { rows } = await db.query(
    `SELECT c.* FROM candidate_company_links l
     JOIN companies c ON c.id = l.company_id
     JOIN candidate_profiles cp ON cp.id = l.candidate_id
     WHERE cp.user_id = $1 AND l.company_id = $2`,
    [userId, companyId]
  );
  return rows[0] || null;
}

module.exports = { exists, create, listCompaniesForCandidate, findLinkedCompanyForUser };
