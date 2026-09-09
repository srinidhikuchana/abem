const { connectDB } = require('../../_lib/db');
const { requireAuth } = require('../../_lib/auth');
const { callStructuredLLM } = require('../../_lib/openrouter');
const { scoreCandidates } = require('../../_lib/policyEngine');
const { logAudit } = require('../../_lib/audit');
const Exception = require('../../../models/Exception');
const Decision = require('../../../models/Decision');
const Inventory = require('../../../models/Inventory');
const Supplier = require('../../../models/Supplier');
const Invoice = require('../../../models/Invoice');
const Order = require('../../../models/Order');

const SYSTEM_PROMPT = `You are the Investigator + Resolution Planner for ABEM, an autonomous business
exception manager. You are given a business exception case plus relevant reference data.

Respond with ONLY a JSON object (no prose, no markdown fences) matching this shape:
{
  "evidence_summary": "2-4 sentence plain-English summary of what happened and why it matters",
  "impact": {
    "financial_estimate": <number, currency units, best estimate of cost/loss if unresolved>,
    "operational_estimate": "short string describing operational impact (e.g. stockout in 2 days)",
    "confidence": <0-1 float>
  },
  "candidate_actions": [
    {
      "action_type": "create_purchase_request" | "transfer_inventory" | "place_hold" | "request_approval",
      "target": { "...": "structured target info, e.g. supplier_id, sku, warehouse ids, invoice_id" },
      "quantity": <number or null>,
      "expected_cost": <number>,
      "expected_time": <number, hours>,
      "avoided_loss": <number, currency units this action avoids losing>,
      "risk_score": <0-1 float>,
      "policy_reference": "short string naming the relevant policy",
      "required_approval": <boolean, true if you believe a human should review this even if within limits>,
      "rationale": "1-2 sentence explanation"
    }
  ]
}

Rules:
- Never invent data you weren't given; if something is unknown, use a reasonable estimate and lower your confidence.
- Propose 2-3 candidate_actions with genuinely different trade-offs (e.g. wait vs. buy from alternate supplier vs. escalate).
- You are NOT authorizing anything. A separate deterministic policy engine decides what actually executes.
- Output valid JSON only.`;

async function gatherContext(exception) {
  const { entities = {}, type, rawEvent } = exception;
  const context = { exception_type: type, entities, raw_event_payload: rawEvent?.payload || {} };

  if (entities.sku) {
    context.inventory = await Inventory.find({ sku: entities.sku }).lean();
  }
  if (entities.supplierId) {
    context.supplier = await Supplier.findById(entities.supplierId).lean().catch(() => null);
  }
  if (entities.invoiceId) {
    context.invoice = await Invoice.findById(entities.invoiceId).lean().catch(() => null);
  }
  if (entities.orderId) {
    context.order = await Order.findById(entities.orderId).lean().catch(() => null);
  }
  // Always include a couple of alternate suppliers for the resolution planner to consider
  context.alternate_suppliers = await Supplier.find({ approved: true }).limit(3).lean();

  return context;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  try {
    await connectDB();
    const { id } = req.query;
    const exception = await Exception.findById(id);
    if (!exception) return res.status(404).json({ error: 'Exception not found' });

    exception.status = 'investigating';
    await exception.save();

    const context = await gatherContext(exception);

    const llmOutput = await callStructuredLLM({
      system: SYSTEM_PROMPT,
      user: JSON.stringify(
        {
          exception: {
            type: exception.type,
            title: exception.title,
            detectionReason: exception.detectionReason,
            severity: exception.severity,
          },
          context,
        },
        null,
        2
      ),
    });

    const scoredCandidates = scoreCandidates(llmOutput.candidate_actions || []);

    exception.evidence = llmOutput.evidence_summary;
    exception.impact = llmOutput.impact;
    exception.status = 'investigating';
    await exception.save();

    const decision = await Decision.create({
      exceptionId: exception._id,
      candidateActions: scoredCandidates,
    });

    await logAudit({
      exceptionId: exception._id,
      actor: 'llm:investigator',
      eventType: 'investigated',
      details: { evidence: llmOutput.evidence_summary, impact: llmOutput.impact, candidateCount: scoredCandidates.length },
    });

    return res.status(200).json({ exception, decision });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
