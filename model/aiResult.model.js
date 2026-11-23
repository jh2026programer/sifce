// MODEL — tabla ai_analysis_results (resultado del análisis de IA, RF09/RF11).
const db = require('./db');

async function createPending(executor, applicationId) {
  await executor.query(
    `INSERT INTO ai_analysis_results (application_id, status) VALUES ($1, 'pending')`,
    [applicationId]
  );
}

// Borra el resultado anterior para que se vuelva a calcular (postulación reactivada).
async function resetToPending(executor, applicationId) {
  await executor.query(
    `UPDATE ai_analysis_results SET status = 'pending', overall_score = NULL, education_score = NULL,
       experience_score = NULL, skills_score = NULL, languages_score = NULL, strengths = '[]', gaps = '[]',
       explanation = NULL, raw_extracted_profile = NULL, selection_prediction = NULL, error_message = NULL, completed_at = NULL
     WHERE application_id = $1`,
    [applicationId]
  );
}

async function findByApplicationId(applicationId) {
  const { rows } = await db.query('SELECT * FROM ai_analysis_results WHERE application_id = $1', [applicationId]);
  return rows[0] || null;
}

async function markProcessing(applicationId) {
  await db.query(`UPDATE ai_analysis_results SET status = 'processing' WHERE application_id = $1`, [applicationId]);
}

async function saveCompleted(applicationId, { provider, overallScore, result }) {
  await db.query(
    `UPDATE ai_analysis_results SET
      status = 'completed', provider = $2, overall_score = $3,
      education_score = $4, experience_score = $5, skills_score = $6, languages_score = $7,
      strengths = $8, gaps = $9, explanation = $10, raw_extracted_profile = $11,
      completed_at = now()
     WHERE application_id = $1`,
    [
      applicationId,
      provider,
      overallScore.toFixed(2),
      result.educationScore,
      result.experienceScore,
      result.skillsScore,
      result.languagesScore,
      JSON.stringify(result.strengths),
      JSON.stringify(result.gaps),
      result.explanation,
      JSON.stringify(result.extractedProfile),
    ]
  );
}

// Predicción automática de selección (minería de datos), calculada al
// terminar el análisis. Se guarda aparte para poder recalcularla sola.
async function savePrediction(applicationId, prediction) {
  await db.query('UPDATE ai_analysis_results SET selection_prediction = $2 WHERE application_id = $1', [
    applicationId,
    JSON.stringify(prediction),
  ]);
}

// Análisis completados que todavía no tienen predicción (por ejemplo, los
// hechos antes de que existiera la predicción automática).
async function listCompletedWithoutPrediction() {
  const { rows } = await db.query(
    `SELECT application_id FROM ai_analysis_results WHERE status = 'completed' AND selection_prediction IS NULL`
  );
  return rows.map((r) => r.application_id);
}

// La base no tiene migraciones: si fue creada antes de esta columna, se
// agrega sola al arrancar la API (no borra ni cambia ningún dato).
async function ensurePredictionColumn() {
  await db.query('ALTER TABLE ai_analysis_results ADD COLUMN IF NOT EXISTS selection_prediction JSONB');
}

async function markFailed(applicationId, errorMessage) {
  await db.query(
    `UPDATE ai_analysis_results SET status = 'failed', error_message = $2 WHERE application_id = $1`,
    [applicationId, errorMessage]
  );
}

module.exports = {
  createPending, resetToPending, findByApplicationId, markProcessing, saveCompleted, markFailed,
  savePrediction, listCompletedWithoutPrediction, ensurePredictionColumn,
};
