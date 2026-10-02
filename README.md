# LeadFlow AI

Autonomous lead capture, qualification, follow-up, and appointment automation for high-value service businesses (starting with Dental & Cosmetic clinics).

Target: **$20,000/month recurring revenue** ($240,000 ARR).

---

## 1. Core Business Architecture

LeadFlow AI is engineered for practices where prospective patient cases are worth $3,000 to $25,000 (Invisalign, Veneers, Implants, Facial Aesthetics). In this market, over 58% of inquiries arrive after-hours or on weekends. Practices that respond in under 60 seconds with accurate clinical procedure answers and friction-free consultation booking win 78% of appointments.

The customer does not buy "AI" — they buy an autonomous patient intake machine:
- **24/7 Precision AI Receptionist**: Bounded strictly by verified clinic guidelines; never fabricates pricing and refuses medical diagnoses.
- **Explainable Lead Scoring**: Classifies inquiries into HIGH, MEDIUM, LOW intent with transparent rationale.
- **Multi-Day Follow-Up Automation**: Executes structured sequences at T+0, T+1, T+3, and T+7. Immediately halts upon reply, booking, or opt-out.
- **Client Practice Dashboard**: Tenant-isolated lead triage, consultation calendar, and knowledge base editor.
- **Agency Command Center**: $20k MRR gap tracker, daily operating cadence, prospect CRM, and AI research audit generator.

---

## 2. 100% Cloud-First Architecture (Zero Local AI Overhead)

- **Pure Cloud Execution**: Runs entirely in the cloud on Google Cloud Run and AI Studio environment.
- **Zero Local AI or Heavy Local Models**: Pure cloud deployment, no local model downloads, no local hardware burdens.
- **Google Cloud Gemini Gateway**:
  - Powered by Google's `gemini-3.8-flash` in the cloud via the `@google/genai` TypeScript SDK.
  - Server-side proxy endpoint (`/api/ai/generate`) ensures secure backend execution where API keys are never exposed to the client.
  - Cloud-hosted Knowledge Base Retrieval Engine for instant, deterministic dental & clinic procedure triage.

---

## 3. Technology Stack & Framework

- **Frontend**: Next.js / React 19, TypeScript, Tailwind CSS (Anti-slop typography, zero static pills).
- **Backend / ORM**: Prisma ORM with PostgreSQL schema (`prisma/schema.prisma`).
- **Authentication & Security**: Multi-tenant RBAC (`OWNER`, `ADMIN`, `STAFF`, `VIEWER`), session management, salted password hashing, and cross-tenant isolation enforcement.

---

## 4. Multi-Tenant Role Matrix

| Permission | OWNER | ADMIN | STAFF | VIEWER |
| :--- | :---: | :---: | :---: | :---: |
| Full Org & Practice Settings | ✓ | — | — | — |
| Plan & Billing Management | ✓ | — | — | — |
| Team & Staff Role Assignment | ✓ | ✓ | — | — |
| Knowledge Base & FAQ Tuning | ✓ | ✓ | — | — |
| Automation Rules Management | ✓ | ✓ | — | — |
| Lead Creation & Editing | ✓ | ✓ | ✓ | — |
| Consultation Appointment Booking | ✓ | ✓ | ✓ | — |
| Read-Only Pipeline Audit | ✓ | ✓ | ✓ | ✓ |

**Strict Tenant Isolation**: User belonging to Organization A cannot access or mutate Organization B leads, appointments, or knowledge. Tested and verified in `src/lib/tests/test-runner.ts`.

---

## 5. Quick Start & Local Commands

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Compile and build
npm run build

# 4. Typecheck and lint
npm run lint

# 5. Database operations (with Prisma)
npx prisma generate
npx prisma db push
```

---

## 6. Testing & System Verification

Run the built-in system verification suite via the **"Security & Tests"** tab in the top navigation bar:
- **Tenant Isolation**: Asserts that Organization A cannot access Organization B.
- **RBAC Enforcement**: Asserts that VIEWER roles are denied lead mutation/deletion.
- **AI Safety Guardrail**: Asserts refusal of medical diagnosis requests.
- **Automation Opt-Out**: Asserts suppression of all outbound messages for `DO_NOT_CONTACT` leads.
- **Lead Scoring**: Validates transparent point computation for high-value procedures.
- **E2E Customer Journey**: Simulates visitor prompt to qualified lead extraction and appointment queue.
- **Stripe Checkout Pricing Math**: Asserts checkout line items match each plan's monthly and setup fees.
- **Billing Demo-Mode Gate**: Asserts card checkout stays off until a real key is set.

## 7. Billing (Stripe) — optional, off by default

The app runs in demo mode with no payment keys. To take real subscription payments
for the Starter / Growth / Pro plans:

1. In your [Stripe dashboard](https://dashboard.stripe.com), copy your secret key and
   create a webhook pointing at `https://<your-app>/api/billing/webhook`.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see `.env.example`) and redeploy.

That is all — the server exposes:
- `GET /api/billing/config` — whether checkout is live and the current plans.
- `POST /api/billing/checkout` `{ planId, orgId }` — returns a Stripe Checkout URL.
- `POST /api/billing/webhook` — on a completed checkout, activates the org on its plan.

Prices come from `PLAN_CONFIGS` (`src/lib/billing/provider.ts`); the monthly fee is a
recurring subscription and the setup fee is billed once on the first invoice. Nothing
is charged and no key is required until you set the two variables above.
