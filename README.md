# ABEM — Autonomous Business Exception Manager

Small hackathon-ready deployment of the ABEM blueprint. It keeps the MVP to inventory shortage, supplier delivery failure and invoice mismatch, with deterministic detection/policy checks, AI investigation, approval, safe mock actions and audit history.

## 1. MongoDB
Create a MongoDB Atlas database and copy its connection string.

## 2. Local setup
```bash
npm install
cp .env.example .env
npm run seed
```

## 3. OpenRouter
Set:
```env
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```
The model is only used for investigation/candidate resolution. The policy engine remains deterministic.

## 4. Vercel
Push this folder to GitHub → import into Vercel → add these Environment Variables:

- `MONGODB_URI`
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` = `openai/gpt-4o-mini`
- `PUBLIC_APP_URL` = your Vercel URL
- `ABEM_API_KEY` optional for the demo

Deploy. Then run the seed once locally against the same MongoDB URI, or seed from another Node environment.

## API
- `GET /api/exceptions`
- `POST /api/events`
- `GET /api/exceptions/:id`
- `POST /api/exceptions/:id/investigate`
- `POST /api/exceptions/:id/decide`
- `POST /api/exceptions/:id/approve`
- `POST /api/exceptions/:id/reject`
- `GET /api/actions/:id`
- `POST /api/actions/:id/execute`
- `GET /api/audit/:exceptionId`
- `GET/POST /api/policies`
- `GET /api/analytics/overview`

## Important
Do not put API keys in frontend code or Git. For a real SaaS, replace the demo API-key auth with JWT/OAuth + RBAC and tenant isolation.
