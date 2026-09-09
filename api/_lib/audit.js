// api/_lib/audit.js
const Audit = require('../../models/Audit');

async function logAudit({ exceptionId, actor = 'system', eventType, details = {} }) {
  await Audit.create({ exceptionId, actor, eventType, details, timestamp: new Date() });
}

module.exports = { logAudit };
