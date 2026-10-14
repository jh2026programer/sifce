// ============================================================================
// Proveedor MOCK del módulo de IA.
//
// Estrategia (documentada, no arbitraria — Sección 11 del prompt):
//  - Formación: compara el título/área requerido por la vacante contra la
//    formación registrada por el candidato y el texto del CV.
//  - Experiencia: compara los años mínimos requeridos contra la suma de años
//    de experiencia registrados por el candidato.
//  - Habilidades: por cada habilidad requerida, busca coincidencia (nombre)
//    en las habilidades registradas por el candidato o en el texto del CV.
//  - Idiomas: por cada idioma requerido, busca coincidencia de idioma (y,
//    si es posible, de nivel) en los idiomas registrados por el candidato.
//
// Cada categoría produce un puntaje 0-100. El promedio ponderado (usando los
// pesos configurados por la empresa en evaluation_criteria) lo calcula
// compatibilityService, no este proveedor — así el proveedor solo "sabe" de
// coincidencia de contenido, y la ponderación de negocio vive en un solo
// lugar.
// ============================================================================

function normalize(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .trim();
}

function textContains(haystack, needle) {
  if (!needle) return false;
  return normalize(haystack).includes(normalize(needle));
}

function scoreEducation(vacancy, candidateProfile, resumeText) {
  const required = vacancy.required_education;
  if (!required || !required.trim()) {
    return { score: 100, detail: 'La vacante no especifica un requisito de formación.' };
  }

  const educationRecords = candidateProfile.education || [];
  const matchInRecords = educationRecords.some(
    (e) => textContains(e.degree, required) || textContains(e.field_of_study, required)
  );
  const matchInResume = textContains(resumeText, required);

  if (matchInRecords || matchInResume) {
    return { score: 100, detail: `Cumple con la formación requerida: "${required}".`, met: true };
  }
  return { score: 30, detail: `No se encontró evidencia de la formación requerida: "${required}".`, met: false };
}

function scoreExperience(vacancy, candidateProfile) {
  const minYears = Number(vacancy.min_experience_years) || 0;
  if (minYears <= 0) {
    return { score: 100, detail: 'La vacante no exige una experiencia mínima.', years: null };
  }

  const totalYears = (candidateProfile.experience || []).reduce((sum, e) => sum + (Number(e.years) || 0), 0);
  const ratio = totalYears / minYears;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 100)));

  return {
    score,
    detail: `El candidato registra ${totalYears} año(s) de experiencia frente a ${minYears} requerido(s).`,
    years: totalYears,
    met: totalYears >= minYears,
  };
}

function scoreSkills(vacancy, candidateProfile, resumeText) {
  const required = Array.isArray(vacancy.required_skills) ? vacancy.required_skills : [];
  if (required.length === 0) {
    return { score: 100, matched: [], missing: [] };
  }

  const candidateSkillNames = (candidateProfile.skills || []).map((s) => s.name);
  const matched = [];
  const missing = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const req of required) {
    const skillName = typeof req === 'string' ? req : req.name;
    const weight = typeof req === 'object' && req.weight ? Number(req.weight) : 1;
    totalWeight += weight;

    const found =
      candidateSkillNames.some((s) => textContains(s, skillName) || textContains(skillName, s)) ||
      textContains(resumeText, skillName);

    if (found) {
      matched.push(skillName);
      matchedWeight += weight;
    } else {
      missing.push(skillName);
    }
  }

  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 100;
  return { score, matched, missing };
}

function scoreLanguages(vacancy, candidateProfile, resumeText) {
  const required = Array.isArray(vacancy.required_languages) ? vacancy.required_languages : [];
  if (required.length === 0) {
    return { score: 100, matched: [], missing: [] };
  }

  const candidateLanguages = candidateProfile.languages || [];
  const matched = [];
  const missing = [];

  for (const req of required) {
    const langName = typeof req === 'string' ? req : req.language;
    const found =
      candidateLanguages.some((l) => textContains(l.language, langName)) || textContains(resumeText, langName);
    if (found) {
      matched.push(langName);
    } else {
      missing.push(langName);
    }
  }

  const score = Math.round((matched.length / required.length) * 100);
  return { score, matched, missing };
}

async function analyze({ resumeText, candidateProfile, vacancy }) {
  const education = scoreEducation(vacancy, candidateProfile, resumeText);
  const experience = scoreExperience(vacancy, candidateProfile);
  const skills = scoreSkills(vacancy, candidateProfile, resumeText);
  const languages = scoreLanguages(vacancy, candidateProfile, resumeText);

  const strengths = [];
  const gaps = [];

  if (education.met) strengths.push(`Formación acorde a lo solicitado (${vacancy.required_education}).`);
  else if (vacancy.required_education) gaps.push(`Formación requerida no evidenciada: ${vacancy.required_education}.`);

  if (experience.met) strengths.push(experience.detail);
  else if (experience.years !== null) gaps.push(experience.detail);

  skills.matched.forEach((s) => strengths.push(`Cuenta con la habilidad requerida: ${s}.`));
  skills.missing.forEach((s) => gaps.push(`No se evidenció la habilidad requerida: ${s}.`));

  languages.matched.forEach((l) => strengths.push(`Cumple el idioma requerido: ${l}.`));
  languages.missing.forEach((l) => gaps.push(`No se evidenció el idioma requerido: ${l}.`));

  const explanation =
    `Análisis generado en modo DEMO (sin IA externa). Se comparó el contenido del CV y del perfil ` +
    `del candidato contra los requisitos de la vacante: formación (${education.score}%), experiencia ` +
    `(${experience.score}%), habilidades (${skills.score}%) e idiomas (${languages.score}%). ` +
    `Fortalezas identificadas: ${strengths.length}. Brechas identificadas: ${gaps.length}.`;

  return {
    educationScore: education.score,
    experienceScore: experience.score,
    skillsScore: skills.score,
    languagesScore: languages.score,
    strengths,
    gaps,
    explanation,
    extractedProfile: {
      educationMatch: education.detail,
      experienceYearsDetected: experience.years,
      skillsMatched: skills.matched,
      languagesMatched: languages.matched,
    },
  };
}

module.exports = { analyze };
