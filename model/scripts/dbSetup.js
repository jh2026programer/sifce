/* eslint-disable no-console */
// Ejecuta model/schema.sql contra la base de datos configurada en .env.
// Requiere que la base de datos y el usuario ya existan (ver README paso
// "Creación de la base de datos"). Uso: npm run db:create
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function main() {
  const schemaPath = path.resolve(__dirname, '../schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log(`Aplicando esquema desde ${schemaPath} ...`);
  await db.query(sql);
  console.log('✅ Esquema aplicado correctamente.');
  await db.pool.end();
}

main().catch((err) => {
  console.error('❌ Error aplicando el esquema:', err.message);
  process.exit(1);
});
