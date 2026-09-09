const { connectDB } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');
const Action = require('../../../models/Action');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  await connectDB();
  const action = await Action.findById(req.query.id);
  if (!action) return res.status(404).json({ error: 'Action not found' });
  return res.status(200).json({ action });
};
