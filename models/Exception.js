const mongoose = require('mongoose');

const ExceptionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, default: 'demo-tenant' },
    type: {
      type: String,
      enum: ['inventory_shortage', 'supplier_delivery_failure', 'invoice_mismatch'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'open',
        'investigating',
        'decided',
        'approval_pending',
        'approved',
        'rejected',
        'executing',
        'resolved',
        'failed',
      ],
      default: 'open',
    },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    title: { type: String, required: true },
    detectionReason: { type: String },
    entities: {
      orderId: String,
      supplierId: String,
      sku: String,
      invoiceId: String,
      warehouseId: String,
    },
    rawEvent: { type: mongoose.Schema.Types.Mixed },
    evidence: { type: mongoose.Schema.Types.Mixed, default: null }, // investigator agent output
    impact: { type: mongoose.Schema.Types.Mixed, default: null }, // calculated impact
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Exception || mongoose.model('Exception', ExceptionSchema);
