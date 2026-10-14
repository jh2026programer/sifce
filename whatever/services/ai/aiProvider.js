const config = require('../../config/env');
const mockProvider = require('./mockProvider');
const httpProvider = require('./httpProvider');
const anthropicProvider = require('./anthropicProvider');
const openaiProvider = require('./openaiProvider');
const groqProvider = require('./groqProvider');

// ============================================================================
// Adaptador de IA (RNF-M3: independencia del proveedor de IA).
//
// Todo el resto del backend (compatibilityService) solo conoce esta interfaz:
//
//   analyze({ resumeText, candidateProfile, vacancy, criteriaWeights })
//     -> { overallHints: { educationScore, experienceScore, skillsScore,
//                          languagesScore, strengths, gaps, explanation,
//                          extractedProfile } }
//
// Cambiar de proveedor (o de modelo) es cambiar AI_PROVIDER en el .env y, si
// hace falta, agregar un nuevo archivo services/ai/<nombre>Provider.js con la
// misma forma. Ningún controlador ni ruta conoce el proveedor concreto.
//
// Proveedores disponibles:
//  - "mock" (por defecto): análisis determinístico basado en coincidencia de
//    palabras clave entre el CV y los requisitos de la vacante. No es un
//    modelo de lenguaje; existe para poder demostrar el flujo completo sin
//    depender de una API externa real ni de credenciales pagas. Se marca
//    explícitamente como "mock" en cada resultado guardado (columna
//    ai_analysis_results.provider) para nunca presentarlo como si fuera un
//    análisis de IA real.
//  - "anthropic": IA real vía la API de Claude (Anthropic). Requiere
//    AI_API_KEY. Ver services/ai/anthropicProvider.js y docs/MODULO_IA.md.
//  - "openai": IA real vía la API de OpenAI. Requiere AI_API_KEY. Ver
//    services/ai/openaiProvider.js.
//  - "groq": IA real vía la API de Groq (gratis mientras te mantengas dentro
//    de sus límites de velocidad — sin tarjeta de crédito ni crédito de
//    prueba que se agote). Requiere AI_API_KEY. Ver
//    services/ai/groqProvider.js.
//  - "http": reenvía la solicitud a un servicio externo propio configurado en
//    AI_API_URL / AI_API_KEY (para cuando la IA vive en otro servicio, no en
//    este backend). Ver docs/MODULO_IA.md para el contrato esperado.
// ============================================================================

function getProvider() {
  switch (config.ai.provider) {
    case 'anthropic':
      return anthropicProvider;
    case 'openai':
      return openaiProvider;
    case 'groq':
      return groqProvider;
    case 'http':
      return httpProvider;
    case 'mock':
    default:
      return mockProvider;
  }
}

module.exports = {
  name: config.ai.provider,
  analyze: (payload) => getProvider().analyze(payload),
};
