const { connectDB } = require('../_lib/db');
const { requireAuth } = require('../_lib/auth');
const { DEFAULT_POLICIES } = require('../_lib/policyEngine');
const Policy = require('../../models/Policy');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  await connectDB();

  if (req.method === 'GET') {
    const policies = await Policy.find({});
    return res.status(200).json({ policies, defaults: DEFAULT_POLICIES });
  }

  if (req.method === 'POST') {
    const { name, config, active = true } = req.body || {};
    if (!name || !config) return res.status(400).json({ error: 'name and config are required' });
    const policy = await Policy.create({ name, config, active });
    return res.status(201).json({ policy });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
