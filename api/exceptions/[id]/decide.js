const { connectDB } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');
const { evaluateAction, DEFAULT_POLICIES } = require('../../_lib/policyEngine');
const { logAudit } = require('../../_lib/audit');
const Exception = require('../../../models/Exception');
const Decision = require('../../../models/Decision');
const Action = require('../../../models/Action');
const Policy = require('../../../models/Policy');

async function loadActivePolicies() {
  const docs = await Policy.find({ active: true });
  if (!docs.length) return DEFAULT_POLICIES;
  // Merge all active policy configs on top of defaults (later docs win on conflicts)
  return docs.reduce((acc, p) => ({ ...acc, ...p.config }), { ...DEFAULT_POLICIES });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  try {
    await connectDB();
    const { id } = req.query;

    const exception = await Exception.findById(id);
    if (!exception) return res.status(404).json({ error: 'Exception not found' });

    const decision = await Decision.findOne({ exceptionId: id }).sort({ createdAt: -1 });
    if (!decision || !decision.candidateActions.length) {
      return res.status(400).json({ error: 'No candidate actions found - run /investigate first' });
    }

    // Optionally the caller can force a specific candidate by index; default = best-scored (index 0)
    const chosenIndex = Number.isInteger(req.body?.candidateIndex) ? req.body.candidateIndex : 0;
    const chosen = decision.candidateActions[chosenIndex];
    if (!chosen) return res.status(400).json({ error: 'Invalid candidateIndex' });

    const policies = await loadActivePolicies();
    const verdict = evaluateAction(chosen, policies);

    decision.selectedActionId = chosen._id;
    decision.policyVerdict = verdict;
    await decision.save();

    const action = await Action.create({
      exceptionId: exception._id,
      decisionId: decision._id,
      action_type: chosen.action_type,
      params: chosen.target ? { ...chosen.target, quantity: chosen.quantity, expected_cost: chosen.expected_cost } : {},
      status: verdict.verdict === 'blocked' ? 'rejected' : verdict.verdict === 'auto_execute' ? 'approved' : 'pending_approval',
      requiresApproval: verdict.verdict === 'approval_required',
      idempotencyKey: `${exception._id}-${chosen._id}`,
    });

    exception.status =
      verdict.verdict === 'blocked' ? 'failed' : verdict.verdict === 'approval_required' ? 'approval_pending' : 'decided';
    await exception.save();

    await logAudit({
      exceptionId: exception._id,
      eventType: 'decided',
      details: { chosenAction: chosen.action_type, verdict },
    });

    return res.status(200).json({ exception, decision, action });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
