const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  sku: String,
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  ordered_qty: Number,
  delivered_qty: Number,
  promised_date: Date,
  actual_date: Date,
});

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
