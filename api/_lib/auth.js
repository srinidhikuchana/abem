// api/_lib/auth.js
// Hackathon-grade auth: a single shared demo API key + a hardcoded tenant.
// Swap this for real JWT/OAuth + per-tenant RBAC before going to production
// (see README "Production hardening").

function requireAuth(req, res) {
  const expected = process.env.ABEM_API_KEY;
  if (!expected) return true; // auth disabled if no key configured (local dev)

  const provided = req.headers['x-api-key'];
  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized: missing or invalid x-api-key header' });
    return false;
  }
  return true;
}

const DEMO_TENANT_ID = 'demo-tenant';

module.exports = { requireAuth, DEMO_TENANT_ID };
