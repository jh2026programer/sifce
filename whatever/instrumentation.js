// ============================================================================
// Monitoreo de rendimiento con New Relic APM (ciclo de vida, etapa 8 · MONITOR).
//
// El agente de New Relic tiene que cargarse ANTES que Express, pg y el resto
// de módulos para poder instrumentarlos (medir cada petición, cada consulta a
// PostgreSQL y cada error). Por eso server.js requiere este archivo en su
// primera línea. Las pruebas automáticas no pasan por server.js: ahí el
// agente nunca se carga.
//
// Solo se activa si hay una clave de licencia:
//   - desarrollo: NEW_RELIC_LICENSE_KEY en whatever/.env
//   - Docker Swarm: secreto montado en NEW_RELIC_LICENSE_KEY_FILE
// Sin clave, SIFCE funciona exactamente igual, sin enviar nada a New Relic.
// ============================================================================
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const keyFile = process.env.NEW_RELIC_LICENSE_KEY_FILE;
if (keyFile && fs.existsSync(keyFile)) {
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  if (key && key !== 'sin-clave') process.env.NEW_RELIC_LICENSE_KEY = key;
}

if (process.env.NEW_RELIC_LICENSE_KEY) {
  // Configuración solo por variables de entorno (sin archivo newrelic.js).
  process.env.NEW_RELIC_NO_CONFIG_FILE = 'true';
  process.env.NEW_RELIC_APP_NAME = process.env.NEW_RELIC_APP_NAME || 'SIFCE';
  process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED = 'true';
  process.env.NEW_RELIC_LOG = process.env.NEW_RELIC_LOG || 'stdout';
  process.env.NEW_RELIC_LOG_LEVEL = process.env.NEW_RELIC_LOG_LEVEL || 'warn';
  // Nunca enviar a New Relic el contenido de las peticiones (contraseñas,
  // datos de candidatos): solo tiempos, rutas y errores.
  process.env.NEW_RELIC_ATTRIBUTES_EXCLUDE = 'request.headers.authorization,request.headers.cookie,request.parameters.*';
  // SIFCE no corre en AWS, Azure, GCP ni Kubernetes: no intentar detectarlos
  // (evita errores inofensivos pero ruidosos en los logs al arrancar).
  for (const vendor of ['AWS', 'AZURE', 'GCP', 'PCF', 'KUBERNETES']) {
    process.env[`NEW_RELIC_UTILIZATION_DETECT_${vendor}`] = 'false';
  }

  require('newrelic');
  // eslint-disable-next-line no-console
  console.log(`[SIFCE] New Relic APM activo (aplicación "${process.env.NEW_RELIC_APP_NAME}")`);
}
