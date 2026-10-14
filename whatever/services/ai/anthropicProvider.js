const config = require('../../config/env');
const AppError = require('../../utils/AppError');

// ============================================================================
// Proveedor de IA real usando la API de Anthropic (Claude).
//
// Por qué "tool use" y no simplemente pedir JSON en el texto: pedirle a un
// modelo de lenguaje que "responda solo con JSON" en un prompt de texto es
// menos confiable — a veces agrega explicación antes/después, comillas mal
// escapadas, etc. La API de Anthropic permite forzar que el modelo llame a
// una "herramienta" con un esquema de entrada definido (tool_choice), y la
// respuesta llega ya como un objeto estructurado, no como texto libre que
// haya que parsear con riesgo de error. Es el mecanismo recomendado por
// Anthropic para obtener salidas estructuradas de forma confiable.
//
// Variables de entorno usadas (ver whatever/.env.example):
//   AI_PROVIDER=anthropic
//   AI_API_KEY=sk-ant-...        (Claude Console -> API Keys)
//   AI_MODEL=claude-haiku-4-5-20251001   (opcional; por defecto usa Haiku,
//                                         el modelo más económico, adecuado
//                                         para esta tarea de clasificación)
// ============================================================================

const RESULT_TOOL = {
  name: 'reportar_analisis_compatibilidad',
  description:
    'Reporta el resultado del análisis de compatibilidad entre un candidato y una vacante, con un puntaje 0-100 por categoría.',
  input_schema: {
    type: 'object',
    properties: {
      educationScore: { type: 'number', description: 'Compatibilidad de formación académica, 0 a 100' },
      experienceScore: { type: 'number', description: 'Compatibilidad de experiencia laboral, 0 a 100' },
      skillsScore: { type: 'number', description: 'Compatibilidad de habilidades, 0 a 100' },
      languagesScore: { type: 'number', description: 'Compatibilidad de idiomas, 0 a 100' },
      strengths: { type: 'array', items: { type: 'string' }, description: 'Fortalezas concretas del candidato frente a la vacante' },
      gaps: { type: 'array', items: { type: 'string' }, description: 'Brechas concretas del candidato frente a la vacante' },
      explanation: { type: 'string', description: 'Explicación breve y clara para un reclutador no técnico' },
    },
    required: ['educationScore', 'experienceScore', 'skillsScore', 'languagesScore', 'strengths', 'gaps', 'explanation'],
  },
};

function buildPrompt({ resumeText, candidateProfile, vacancy }) {
  return `Eres un analista de selección de personal. Compara el candidato con los requisitos de la vacante y llama a la herramienta "${RESULT_TOOL.name}" con tu evaluación. Sé objetivo: si la información no alcanza para confirmar un requisito, no lo des por cumplido.

REQUISITOS DE LA VACANTE:
- Formación requerida: ${vacancy.required_education || 'No especificada'}
- Experiencia mínima: ${vacancy.min_experience_years || 0} años
- Habilidades requeridas: ${JSON.stringify(vacancy.required_skills || [])}
- Idiomas requeridos: ${JSON.stringify(vacancy.required_languages || [])}

PERFIL ESTRUCTURADO DEL CANDIDATO (formación, experiencia, habilidades, idiomas ya registrados en su cuenta):
${JSON.stringify(
  {
    education: candidateProfile?.education || [],
    experience: candidateProfile?.experience || [],
    skills: candidateProfile?.skills || [],
    languages: candidateProfile?.languages || [],
  },
  null,
  2
)}

TEXTO EXTRAÍDO DE LA HOJA DE VIDA (puede repetir o ampliar lo anterior):
"""${(resumeText || '(sin texto extraído)').slice(0, 6000)}"""`;
}

async function analyze({ resumeText, candidateProfile, vacancy }) {
  if (!config.ai.apiKey) {
    throw new AppError(
      'El proveedor "anthropic" requiere AI_API_KEY en el .env del backend (clave de Claude Console).',
      503
    );
  }

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ai.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ai.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [RESULT_TOOL],
        tool_choice: { type: 'tool', name: RESULT_TOOL.name },
        messages: [{ role: 'user', content: buildPrompt({ resumeText, candidateProfile, vacancy }) }],
      }),
    });
  } catch (err) {
    throw new AppError(`No fue posible contactar la API de Anthropic: ${err.message}`, 503);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new AppError(`La API de Anthropic respondió con error (HTTP ${response.status}): ${bodyText.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  const toolUse = (data.content || []).find((block) => block.type === 'tool_use');
  if (!toolUse) {
    throw new AppError('El modelo no devolvió un resultado estructurado (sin bloque tool_use en la respuesta).', 502);
  }

  const result = toolUse.input || {};
  return {
    educationScore: Number(result.educationScore) || 0,
    experienceScore: Number(result.experienceScore) || 0,
    skillsScore: Number(result.skillsScore) || 0,
    languagesScore: Number(result.languagesScore) || 0,
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    gaps: Array.isArray(result.gaps) ? result.gaps : [],
    explanation: result.explanation || '',
    extractedProfile: { modelRawOutput: result, model: config.ai.model || 'claude-haiku-4-5-20251001' },
  };
}

module.exports = { analyze };
