const mongoose = require('mongoose');

const PolicySchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: 'demo-tenant' },
    name: { type: String, required: true },
    // Free-form structured config, interpreted by policyEngine.js.
    // e.g. { auto_purchase_limit: 50000, refund_approval_threshold: 5000, ... }
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Policy || mongoose.model('Policy', PolicySchema);
