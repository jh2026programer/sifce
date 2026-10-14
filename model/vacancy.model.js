// MODEL — tabla vacancies (RF05, RF16).
const db = require('./db');

const STATUSES = ['draft', 'active', 'closed'];

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM vacancies WHERE id = $1', [id]);
  return rows[0] || null;
}

// Vacante + estado de su empresa (para decidir si un candidato puede verla).
async function findByIdWithCompanyStatus(id) {
  const { rows } = await db.query(
    'SELECT v.*, c.status AS company_status FROM vacancies v JOIN companies c ON c.id = v.company_id WHERE v.id = $1',
    [id]
  );
  return rows[0] || null;
}

async function listByCompany(companyId) {
  const { rows } = await db.query(
    `SELECT v.*, COUNT(a.id)::int AS application_count
     FROM vacancies v
     LEFT JOIN applications a ON a.vacancy_id = v.id
     WHERE v.company_id = $1
     GROUP BY v.id
     ORDER BY v.created_at DESC`,
    [companyId]
  );
  return rows;
}

async function create(companyId, createdBy, data) {
  const { rows } = await db.query(
    `INSERT INTO vacancies
      (company_id, created_by, title, description, required_education, min_experience_years,
       required_skills, required_languages, salary, modality, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      companyId, createdBy, data.title.trim(), data.description || null, data.requiredEducation || null,
      data.minExperienceYears || 0, JSON.stringify(data.requiredSkills || []), JSON.stringify(data.requiredLanguages || []),
      data.salary || null, data.modality || 'presencial', data.status || 'draft',
    ]
  );
  return rows[0];
}

// Solo actualiza los campos enviados (COALESCE conserva el valor actual).
async function update(id, data) {
  const { rows } = await db.query(
    `UPDATE vacancies SET
       title = COALESCE($1, title), description = COALESCE($2, description),
       required_education = COALESCE($3, required_education),
       min_experience_years = COALESCE($4, min_experience_years),
       required_skills = COALESCE($5, required_skills),
       required_languages = COALESCE($6, required_languages),
       salary = COALESCE($7, salary), modality = COALESCE($8, modality),
       status = COALESCE($9, status), updated_at = now()
     WHERE id = $10 RETURNING *`,
    [
      data.title, data.description, data.requiredEducation, data.minExperienceYears,
      data.requiredSkills ? JSON.stringify(data.requiredSkills) : null,
      data.requiredLanguages ? JSON.stringify(data.requiredLanguages) : null,
      data.salary, data.modality, data.status, id,
    ]
  );
  return rows[0] || null;
}

async function setStatus(id, status) {
  const { rows } = await db.query(
    'UPDATE vacancies SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

// RF16 - vacantes activas de UNA empresa (la del entorno activo del candidato).
async function listActiveForCompany(companyId, { title, modality } = {}) {
  const conditions = [`v.status = 'active'`, 'v.company_id = $1'];
  const values = [companyId];

  if (title) {
    values.push(`%${title}%`);
    conditions.push(`v.title ILIKE $${values.length}`);
  }
  if (modality) {
    values.push(modality);
    conditions.push(`v.modality = $${values.length}`);
  }

  const { rows } = await db.query(
    `SELECT v.*, c.name AS company_name, c.location AS company_location
     FROM vacancies v JOIN companies c ON c.id = v.company_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY v.created_at DESC`,
    values
  );
  return rows;
}

module.exports = {
  STATUSES, findById, findByIdWithCompanyStatus, listByCompany, create, update, setStatus, listActiveForCompany,
};
