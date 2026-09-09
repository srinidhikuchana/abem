const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  sku: { type: String, required: true, index: true },
  productName: String,
  warehouse_id: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  safety_stock: { type: Number, default: 50 },
  daily_demand: { type: Number, default: 10 },
});

InventorySchema.index({ sku: 1, warehouse_id: 1 }, { unique: true });

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
