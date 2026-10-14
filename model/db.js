// ============================================================================
// MODEL — conexión a PostgreSQL.
//
// Es el único punto del backend que habla directamente con la base de datos.
// Los archivos *.model.js de esta carpeta lo usan para ejecutar su SQL; las
// capas de "whatever" (controladores, servicios, middleware) nunca escriben
// SQL: siempre llaman a una función de un modelo.
// ============================================================================
const { Pool } = require('pg');
const config = require('../whatever/config/env');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] Error inesperado en el pool de PostgreSQL:', err.message);
});

// Ejecuta fn(client) dentro de una transacción: COMMIT si termina bien,
// ROLLBACK si lanza un error (que se vuelve a lanzar al llamador). Los
// modelos reciben ese "client" como primer argumento (executor) cuando la
// operación debe participar en la transacción.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  withTransaction,
};
