const config = require('../../config/env');
const AppError = require('../../utils/AppError');

// ============================================================================
// Proveedor de IA real, mediante una API externa configurada por variables de
// entorno (AI_API_URL, AI_API_KEY). La API key NUNCA se hardcodea (RNF-S3 /
// Sección 9) y solo vive en el .env del servidor.
//
// Contrato esperado del servicio externo (documentado en docs/MODULO_IA.md):
//
//   POST {AI_API_URL}
//   Headers: Authorization: Bearer {AI_API_KEY}, Content-Type: application/json
//   Body: { resumeText, candidateProfile, vacancy }
//   Respuesta 200 JSON:
//   {
//     "educationScore": 0-100, "experienceScore": 0-100,
//     "skillsScore": 0-100, "languagesScore": 0-100,
//     "strengths": string[], "gaps": string[], "explanation": string,
//     "extractedProfile": object
//   }
//
// Si el servicio no está configurado o falla, se lanza un AppError legible
// que el controlador convierte en un resultado de análisis con status
// "failed" (RNF-F4: recuperación ante fallos de conexión), sin tumbar el
// resto de la aplicación.
// ============================================================================
async function analyze({ resumeText, candidateProfile, vacancy }) {
  if (!config.ai.apiUrl) {
    throw new AppError(
      'El proveedor de IA "http" no está configurado (falta AI_API_URL). Define AI_PROVIDER=mock o configura el servicio externo.',
      503
    );
  }

  let response;
  try {
    response = await fetch(config.ai.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.ai.apiKey ? { Authorization: `Bearer ${config.ai.apiKey}` } : {}),
      },
      body: JSON.stringify({ resumeText, candidateProfile, vacancy }),
    });
  } catch (err) {
    throw new AppError(`No fue posible contactar el servicio de IA: ${err.message}`, 503);
  }

  if (!response.ok) {
    throw new AppError(`El servicio de IA respondió con error (HTTP ${response.status}).`, 502);
  }

  const data = await response.json();
  return {
    educationScore: Number(data.educationScore) || 0,
    experienceScore: Number(data.experienceScore) || 0,
    skillsScore: Number(data.skillsScore) || 0,
    languagesScore: Number(data.languagesScore) || 0,
    strengths: Array.isArray(data.strengths) ? data.strengths : [],
    gaps: Array.isArray(data.gaps) ? data.gaps : [],
    explanation: data.explanation || '',
    extractedProfile: data.extractedProfile || {},
  };
}

module.exports = { analyze };
