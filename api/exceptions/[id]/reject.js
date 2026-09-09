const { connectDB } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');
const { logAudit } = require('../../_lib/audit');
const Exception = require('../../../models/Exception');
const Action = require('../../../models/Action');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  try {
    await connectDB();
    const { id } = req.query;
    const rejector = req.body?.rejector || 'unknown-approver';
    const reason = req.body?.reason || '';

    const exception = await Exception.findById(id);
    if (!exception) return res.status(404).json({ error: 'Exception not found' });

    const action = await Action.findOne({ exceptionId: id }).sort({ createdAt: -1 });
    if (action) {
      action.status = 'rejected';
      await action.save();
    }

    exception.status = 'failed';
    await exception.save();

    await logAudit({
      exceptionId: id,
      actor: rejector,
      eventType: 'rejected',
      details: { actionId: action?._id, reason },
    });

    return res.status(200).json({ exception, action });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
