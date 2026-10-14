// Utilidades de base de datos para las pruebas.
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const config = require('../../config/env');

const ROOT = path.resolve(__dirname, '../../..');
const SCHEMA = process.env.SIFCE_TEST_SCHEMA;

// Deja la base de pruebas en el estado inicial conocido: schema vacío +
// tablas (model/schema.sql) + datos demo (model/scripts/seed.js).
// Cada archivo de prueba la llama en beforeAll para no depender de lo que
// hicieron los demás archivos.
async function resetDatabase() {
  // Protección: este helper SOLO puede borrar el schema de pruebas.
  if (SCHEMA !== 'sifce_test') {
    throw new Error(`Schema de pruebas inesperado: "${SCHEMA}". Se aborta para no tocar datos reales.`);
  }

  const client = new Client({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: '-c search_path=public',
  });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA}`);
  } finally {
    await client.end();
  }

  // Mismos scripts que usa el equipo (npm run db:create / db:seed), en un
  // proceso aparte que hereda el entorno de pruebas (PGOPTIONS, IA mock...).
  const run = (script) => execFileSync(process.execPath, [path.join(ROOT, 'model/scripts', script)], {
    env: process.env,
    stdio: 'pipe',
  });
  run('dbSetup.js');
  run('seed.js');
}

module.exports = { resetDatabase };
