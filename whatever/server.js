// Punto de entrada de la API: toma la app de app.js y la pone a escuchar.
// La primera línea activa New Relic (si hay clave) antes de cargar lo demás.
require('./instrumentation');

const config = require('./config/env');
const app = require('./app');
const aiProvider = require('./services/ai/aiProvider');
const { completarPrediccionesPendientes } = require('./services/compatibilityService');

app.listen(config.port, () => {
  // Minería de datos: asegura la columna de predicción y calcula la de las
  // postulaciones que ya estaban analizadas (no bloquea el arranque).
  completarPrediccionesPendientes()
    .then((n) => {
      // eslint-disable-next-line no-console
      if (n > 0) console.log(`[SIFCE] Predicción de selección calculada para ${n} postulación(es) existente(s).`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`[SIFCE] No se pudieron completar las predicciones pendientes: ${err.message}`);
    });

  // eslint-disable-next-line no-console
  console.log(`[SIFCE] API escuchando en http://localhost:${config.port}/api/v1 (entorno: ${config.nodeEnv})`);

  // Diagnóstico explícito del módulo de IA al arrancar: cambiar AI_PROVIDER
  // en el .env no tiene efecto hasta que el proceso de Node se reinicia de
  // verdad (las variables de entorno se leen una sola vez, al arrancar) —
  // este mensaje evita quedarse adivinando si el cambio "pegó" o no.
  const needsKey = ['anthropic', 'openai', 'groq', 'http'].includes(config.ai.provider);
  if (needsKey && !config.ai.apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SIFCE] ⚠️  AI_PROVIDER="${config.ai.provider}" pero AI_API_KEY está vacío. ` +
      `El análisis de compatibilidad fallará (o seguirá usando "mock" si no reiniciaste el proceso). ` +
      `Completa AI_API_KEY en whatever/.env y reinicia la API.`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      `[SIFCE] Módulo de IA activo: "${aiProvider.name}"` +
      (aiProvider.name === 'mock' ? ' (demo, sin costo — cambia AI_PROVIDER en .env para usar IA real)' : `, modelo: ${config.ai.model || '(por defecto del proveedor)'}`)
    );
  }
});

module.exports = app;
