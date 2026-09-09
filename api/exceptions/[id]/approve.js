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
    const approver = req.body?.approver || 'unknown-approver';

    const exception = await Exception.findById(id);
    if (!exception) return res.status(404).json({ error: 'Exception not found' });
    if (exception.status !== 'approval_pending') {
      return res.status(400).json({ error: `Exception is not awaiting approval (status: ${exception.status})` });
    }

    const action = await Action.findOne({ exceptionId: id }).sort({ createdAt: -1 });
    if (!action) return res.status(400).json({ error: 'No action found to approve' });

    action.status = 'approved';
    await action.save();

    exception.status = 'decided';
    await exception.save();

    await logAudit({ exceptionId: id, actor: approver, eventType: 'approved', details: { actionId: action._id } });

    return res.status(200).json({ exception, action });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
