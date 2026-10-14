// MODEL — consultas agregadas para el módulo de reportes. Todas acotadas a
// UNA empresa (mismo principio de aislamiento que el resto del sistema).
const db = require('./db');

// Devuelve las filas "crudas"; whatever/presenters/report.view.js arma la respuesta final.
async function getSummaryData(companyId) {
  const [vacancyCounts, applicationTotal, stageFunnel, avgScore, topVacancies, dailySeries, recentApplications] =
    await Promise.all([
      db.query('SELECT status, COUNT(*)::int AS count FROM vacancies WHERE company_id = $1 GROUP BY status', [companyId]),
      db.query(
        `SELECT COUNT(*)::int AS count FROM applications a
         JOIN vacancies v ON v.id = a.vacancy_id WHERE v.company_id = $1`,
        [companyId]
      ),
      db.query(
        `SELECT a.status, COUNT(*)::int AS count FROM applications a
         JOIN vacancies v ON v.id = a.vacancy_id WHERE v.company_id = $1 GROUP BY a.status`,
        [companyId]
      ),
      db.query(
        `SELECT AVG(ai.overall_score)::numeric(5,2) AS avg_score FROM ai_analysis_results ai
         JOIN applications a ON a.id = ai.application_id
         JOIN vacancies v ON v.id = a.vacancy_id
         WHERE v.company_id = $1 AND ai.status = 'completed'`,
        [companyId]
      ),
      db.query(
        `SELECT v.id, v.title, v.status, COUNT(a.id)::int AS application_count,
                AVG(ai.overall_score)::numeric(5,2) AS avg_score
         FROM vacancies v
         LEFT JOIN applications a ON a.vacancy_id = v.id
         LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id AND ai.status = 'completed'
         WHERE v.company_id = $1
         GROUP BY v.id
         ORDER BY application_count DESC
         LIMIT 5`,
        [companyId]
      ),
      db.query(
        `SELECT date_trunc('day', a.applied_at)::date AS day, COUNT(*)::int AS count
         FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
         WHERE v.company_id = $1 AND a.applied_at >= now() - interval '14 days'
         GROUP BY day ORDER BY day`,
        [companyId]
      ),
      db.query(
        `SELECT a.id, a.status, a.applied_at, v.title AS vacancy_title, u.full_name AS candidate_name,
                ai.overall_score, ai.status AS ai_status
         FROM applications a
         JOIN vacancies v ON v.id = a.vacancy_id
         JOIN candidate_profiles cp ON cp.id = a.candidate_id
         JOIN users u ON u.id = cp.user_id
         LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id
         WHERE v.company_id = $1
         ORDER BY a.applied_at DESC
         LIMIT 8`,
        [companyId]
      ),
    ]);

  return {
    vacancyCounts: vacancyCounts.rows,
    applicationTotal: applicationTotal.rows[0].count,
    stageFunnel: stageFunnel.rows,
    avgScore: avgScore.rows[0].avg_score,
    topVacancies: topVacancies.rows,
    dailySeries: dailySeries.rows,
    recentApplications: recentApplications.rows,
  };
}

// Exportación plana de todas las postulaciones de la empresa (CSV en el frontend).
async function exportApplications(companyId) {
  const { rows } = await db.query(
    `SELECT v.title AS vacante, u.full_name AS candidato, u.email AS correo, a.status AS etapa,
            ai.overall_score AS compatibilidad, a.applied_at AS fecha_postulacion
     FROM applications a
     JOIN vacancies v ON v.id = a.vacancy_id
     JOIN candidate_profiles cp ON cp.id = a.candidate_id
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN ai_analysis_results ai ON ai.application_id = a.id
     WHERE v.company_id = $1
     ORDER BY a.applied_at DESC`,
    [companyId]
  );
  return rows;
}

module.exports = { getSummaryData, exportApplications };
