const { connectDB } = require('./_lib/db');
const { requireAuth } = require('./_lib/auth');
const { detectException } = require('./_lib/detection');
const { logAudit } = require('./_lib/audit');
const Exception = require('../models/Exception');

const TITLES = {
  inventory_shortage: 'Inventory shortage',
  supplier_delivery_failure: 'Supplier delivery failure',
  invoice_mismatch: 'Invoice/payment mismatch',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAuth(req, res)) return;

  try {
    await connectDB();
    const event = req.body; // { type: 'inventory_check'|'supplier_delivery'|'invoice_received', payload: {...}, entities: {...}, idempotency_key }

    if (!event || !event.type || !event.payload) {
      return res.status(400).json({ error: 'Body must include { type, payload }' });
    }

    // Idempotency: if an open exception already exists for this idempotency_key, return it.
    if (event.idempotency_key) {
      const existing = await Exception.findOne({ 'rawEvent.idempotency_key': event.idempotency_key });
      if (existing) return res.status(200).json({ deduped: true, exception: existing });
    }

    const detection = detectException(event);

    if (!detection.triggered) {
      return res.status(200).json({ triggered: false, detection });
    }

    const exception = await Exception.create({
      type: detection.type,
      title: TITLES[detection.type] || detection.type,
      detectionReason: detection.reason,
      severity: detection.severity || 'medium',
      entities: event.entities || {},
      rawEvent: event,
      status: 'open',
    });

    await logAudit({
      exceptionId: exception._id,
      eventType: 'exception_created',
      details: { detection },
    });

    return res.status(201).json({ triggered: true, exception });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
