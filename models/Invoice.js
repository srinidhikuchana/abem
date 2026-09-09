const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  orderId: String,
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  invoice_total: Number,
  expected_total: Number,
  invoice_qty: Number,
  received_qty: Number,
  status: { type: String, enum: ['pending', 'approved', 'on_hold', 'clarification'], default: 'pending' },
});

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
