// api/_lib/detection.js
// Deterministic detection logic per the MVP spec (section 17 of the blueprint).
// Every function returns { triggered: boolean, reason?: string, severity?: string }

function detectInventoryShortage({ projected_stock_on_arrival, safety_stock }) {
  const triggered = projected_stock_on_arrival < safety_stock;
  const deficit = safety_stock - projected_stock_on_arrival;
  return {
    triggered,
    reason: triggered
      ? `Projected stock on arrival (${projected_stock_on_arrival}) is below safety stock (${safety_stock}), deficit of ${deficit} units`
      : null,
    severity: !triggered ? null : deficit > safety_stock * 0.5 ? 'high' : 'medium',
  };
}

function detectSupplierFailure({
  delivered_qty,
  ordered_qty,
  tolerance = 0.05,
  actual_date,
  promised_date,
  grace_period_days = 1,
}) {
  const qtyShort = delivered_qty < ordered_qty * (1 - tolerance);
  let lateBy = 0;
  let isLate = false;
  if (actual_date && promised_date) {
    const grace = grace_period_days * 24 * 60 * 60 * 1000;
    const actual = new Date(actual_date).getTime();
    const promised = new Date(promised_date).getTime();
    isLate = actual > promised + grace;
    lateBy = Math.max(0, Math.round((actual - promised - grace) / (24 * 60 * 60 * 1000)));
  }
  const triggered = qtyShort || isLate;
  const reasons = [];
  if (qtyShort) reasons.push(`delivered ${delivered_qty} of ${ordered_qty} ordered units`);
  if (isLate) reasons.push(`delivered ${lateBy} day(s) past the promised date + grace period`);
  return {
    triggered,
    reason: triggered ? reasons.join('; ') : null,
    severity: !triggered ? null : qtyShort && isLate ? 'high' : 'medium',
  };
}

function detectInvoiceMismatch({
  invoice_total,
  expected_total,
  amount_tolerance = 0.02,
  invoice_qty,
  received_qty,
  quantity_tolerance = 0,
}) {
  const amountDiff = Math.abs(invoice_total - expected_total);
  const amountPctDiff = expected_total ? amountDiff / expected_total : 0;
  const amountOff = amountPctDiff > amount_tolerance;

  const qtyDiff =
    invoice_qty !== undefined && received_qty !== undefined
      ? Math.abs(invoice_qty - received_qty)
      : 0;
  const qtyOff = qtyDiff > quantity_tolerance;

  const triggered = amountOff || qtyOff;
  const reasons = [];
  if (amountOff)
    reasons.push(
      `invoice total ${invoice_total} differs from expected ${expected_total} by ${(amountPctDiff * 100).toFixed(1)}%`
    );
  if (qtyOff) reasons.push(`invoice qty ${invoice_qty} differs from received qty ${received_qty}`);

  return {
    triggered,
    reason: triggered ? reasons.join('; ') : null,
    severity: !triggered ? null : amountOff && qtyOff ? 'high' : 'low',
  };
}

/**
 * Routes a normalized incoming event to the right detector.
 * event.type must be one of: inventory_check | supplier_delivery | invoice_received
 */
function detectException(event) {
  switch (event.type) {
    case 'inventory_check':
      return { type: 'inventory_shortage', ...detectInventoryShortage(event.payload) };
    case 'supplier_delivery':
      return { type: 'supplier_delivery_failure', ...detectSupplierFailure(event.payload) };
    case 'invoice_received':
      return { type: 'invoice_mismatch', ...detectInvoiceMismatch(event.payload) };
    default:
      return { triggered: false, reason: `Unknown event type: ${event.type}` };
  }
}

module.exports = {
  detectInventoryShortage,
  detectSupplierFailure,
  detectInvoiceMismatch,
  detectException,
};
