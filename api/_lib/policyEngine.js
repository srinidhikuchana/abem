// api/_lib/policyEngine.js
// Deterministic, non-LLM policy enforcement. The LLM proposes candidate
// actions; this module is the ONLY thing allowed to decide whether an
// action can auto-execute, needs approval, or is blocked outright.
//
// Policies are plain config objects (normally loaded from the `policies`
// collection). DEFAULT_POLICIES is used as a fallback / seed.

const DEFAULT_POLICIES = {
  auto_purchase_limit: 50000, // currency units
  refund_approval_threshold: 5000,
  risk_limit_auto: 0.4, // 0-1 normalized risk score
  invoice_tolerance_pct: 0.02,
  supplier_qty_tolerance_pct: 0.05,
  approved_vendor_ids: null, // null = allow-all in demo; else array of ids
  active_warehouse_ids: null, // null = allow-all in demo; else array of ids
};

/**
 * Evaluates one candidate action against policy + hard constraints.
 * Returns { verdict: 'auto_execute'|'approval_required'|'blocked', reasons: string[] }
 */
function evaluateAction(action, policies = DEFAULT_POLICIES) {
  const reasons = [];
  let blocked = false;

  // Hard constraint: supplier substitution only from approved vendors
  if (
    action.action_type === 'create_purchase_request' &&
    policies.approved_vendor_ids &&
    action.target?.supplier_id &&
    !policies.approved_vendor_ids.includes(action.target.supplier_id)
  ) {
    blocked = true;
    reasons.push('Supplier is not on the approved vendor list');
  }

  // Hard constraint: inventory transfer only between active warehouses
  if (
    action.action_type === 'transfer_inventory' &&
    policies.active_warehouse_ids &&
    (!policies.active_warehouse_ids.includes(action.target?.from_warehouse_id) ||
      !policies.active_warehouse_ids.includes(action.target?.to_warehouse_id))
  ) {
    blocked = true;
    reasons.push('Transfer involves a non-active warehouse');
  }

  if (blocked) {
    return { verdict: 'blocked', reasons };
  }

  const costLimit =
    action.action_type === 'issue_refund'
      ? policies.refund_approval_threshold
      : policies.auto_purchase_limit;

  const overCostLimit = (action.expected_cost || 0) > costLimit;
  const overRiskLimit = (action.risk_score ?? 1) > policies.risk_limit_auto;
  const explicitlyRequiresApproval = !!action.required_approval;

  if (overCostLimit) reasons.push(`Expected cost ${action.expected_cost} exceeds limit ${costLimit}`);
  if (overRiskLimit) reasons.push(`Risk score ${action.risk_score} exceeds auto-limit ${policies.risk_limit_auto}`);
  if (explicitlyRequiresApproval) reasons.push('Action flagged as requiring approval by the resolution planner');

  if (overCostLimit || overRiskLimit || explicitlyRequiresApproval) {
    return { verdict: 'approval_required', reasons };
  }

  return { verdict: 'auto_execute', reasons: ['Within cost and risk auto-limits'] };
}

/**
 * Scores candidate actions (cost, delay, risk, avoided loss) and returns
 * them sorted best-first. Pure math — no LLM involved, so results are
 * reproducible and auditable.
 */
function scoreCandidates(candidates, weights = { cost: 0.35, delay: 0.25, risk: 0.25, loss: 0.15 }) {
  if (!candidates.length) return [];

  const norm = (val, arr) => {
    const max = Math.max(...arr, 1);
    return max === 0 ? 0 : val / max;
  };

  const costs = candidates.map((c) => c.expected_cost || 0);
  const delays = candidates.map((c) => c.expected_time || 0);
  const losses = candidates.map((c) => c.avoided_loss || 0);

  return candidates
    .map((c) => {
      const costN = norm(c.expected_cost || 0, costs);
      const delayN = norm(c.expected_time || 0, delays);
      const riskN = c.risk_score ?? 0.5;
      const lossN = 1 - norm(c.avoided_loss || 0, losses); // higher avoided loss = better = lower "cost"

      // Lower composite score is better (it's a cost-like function)
      const score =
        weights.cost * costN + weights.delay * delayN + weights.risk * riskN + weights.loss * lossN;

      return { ...c, composite_score: Number(score.toFixed(4)) };
    })
    .sort((a, b) => a.composite_score - b.composite_score);
}

module.exports = { DEFAULT_POLICIES, evaluateAction, scoreCandidates };
