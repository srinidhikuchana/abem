const { connectDB } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const Exception = require('../../models/Exception');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  await connectDB();

  if (req.method === 'GET') {
    const { status, type, severity, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    const exceptions = await Exception.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    return res.status(200).json({ exceptions });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
