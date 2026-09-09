const { connectDB } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const Audit = require('../../models/Audit');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  await connectDB();
  const audit = await Audit.find({ exceptionId: req.query.exceptionId }).sort({ timestamp: 1 });
  return res.status(200).json({ audit });
};
