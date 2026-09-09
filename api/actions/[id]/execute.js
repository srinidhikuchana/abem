const { connectDB } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');
const { executeTool } = require('../../_lib/tools');
const { logAudit } = require('../../_lib/audit');
const Action = require('../../../models/Action');
const Exception = require('../../../models/Exception');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  try {
    await connectDB();
    const { id } = req.query;

    const action = await Action.findById(id);
    if (!action) return res.status(404).json({ error: 'Action not found' });

    if (!['approved'].includes(action.status)) {
      return res.status(400).json({ error: `Action must be "approved" before execution (status: ${action.status})` });
    }

    action.status = 'executing';
    await action.save();

    let result;
    let newActionStatus;
    try {
      result = await executeTool(action.action_type, {
        ...action.params,
        exception_id: action.exceptionId,
        idempotency_key: action.idempotencyKey,
      });
      newActionStatus = result.ok ? 'completed' : 'failed';
    } catch (toolErr) {
      result = { ok: false, error: toolErr.message };
      newActionStatus = 'failed';
    }

    // Deterministic verification: did the tool report success?
    const verification = { success: !!result.ok, checkedAt: new Date(), raw: result };

    action.status = newActionStatus;
    action.result = result;
    action.verification = verification;
    action.executedAt = new Date();
    await action.save();

    const exception = await Exception.findById(action.exceptionId);
    if (exception) {
      exception.status = verification.success ? 'resolved' : 'failed';
      if (verification.success) exception.resolvedAt = new Date();
      await exception.save();
    }

    await logAudit({
      exceptionId: action.exceptionId,
      eventType: 'action_executed',
      details: { actionId: action._id, action_type: action.action_type, result, verification },
    });

    return res.status(200).json({ action, verification, exception });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
