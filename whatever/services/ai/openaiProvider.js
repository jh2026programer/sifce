const config = require('../../config/env');
const AppError = require('../../utils/AppError');

// ============================================================================
// Proveedor de IA real usando la API de OpenAI, como alternativa a Anthropic
// (RNF-M3: el sistema no depende de un único proveedor). Usa "function
// calling" para forzar una respuesta estructurada, en vez de parsear texto
// libre en busca de JSON.
//
// Variables de entorno usadas (ver whatever/.env.example):
//   AI_PROVIDER=openai
//   AI_API_KEY=sk-...             (platform.openai.com -> API keys)
//   AI_MODEL=gpt-5.6-luna          (opcional; por defecto un modelo económico
//                                   adecuado para esta tarea de clasificación
//                                   — verifica el nombre vigente en la
//                                   documentación de OpenAI, los nombres de
//                                   modelo cambian con frecuencia)
// ============================================================================

const RESULT_FUNCTION = {
  name: 'reportar_analisis_compatibilidad',
  description:
    'Reporta el resultado del análisis de compatibilidad entre un candidato y una vacante, con un puntaje 0-100 por categoría.',
  parameters: {
    type: 'object',
    properties: {
      educationScore: { type: 'number', description: 'Compatibilidad de formación académica, 0 a 100' },
      experienceScore: { type: 'number', description: 'Compatibilidad de experiencia laboral, 0 a 100' },
      skillsScore: { type: 'number', description: 'Compatibilidad de habilidades, 0 a 100' },
      languagesScore: { type: 'number', description: 'Compatibilidad de idiomas, 0 a 100' },
      strengths: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
      explanation: { type: 'string' },
    },
    required: ['educationScore', 'experienceScore', 'skillsScore', 'languagesScore', 'strengths', 'gaps', 'explanation'],
  },
};

function buildPrompt({ resumeText, candidateProfile, vacancy }) {
  return `Eres un analista de selección de personal. Compara el candidato con los requisitos de la vacante y llama a la función "${RESULT_FUNCTION.name}" con tu evaluación. Sé objetivo: si la información no alcanza para confirmar un requisito, no lo des por cumplido.

REQUISITOS DE LA VACANTE:
- Formación requerida: ${vacancy.required_education || 'No especificada'}
- Experiencia mínima: ${vacancy.min_experience_years || 0} años
- Habilidades requeridas: ${JSON.stringify(vacancy.required_skills || [])}
- Idiomas requeridos: ${JSON.stringify(vacancy.required_languages || [])}

PERFIL ESTRUCTURADO DEL CANDIDATO:
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

TEXTO EXTRAÍDO DE LA HOJA DE VIDA:
"""${(resumeText || '(sin texto extraído)').slice(0, 6000)}"""`;
}

async function analyze({ resumeText, candidateProfile, vacancy }) {
  if (!config.ai.apiKey) {
    throw new AppError('El proveedor "openai" requiere AI_API_KEY en el .env del backend.', 503);
  }

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model || 'gpt-5.6-luna',
        messages: [{ role: 'user', content: buildPrompt({ resumeText, candidateProfile, vacancy }) }],
        tools: [{ type: 'function', function: RESULT_FUNCTION }],
        tool_choice: { type: 'function', function: { name: RESULT_FUNCTION.name } },
      }),
    });
  } catch (err) {
    throw new AppError(`No fue posible contactar la API de OpenAI: ${err.message}`, 503);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new AppError(`La API de OpenAI respondió con error (HTTP ${response.status}): ${bodyText.slice(0, 300)}`, 502);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new AppError('El modelo no devolvió un resultado estructurado (sin tool_calls en la respuesta).', 502);
  }

  let result;
  try {
    result = JSON.parse(toolCall.function.arguments);
  } catch (err) {
    throw new AppError('No fue posible interpretar la respuesta estructurada del modelo.', 502);
  }

  return {
    educationScore: Number(result.educationScore) || 0,
    experienceScore: Number(result.experienceScore) || 0,
    skillsScore: Number(result.skillsScore) || 0,
    languagesScore: Number(result.languagesScore) || 0,
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    gaps: Array.isArray(result.gaps) ? result.gaps : [],
    explanation: result.explanation || '',
    extractedProfile: { modelRawOutput: result, model: config.ai.model || 'gpt-5.6-luna' },
  };
}

module.exports = { analyze };
