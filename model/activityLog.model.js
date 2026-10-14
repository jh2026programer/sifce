// MODEL — tabla activity_logs (RNF-S5: registro de actividades).
const db = require('./db');

async function create({ userId = null, companyId = null, action, entityType = null, entityId = null, metadata = null }) {
  await db.query(
    `INSERT INTO activity_logs (user_id, company_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, companyId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null]
  );
}

module.exports = { create };
