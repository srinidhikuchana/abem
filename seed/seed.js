// seed/seed.js
// Run with: node seed/seed.js
// Populates MongoDB with reference data + one realistic exception (the
// "Supplier A / Supplier B" scenario from the blueprint, section 16) so the
// demo has something real to investigate/decide/approve/execute end to end.

require('dotenv').config();
const mongoose = require('mongoose');

const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Exception = require('../models/Exception');
const Policy = require('../models/Policy');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Clearing existing demo data...');

  await Promise.all([
    Supplier.deleteMany({}),
    Inventory.deleteMany({}),
    Order.deleteMany({}),
    Invoice.deleteMany({}),
    Exception.deleteMany({}),
    Policy.deleteMany({}),
  ]);

  const supplierA = await Supplier.create({
    name: 'Supplier A',
    approved: true,
    reliability_score: 0.75,
    lead_time_days: 5,
    cost_index: 1.0,
  });
  const supplierB = await Supplier.create({
    name: 'Supplier B',
    approved: true,
    reliability_score: 0.95,
    lead_time_days: 2,
    cost_index: 1.06,
  });

  await Inventory.create({
    sku: 'SKU-1001',
    productName: 'Widget Pro 500ml',
    warehouse_id: 'WH-MAIN',
    quantity: 120,
    safety_stock: 300,
    daily_demand: 200,
  });
  await Inventory.create({
    sku: 'SKU-1001',
    productName: 'Widget Pro 500ml',
    warehouse_id: 'WH-NORTH',
    quantity: 450,
    safety_stock: 200,
    daily_demand: 40,
  });

  const order = await Order.create({
    sku: 'SKU-1001',
    supplierId: supplierA._id,
    ordered_qty: 1000,
    delivered_qty: 700,
    promised_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    actual_date: new Date(),
  });

  const invoice = await Invoice.create({
    orderId: order._id,
    supplierId: supplierA._id,
    invoice_total: 10500,
    expected_total: 10000,
    invoice_qty: 700,
    received_qty: 700,
    status: 'pending',
  });

  await Policy.create({
    name: 'default-thresholds',
    active: true,
    config: {
      auto_purchase_limit: 50000,
      refund_approval_threshold: 5000,
      risk_limit_auto: 0.4,
      invoice_tolerance_pct: 0.02,
      supplier_qty_tolerance_pct: 0.05,
      approved_vendor_ids: [String(supplierA._id), String(supplierB._id)],
      active_warehouse_ids: ['WH-MAIN', 'WH-NORTH'],
    },
  });

  // The headline demo exception: supplier shortfall (blueprint section 16)
  const exception = await Exception.create({
    type: 'supplier_delivery_failure',
    title: 'Supplier delivery failure',
    detectionReason: 'Supplier A delivered 700 of 1000 ordered units (30% short)',
    severity: 'high',
    entities: {
      orderId: String(order._id),
      supplierId: String(supplierA._id),
      sku: 'SKU-1001',
      warehouseId: 'WH-MAIN',
    },
    rawEvent: {
      type: 'supplier_delivery',
      payload: {
        delivered_qty: 700,
        ordered_qty: 1000,
        actual_date: new Date().toISOString(),
        promised_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    status: 'open',
  });

  // A couple more lightweight cases so the dashboard/queue isn't empty
  await Exception.create({
    type: 'inventory_shortage',
    title: 'Inventory shortage',
    detectionReason: 'Projected stock on arrival (80) is below safety stock (300)',
    severity: 'high',
    entities: { sku: 'SKU-1001', warehouseId: 'WH-MAIN' },
    rawEvent: { type: 'inventory_check', payload: { projected_stock_on_arrival: 80, safety_stock: 300 } },
    status: 'open',
  });

  await Exception.create({
    type: 'invoice_mismatch',
    title: 'Invoice/payment mismatch',
    detectionReason: 'Invoice total 10500 differs from expected 10000 by 5.0%',
    severity: 'low',
    entities: { invoiceId: String(invoice._id), orderId: String(order._id), supplierId: String(supplierA._id) },
    rawEvent: {
      type: 'invoice_received',
      payload: { invoice_total: 10500, expected_total: 10000, invoice_qty: 700, received_qty: 700 },
    },
    status: 'open',
  });

  console.log('Seed complete:');
  console.log(`  Suppliers: A=${supplierA._id} B=${supplierB._id}`);
  console.log(`  Headline exception: ${exception._id}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
