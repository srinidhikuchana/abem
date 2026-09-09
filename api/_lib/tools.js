// api/_lib/tools.js
// The ONLY functions the system is allowed to execute against "external"
// systems. For the hackathon MVP these are safe mocks that mutate our own
// Mongo collections (Inventory/Supplier/Invoice) instead of real systems,
// but they're structured exactly like real tool adapters would be so they
// can be swapped later without touching the decision/policy layers.

const Inventory = require('../../models/Inventory');
const Invoice = require('../../models/Invoice');

// Simple idempotency guard: same idempotency_key => same cached result.
const idempotencyCache = new Map();

async function withIdempotency(key, fn) {
  if (!key) return fn();
  if (idempotencyCache.has(key)) return idempotencyCache.get(key);
  const result = await fn();
  idempotencyCache.set(key, result);
  return result;
}

const TOOLS = {
  async create_purchase_request(params) {
    // params: { sku, quantity, supplier_id, expected_cost, idempotency_key }
    return withIdempotency(params.idempotency_key, async () => {
      return {
        ok: true,
        tool: 'create_purchase_request',
        purchase_order_id: `PO-${Date.now()}`,
        sku: params.sku,
        quantity: params.quantity,
        supplier_id: params.supplier_id,
        cost: params.expected_cost,
        status: 'placed',
      };
    });
  },

  async transfer_inventory(params) {
    // params: { sku, quantity, from_warehouse_id, to_warehouse_id, idempotency_key }
    return withIdempotency(params.idempotency_key, async () => {
      const from = await Inventory.findOne({ sku: params.sku, warehouse_id: params.from_warehouse_id });
      if (!from || from.quantity < params.quantity) {
        return { ok: false, tool: 'transfer_inventory', error: 'Insufficient stock at source warehouse' };
      }
      from.quantity -= params.quantity;
      await from.save();

      await Inventory.updateOne(
        { sku: params.sku, warehouse_id: params.to_warehouse_id },
        { $inc: { quantity: params.quantity } },
        { upsert: true }
      );

      return { ok: true, tool: 'transfer_inventory', sku: params.sku, quantity: params.quantity, status: 'transferred' };
    });
  },

  async place_hold(params) {
    // params: { invoice_id, reason, idempotency_key }
    return withIdempotency(params.idempotency_key, async () => {
      if (params.invoice_id) {
        await Invoice.updateOne({ _id: params.invoice_id }, { $set: { status: 'on_hold' } });
      }
      return { ok: true, tool: 'place_hold', invoice_id: params.invoice_id, status: 'on_hold' };
    });
  },

  async request_approval(params) {
    // params: { exception_id, reason }
    // This is a no-op "tool" — the actual approval-required transition is
    // handled by the decide endpoint. It exists so the Action Agent has a
    // consistent, whitelisted way to represent "stop and ask a human".
    return { ok: true, tool: 'request_approval', exception_id: params.exception_id, status: 'pending_approval' };
  },

  async verify_action(params) {
    // params: { action_type, expected, actual }
    // Deterministic check — never trust the LLM's opinion of "success".
    const success = JSON.stringify(params.expected) === JSON.stringify(params.actual);
    return { ok: success, tool: 'verify_action', success };
  },
};

const ALLOWED_TOOL_NAMES = Object.keys(TOOLS);

/**
 * Executes a whitelisted tool by name with validated params.
 * Throws if the tool is not on the allowlist — the Action Agent can only
 * ever reach this function, never raw DB/HTTP access.
 */
async function executeTool(name, params) {
  if (!ALLOWED_TOOL_NAMES.includes(name)) {
    throw new Error(`Tool "${name}" is not on the whitelist`);
  }
  return TOOLS[name](params || {});
}

module.exports = { executeTool, ALLOWED_TOOL_NAMES };
