// MODEL — perfil del candidato y sus secciones (RF06).
const db = require('./db');

async function findProfileIdByUserId(userId) {
  const { rows } = await db.query('SELECT id FROM candidate_profiles WHERE user_id = $1', [userId]);
  return rows[0] ? rows[0].id : null;
}

async function createProfile(executor, userId) {
  const { rows } = await executor.query(
    'INSERT INTO candidate_profiles (user_id) VALUES ($1) RETURNING id',
    [userId]
  );
  return rows[0].id;
}

async function updateProfile(candidateId, { phone, location, headline, summary }) {
  await db.query(
    `UPDATE candidate_profiles SET
       phone = COALESCE($1, phone), location = COALESCE($2, location),
       headline = COALESCE($3, headline), summary = COALESCE($4, summary), updated_at = now()
     WHERE id = $5`,
    [phone, location, headline, summary, candidateId]
  );
}

// Perfil completo (datos personales + todas las secciones + hojas de vida).
async function findFullProfile(candidateId) {
  const [profile, education, experience, skills, languages, certifications, resumes] = await Promise.all([
    db.query(
      `SELECT cp.*, u.full_name, u.email FROM candidate_profiles cp
       JOIN users u ON u.id = cp.user_id WHERE cp.id = $1`,
      [candidateId]
    ),
    db.query('SELECT * FROM candidate_education WHERE candidate_id = $1 ORDER BY year_completed DESC NULLS LAST', [candidateId]),
    db.query('SELECT * FROM candidate_experience WHERE candidate_id = $1 ORDER BY years DESC', [candidateId]),
    db.query('SELECT * FROM candidate_skills WHERE candidate_id = $1', [candidateId]),
    db.query('SELECT * FROM candidate_languages WHERE candidate_id = $1', [candidateId]),
    db.query('SELECT * FROM candidate_certifications WHERE candidate_id = $1', [candidateId]),
    db.query('SELECT id, file_name, status, uploaded_at FROM resumes WHERE candidate_id = $1 ORDER BY uploaded_at DESC', [candidateId]),
  ]);

  if (!profile.rows[0]) return null;

  return {
    ...profile.rows[0],
    education: education.rows,
    experience: experience.rows,
    skills: skills.rows,
    languages: languages.rows,
    certifications: certifications.rows,
    resumes: resumes.rows,
  };
}

// Datos del perfil que recibe el módulo de IA para el análisis (RF09).
async function findAnalysisBundle(candidateId) {
  const [profileRes, educationRes, experienceRes, skillsRes, languagesRes] = await Promise.all([
    db.query('SELECT * FROM candidate_profiles WHERE id = $1', [candidateId]),
    db.query('SELECT * FROM candidate_education WHERE candidate_id = $1', [candidateId]),
    db.query('SELECT * FROM candidate_experience WHERE candidate_id = $1', [candidateId]),
    db.query('SELECT * FROM candidate_skills WHERE candidate_id = $1', [candidateId]),
    db.query('SELECT * FROM candidate_languages WHERE candidate_id = $1', [candidateId]),
  ]);

  return {
    profile: profileRes.rows[0] || null,
    education: educationRes.rows,
    experience: experienceRes.rows,
    skills: skillsRes.rows,
    languages: languagesRes.rows,
  };
}

// --- Secciones del perfil: formación, experiencia, habilidades, idiomas,
// certificaciones. Cada una declara su tabla y cómo se mapea cada campo del
// body (camelCase) a su columna, con un valor por defecto opcional.
const SECTIONS = {
  education: {
    table: 'candidate_education',
    columns: [
      { field: 'institution', column: 'institution' },
      { field: 'degree', column: 'degree' },
      { field: 'fieldOfStudy', column: 'field_of_study' },
      { field: 'yearCompleted', column: 'year_completed' },
    ],
  },
  experience: {
    table: 'candidate_experience',
    columns: [
      { field: 'companyName', column: 'company_name' },
      { field: 'position', column: 'position' },
      { field: 'years', column: 'years', default: 0 },
      { field: 'description', column: 'description' },
    ],
  },
  skills: {
    table: 'candidate_skills',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'type', column: 'type', default: 'tecnica' },
      { field: 'level', column: 'level' },
    ],
  },
  languages: {
    table: 'candidate_languages',
    columns: [
      { field: 'language', column: 'language' },
      { field: 'level', column: 'level', default: 'basico' },
    ],
  },
  certifications: {
    table: 'candidate_certifications',
    columns: [
      { field: 'name', column: 'name' },
      { field: 'issuer', column: 'issuer' },
      { field: 'year', column: 'year' },
    ],
  },
};

async function addSectionItem(section, candidateId, data) {
  const { table, columns } = SECTIONS[section];
  // Si el campo no viene, se usa el "default" declarado (si existe) en vez de
  // enviar NULL explícito, que rompería columnas NOT NULL DEFAULT.
  const values = columns.map((c) => data[c.field] ?? c.default ?? null);
  const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
  const { rows } = await db.query(
    `INSERT INTO ${table} (candidate_id, ${columns.map((c) => c.column).join(', ')})
     VALUES ($1, ${placeholders}) RETURNING *`,
    [candidateId, ...values]
  );
  return rows[0];
}

// Devuelve true si se eliminó (el registro existía y era del candidato).
async function removeSectionItem(section, itemId, candidateId) {
  const { table } = SECTIONS[section];
  const { rowCount } = await db.query(`DELETE FROM ${table} WHERE id = $1 AND candidate_id = $2`, [itemId, candidateId]);
  return rowCount > 0;
}

// Aislamiento (RNF-S4): una empresa solo ve candidatos que se postularon a
// alguna de sus vacantes.
async function hasAppliedToCompany(candidateId, companyId) {
  const { rows } = await db.query(
    `SELECT 1 FROM applications a JOIN vacancies v ON v.id = a.vacancy_id
     WHERE a.candidate_id = $1 AND v.company_id = $2 LIMIT 1`,
    [candidateId, companyId]
  );
  return rows.length > 0;
}

module.exports = {
  SECTIONS,
  findProfileIdByUserId,
  createProfile,
  updateProfile,
  findFullProfile,
  findAnalysisBundle,
  addSectionItem,
  removeSectionItem,
  hasAppliedToCompany,
};
