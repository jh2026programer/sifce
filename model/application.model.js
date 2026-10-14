// MODEL — tablas applications y application_stage_history (RF08, RF10,
// RF12, RF13, RF17).
const db = require('./db');

// Etapas que puede asignar la empresa. "retirado" solo lo decide el candidato.
const COMPANY_STATUSES = ['postulado', 'en_revision', 'preseleccionado', 'entrevista', 'seleccionado', 'rechazado'];

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM applications WHERE id = $1', [id]);
  return rows[0] || null;
}

// Postulación + empresa dueña de la vacante (para validar aislamiento).
async function findByIdWithCompany(id) {
  const { rows } = await db.query(
    'SELECT a.*, v.company_id FROM applications a JOIN vacancies v ON v.id = a.vacancy_id WHERE a.id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findByVacancyAndCandidate(vacancyId, candidateId) {
  const { rows } = await db.query(
    'SELECT * FROM applications WHERE vacancy_id = $1 AND candidate_id = $2',
    [vacancyId, candidateId]
  );
  return rows[0] || null;
}

// Detalle con datos de la vacante y del candidato (RF09 / RF11).
async function findDetail(id) {
  const { rows } = await db.query(
    `SELECT a.*, v.company_id, v.title AS vacancy_title, u.full_name AS candidate_name
     FROM applications a
     JOIN vacancies v ON v.id = a.vacancy_id
     JOIN candidate_profiles cp ON cp.id = a.candidate_id
     JOIN users u ON u.id = cp.user_id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Datos necesarios para correr el análisis de IA de una postulación.
async function findForAnalysis(id) {
  const { rows } = await db.query(
    `SELECT a.id, a.candidate_id, a.vacancy_id, r.extracted_text, r.status AS resume_status,
            v.company_id
     FROM applications a
     JOIN vacancies v ON v.id = a.vacancy_id
     LEFT JOIN resumes r ON r.id = a.resume_id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function create(executor, { vacancyId, candidateId, resumeId }) {
  const { rows } = await executor.query(
    `INSERT INTO applications (vacancy_id, candidate_id, resume_id, status)
     VALUES ($1, $2, $3, 'postulado') RETURNING *`,
    [vacancyId, candidateId, resumeId]
  );
  return rows[0];
}

// Reactiva una postulación que el candidato había retirado.
async function reactivate(executor, id, resumeId) {
  const { rows } = await executor.query(
    `UPDATE applications SET status = 'postulado', resume_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [resumeId, id]
  );
  return rows[0];
}

async function setStatus(executor, id, status) {
  await executor.query('UPDATE applications SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
}

async function addStageHistory(executor, { applicationId, fromStatus, toStatus, changedBy }) {
  await executor.query(
    `INSERT INTO application_stage_history (application_id, from_status, to_status, changed_by)
     VALUES ($1, $2, $3, $4)`,
    [applicationId, fromStatus, toStatus, changedBy]
  );
}

async function findStageHistory(applicationId) {
  const { rows } = await db.query(
    'SELECT * FROM application_stage_history WHERE application_id = $1 ORDER BY changed_at ASC',
    [applicationId]
  );
  return rows;
}

// RF17 - postulaciones del candidato dentro de UNA empresa.
async function listForCandidateInCompany(candidateId, companyId) {
  const { rows } = await db.query(
    `SELECT a.*, v.title AS vacancy_title, c.name AS company_name,
            ai.status AS ai_status, ai.overall_score
     FROM applications a
     JOIN vacancies v ON v.id = a.vacancy_id
     JOIN companies c ON c.id = v.company_id
     LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id
     WHERE a.candidate_id = $1 AND v.company_id = $2
     ORDER BY a.applied_at DESC`,
    [candidateId, companyId]
  );
  return rows;
}

// RF10 - postulaciones de una vacante con sus puntajes.
async function listForVacancy(vacancyId) {
  const { rows } = await db.query(
    `SELECT a.*, u.full_name AS candidate_name, u.email AS candidate_email,
            ai.status AS ai_status, ai.overall_score, ai.education_score, ai.experience_score,
            ai.skills_score, ai.languages_score
     FROM applications a
     JOIN candidate_profiles cp ON cp.id = a.candidate_id
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id
     WHERE a.vacancy_id = $1
     ORDER BY a.applied_at DESC`,
    [vacancyId]
  );
  return rows;
}

// RF10 - ranking: solo análisis completados, de mayor a menor compatibilidad.
async function rankingForVacancy(vacancyId) {
  const { rows } = await db.query(
    `SELECT a.id AS application_id, u.full_name AS candidate_name, a.status,
            ai.overall_score, ai.status AS ai_status
     FROM applications a
     JOIN candidate_profiles cp ON cp.id = a.candidate_id
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id
     WHERE a.vacancy_id = $1 AND ai.status = 'completed'
     ORDER BY ai.overall_score DESC NULLS LAST`,
    [vacancyId]
  );
  return rows;
}

// RF12 - datos para comparar varias postulaciones lado a lado.
async function findForComparison(applicationIds) {
  const { rows } = await db.query(
    `SELECT a.id AS application_id, a.status, v.id AS vacancy_id, v.company_id, v.title AS vacancy_title,
            u.full_name AS candidate_name, cp.id AS candidate_id,
            ai.overall_score, ai.education_score, ai.experience_score, ai.skills_score, ai.languages_score,
            ai.strengths, ai.gaps, ai.status AS ai_status
     FROM applications a
     JOIN vacancies v ON v.id = a.vacancy_id
     JOIN candidate_profiles cp ON cp.id = a.candidate_id
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id
     WHERE a.id = ANY($1::uuid[])`,
    [applicationIds]
  );
  return rows;
}

module.exports = {
  COMPANY_STATUSES,
  findById,
  findByIdWithCompany,
  findByVacancyAndCandidate,
  findDetail,
  findForAnalysis,
  create,
  reactivate,
  setStatus,
  addStageHistory,
  findStageHistory,
  listForCandidateInCompany,
  listForVacancy,
  rankingForVacancy,
  findForComparison,
};
