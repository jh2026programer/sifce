// MODEL — tabla resumes (hojas de vida en PDF, RF07).
const db = require('./db');

async function create(candidateId, { fileName, filePath, sizeBytes }) {
  const { rows } = await db.query(
    `INSERT INTO resumes (candidate_id, file_name, file_path, file_size_bytes, status)
     VALUES ($1, $2, $3, $4, 'uploaded') RETURNING *`,
    [candidateId, fileName, filePath, sizeBytes]
  );
  return rows[0];
}

// Guarda el resultado de la extracción de texto del PDF.
async function saveExtraction(id, { success, text, error }) {
  await db.query(
    'UPDATE resumes SET status = $1, extracted_text = $2, extraction_error = $3 WHERE id = $4',
    [success ? 'extracted' : 'extraction_failed', text || null, error, id]
  );
}

async function listByCandidate(candidateId) {
  const { rows } = await db.query(
    'SELECT id, file_name, status, extraction_error, uploaded_at FROM resumes WHERE candidate_id = $1 ORDER BY uploaded_at DESC',
    [candidateId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM resumes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findOwned(id, candidateId) {
  const { rows } = await db.query('SELECT * FROM resumes WHERE id = $1 AND candidate_id = $2', [id, candidateId]);
  return rows[0] || null;
}

async function findLatestForCandidate(candidateId) {
  const { rows } = await db.query(
    'SELECT * FROM resumes WHERE candidate_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
    [candidateId]
  );
  return rows[0] || null;
}

// Devuelve true si se eliminó (existía y era del candidato).
async function removeOwned(id, candidateId) {
  const { rowCount } = await db.query('DELETE FROM resumes WHERE id = $1 AND candidate_id = $2', [id, candidateId]);
  return rowCount > 0;
}

// RNF-S4: una empresa solo puede ver un CV usado en una postulación a sus vacantes.
async function isUsedByCompany(resumeId, companyId) {
  const { rows } = await db.query(
    `SELECT 1 FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
     WHERE a.resume_id = $1 AND v.company_id = $2 LIMIT 1`,
    [resumeId, companyId]
  );
  return rows.length > 0;
}

module.exports = {
  create, saveExtraction, listByCandidate, findById, findOwned, findLatestForCandidate, removeOwned, isUsedByCompany,
};
