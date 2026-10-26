// Se ejecuta ANTES de cargar cualquier módulo de la API en cada archivo de
// prueba (jest "setupFiles"). Fija un entorno de pruebas aislado y predecible.
// dotenv nunca sobrescribe variables ya definidas, así que estos valores
// ganan sobre whatever/.env (de ahí solo se toman las credenciales de la BD).
const os = require('os');
const path = require('path');

const TEST_SCHEMA = 'sifce_test';

Object.assign(process.env, {
  NODE_ENV: 'test',
  // Todas las tablas de prueba viven en un schema propio: nunca se tocan los
  // datos reales del schema "public".
  PGOPTIONS: `-c search_path=${TEST_SCHEMA},public`,
  // IA determinística y gratuita; sin CAPTCHA ni OTP para poder automatizar.
  AI_PROVIDER: 'mock',
  CAPTCHA_ENABLED: 'false',
  OTP_ENABLED: 'false',
  LOGIN_MAX_ATTEMPTS: '5',
  // Sin microservicios: la API usa su código en el mismo proceso. La prueba
  // microservicios.test.js los levanta de verdad y fija estas URL.
  MS_COMPATIBILIDAD_URL: '',
  MS_VALIDADOR_CV_URL: '',
  RESUME_UPLOAD_DIR: path.join(os.tmpdir(), 'sifce-test-uploads'),
});

process.env.SIFCE_TEST_SCHEMA = TEST_SCHEMA;
