const { connectDB } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');
const Exception = require('../../../models/Exception');
const Decision = require('../../../models/Decision');
const Action = require('../../../models/Action');
const Audit = require('../../../models/Audit');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  await connectDB();
  const { id } = req.query;

  const exception = await Exception.findById(id);
  if (!exception) return res.status(404).json({ error: 'Exception not found' });

  const [decisions, actions, audit] = await Promise.all([
    Decision.find({ exceptionId: id }).sort({ createdAt: -1 }),
    Action.find({ exceptionId: id }).sort({ createdAt: -1 }),
    Audit.find({ exceptionId: id }).sort({ timestamp: 1 }),
  ]);

  return res.status(200).json({ exception, decisions, actions, audit });
};
