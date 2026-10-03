# LeadFlow AI — Deployment Runbook

Copy-paste steps to take LeadFlow from this repo to a live, sellable SaaS. The app
is a single container: an Express server (serves the built React client **and** the
API) plus optional Postgres, Google Gemini, and Stripe billing. Everything is driven
by environment variables — **no code changes needed to go live.**

| Path | Cost | Notes |
| --- | --- | --- |
| **Render free tier** (steps 1–4) | $0, no card | Spins down after ~15 min idle (first request then waits ~50s). Fine for demos. |
| **Render paid / Fly.io** | ~$7+/mo | No spin-down; use before real customers. |

---

## Step 1 — Push to GitHub
Already done — the repo contains the `Dockerfile` and `render.yaml` blueprint.

## Step 2 — Deploy to Render
1. Render Dashboard → **New → Blueprint** → select this repo.
2. Render reads `render.yaml` and creates the `leadflow` web service (Docker, free plan,
   health check `/api/health`).
3. In the service's **Environment** tab set the secrets (`sync: false` means Render
   prompts for them — see `.env.example` for the full reference):

   | Variable | Required? | What it does |
   | --- | --- | --- |
   | `AUTH_SECRET` | yes | JWT signing secret — use a long random string |
   | `GEMINI_API_KEY` | recommended | Google Gemini (free tier) for the AI receptionist; without it the AI runs in mock mode |
   | `DATABASE_URL` | optional | Postgres connection string; without it state is kept locally (demo only) |
   | `STRIPE_SECRET_KEY` | for billing | turns on real checkout (leave unset = demo mode) |
   | `STRIPE_WEBHOOK_SECRET` | for billing | signing secret for `/api/billing/webhook` |
   | `PUBLIC_BASE_URL` | optional | your Render URL, for Stripe return links |

4. Deploy. Verify: open `https://<your-url>/api/health` → `{"status":"HEALTHY",...}`.

## Step 3 — Turn on Stripe billing (optional, when you're ready to charge)
The pricing is already built (Starter $500 / Growth $1000 / Pro $2000 per month, from
`src/lib/billing/provider.ts`). To accept real payments:

1. In your [Stripe dashboard](https://dashboard.stripe.com): copy your secret key, and
   create a webhook pointing at `https://<your-url>/api/billing/webhook`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Render → redeploy.

The server then exposes:
- `GET /api/billing/config` — whether checkout is live + the plans
- `POST /api/billing/checkout` `{ planId, orgId }` — returns a Stripe Checkout URL
- `POST /api/billing/webhook` — a completed checkout activates the org on its plan

Until the keys are set, the checkout endpoint returns a clear "not configured" message
and the app stays fully usable in demo mode.

## Step 4 — Upgrade to persistent infra before real customers
Render free is ephemeral and sleeps. Before onboarding paying customers, move to a
paid Render instance (or Fly.io) and attach a managed **Postgres** (set `DATABASE_URL`)
so tenant data and sessions persist.

---

## Verification checklist (run before each deploy)
```bash
npm ci
npm run lint    # tsc --noEmit — clean
npm run build   # vite build — succeeds
```

## Files that matter for deployment
| File | Role |
| --- | --- |
| `Dockerfile` | Node 22, `npm ci` → build client → `npm start` (Express serves `dist/` + API) |
| `render.yaml` | Render blueprint (Docker, health check, env var list) |
| `.env.example` | Complete env var reference |
| `server.ts` | Express server: API routes, static client, Stripe billing routes |
| `src/lib/billing/` | Plan config + Stripe checkout/webhook helpers (unit-tested) |
