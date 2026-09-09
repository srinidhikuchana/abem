const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  approved: { type: Boolean, default: true },
  reliability_score: { type: Number, default: 0.9 }, // 0-1, higher is better
  lead_time_days: { type: Number, default: 3 },
  cost_index: { type: Number, default: 1.0 }, // relative cost multiplier vs. baseline supplier
});

module.exports = mongoose.models.Supplier || mongoose.model('Supplier', SupplierSchema);
