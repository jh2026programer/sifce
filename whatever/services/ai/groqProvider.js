const config = require('../../config/env');
const AppError = require('../../utils/AppError');

// ============================================================================
// Proveedor de IA real usando la API de Groq — GRATIS de verdad para este
// caso de uso: a diferencia de Anthropic/OpenAI (que solo dan un crédito de
// prueba pequeño que se agota), Groq mantiene un nivel gratuito permanente,
// sin tarjeta de crédito, mientras te mantengas dentro de sus límites de
// velocidad (a la fecha: 30 solicitudes/minuto y 14.400 solicitudes/día por
// organización — de sobra para un proyecto académico o una demo). Verifica
// los límites vigentes en https://console.groq.com/docs/rate-limits, porque
// los proveedores los ajustan de vez en cuando.
//
// Groq ejecuta modelos de pesos abiertos (Llama, GPT-OSS, Qwen, etc.) sobre
// hardware propio (LPU) y expone una API "compatible con OpenAI": mismo
// formato de mensajes, mismo mecanismo de function calling. Por eso este
// archivo es casi idéntico a openaiProvider.js — solo cambia la URL base, el
// modelo por defecto, y que la clave se pide en https://console.groq.com/keys
// en vez de platform.openai.com.
//
// Variables de entorno usadas (ver whatever/.env.example):
//   AI_PROVIDER=groq
//   AI_API_KEY=gsk_...              (console.groq.com -> API Keys)
//   AI_MODEL=openai/gpt-oss-20b (opcional; un modelo que ha estado
//                                     disponible en el nivel gratuito, pero
//                                     Groq mueve modelos a su plan Enterprise
//                                     sin previo aviso (ya nos pasó una vez
//                                     con llama-3.3-70b-versatile). Si el
//                                     análisis falla con "model_not_found",
//                                     consulta el catálogo vigente PARA TU
//                                     CUENTA con:
//                                       curl https://api.groq.com/openai/v1/models \
//                                         -H "Authorization: Bearer TU_CLAVE"
//                                     y usa uno de los modelos de chat que
//                                     aparezcan ahí (evita los de audio o
//                                     moderación, no sirven para esta tarea)
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
  return `Eres un analista de selección de personal. Compara el candidato con los requisitos de la vacante y llama a la función "${RESULT_FUNCTION.name}" con tu evaluación. Sé objetivo: si la información no alcanza para confirmar un requisito, no lo des por cumplido. Responde llamando SIEMPRE a la función, nunca con texto libre.

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
    throw new AppError('El proveedor "groq" requiere AI_API_KEY en el .env del backend (clave de console.groq.com).', 503);
  }

  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model || 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: buildPrompt({ resumeText, candidateProfile, vacancy }) }],
        tools: [{ type: 'function', function: RESULT_FUNCTION }],
        tool_choice: { type: 'function', function: { name: RESULT_FUNCTION.name } },
      }),
    });
  } catch (err) {
    throw new AppError(`No fue posible contactar la API de Groq: ${err.message}`, 503);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    // Groq retira o renombra modelos con cierta frecuencia (incluso modelos
    // que antes eran gratuitos pasan a requerir un plan Enterprise). En vez
    // de solo mostrar el error crudo, se detecta este caso puntual y se
    // indica exactamente cómo consultar el catálogo vigente PARA ESA CUENTA
    // (la lista puede variar según el plan), en lugar de dejar que alguien
    // adivine un nombre de modelo que también podría estar desactualizado.
    let parsedCode = null;
    try { parsedCode = JSON.parse(bodyText)?.error?.code; } catch { /* respuesta no era JSON, se ignora */ }

    if (response.status === 404 && parsedCode === 'model_not_found') {
      throw new AppError(
        `El modelo "${config.ai.model || 'openai/gpt-oss-20b'}" ya no está disponible en Groq (los proveedores cambian su catálogo con frecuencia). ` +
        `Consulta los modelos disponibles para tu cuenta con: curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer TU_CLAVE" ` +
        `y actualiza AI_MODEL en whatever/.env con uno de los que aparezcan ahí.`,
        502
      );
    }
    // Groq responde 429 cuando se supera el límite gratuito de solicitudes
    // por minuto/día — es útil distinguirlo en el mensaje de error.
    if (response.status === 429) {
      throw new AppError('Se alcanzó el límite de la capa gratuita de Groq por ahora. Intenta de nuevo en unos minutos.', 429);
    }
    throw new AppError(`La API de Groq respondió con error (HTTP ${response.status}): ${bodyText.slice(0, 300)}`, 502);
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
    extractedProfile: { modelRawOutput: result, model: config.ai.model || 'openai/gpt-oss-20b' },
  };
}

module.exports = { analyze };
