const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema(
  {
    exceptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exception', required: true },
    decisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Decision', required: true },
    action_type: { type: String, required: true },
    params: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending_approval', 'approved', 'executing', 'completed', 'failed', 'rejected'],
      default: 'pending_approval',
    },
    requiresApproval: { type: Boolean, default: false },
    idempotencyKey: { type: String, index: true },
    executedAt: Date,
    result: mongoose.Schema.Types.Mixed,
    verification: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Action || mongoose.model('Action', ActionSchema);
