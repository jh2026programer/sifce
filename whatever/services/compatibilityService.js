const applicationModel = require('../../model/application.model.js');
const vacancyModel = require('../../model/vacancy.model.js');
const candidateModel = require('../../model/candidate.model.js');
const criteriaModel = require('../../model/criteria.model.js');
const aiResultModel = require('../../model/aiResult.model.js');
const aiProvider = require('./ai/aiProvider');
const metrics = require('./metrics');
const microservicios = require('./microservicios');

// Un proveedor de IA real podría devolver un valor fuera de rango; se acota a
// 0-100 antes de enviarlo al microservicio, que rechaza puntajes inválidos.
const toScore = (n) => Math.max(0, Math.min(100, Number(n) || 0));

const DEFAULT_WEIGHT = 25; // repartido en partes iguales si la empresa no configuró criterios (RF14)

// Obtiene los pesos por categoría configurados por la empresa. Si no hay
// criterios configurados, se usa 25/25/25/25 (ver docs/MODULO_IA.md).
async function getCategoryWeights(companyId) {
  const rows = await criteriaModel.sumWeightsByCategory(companyId);

  const weights = {};
  criteriaModel.CATEGORIES.forEach((c) => {
    weights[c] = DEFAULT_WEIGHT;
  });

  if (rows.length > 0) {
    // Si la empresa configuró criterios, se normalizan para que sumen 100.
    const configured = {};
    let sum = 0;
    rows.forEach((r) => {
      configured[r.category] = Number(r.total_weight);
      sum += Number(r.total_weight);
    });
    if (sum > 0) {
      criteriaModel.CATEGORIES.forEach((c) => {
        weights[c] = configured[c] !== undefined ? (configured[c] / sum) * 100 : 0;
      });
    }
  }

  return weights;
}

// Ejecuta el análisis de compatibilidad completo para una postulación y
// persiste el resultado (RF09, RNF-F3: persistencia de resultados).
async function runAnalysis({ applicationId }) {
  const application = await applicationModel.findForAnalysis(applicationId);
  if (!application) throw new Error(`Postulación ${applicationId} no encontrada.`);

  const vacancy = await vacancyModel.findById(application.vacancy_id);
  const candidateProfile = await candidateModel.findAnalysisBundle(application.candidate_id);
  const resumeText = application.extracted_text || '';

  await aiResultModel.markProcessing(applicationId);
  const stopTimer = metrics.startAiTimer();

  try {
    const result = await aiProvider.analyze({ resumeText, candidateProfile, vacancy });
    const weights = await getCategoryWeights(application.company_id);

    // El promedio ponderado lo calcula el microservicio de compatibilidad.
    const { compatibilidad: overallScore } = await microservicios.calcularCompatibilidad(
      {
        formacion: toScore(result.educationScore),
        experiencia: toScore(result.experienceScore),
        habilidades: toScore(result.skillsScore),
        idiomas: toScore(result.languagesScore),
      },
      weights
    );

    await aiResultModel.saveCompleted(applicationId, { provider: aiProvider.name, overallScore, result });
    stopTimer();
    metrics.recordAiAnalysis('completed');

    return { success: true, overallScore };
  } catch (err) {
    stopTimer();
    metrics.recordAiAnalysis('failed');
    await aiResultModel.markFailed(applicationId, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { runAnalysis, getCategoryWeights };
