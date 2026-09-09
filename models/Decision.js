const mongoose = require('mongoose');

const CandidateActionSchema = new mongoose.Schema(
  {
    action_type: String, // create_purchase_request | transfer_inventory | place_hold | request_approval
    target: mongoose.Schema.Types.Mixed,
    quantity: Number,
    expected_cost: Number,
    expected_time: Number, // hours
    avoided_loss: Number,
    risk_score: Number, // 0-1
    policy_reference: String,
    required_approval: Boolean,
    rationale: String,
    composite_score: Number,
  },
  { _id: true }
);

const DecisionSchema = new mongoose.Schema(
  {
    exceptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exception', required: true },
    candidateActions: [CandidateActionSchema],
    selectedActionId: mongoose.Schema.Types.ObjectId,
    policyVerdict: {
      verdict: { type: String, enum: ['auto_execute', 'approval_required', 'blocked'] },
      reasons: [String],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Decision || mongoose.model('Decision', DecisionSchema);
