# LeadFlow

An AI receptionist and lead pipeline for dental clinics. It answers patients on the clinic's
website 24/7, captures and scores leads, offers real open appointment times and books them,
spots emergencies, follows up by email, and gives the team one dashboard for all of it.

The AI runs **on your own server** with [`localbrain`](packages/localbrain), a dependency-free
engine in this repo: no third-party AI service, no API keys, no model downloads, and patient
messages never leave your infrastructure.

## What it does

| | |
| --- | --- |
| **Website chat** | One `<script>` tag adds a chat button to any website. Answers questions about treatments, prices, insurance, payment plans, hours and location from the clinic's own knowledge base. Typo-tolerant ("invisalgn", "apointment tomorow"). |
| **Medical safety** | Deterministic rules run first: swelling spreading to the eye or neck, trouble breathing/swallowing, fever with swelling, jaw injury → *call 911 / go to the ER*. Knocked-out tooth, severe pain, abscess, broken tooth → first-aid guidance, the clinic's number, urgent staff alert. Never diagnoses, never recommends medicines or doses. |
| **Real knowledge** | 37 patient-information articles plus 5 clinic-policy templates (implants, aligners, veneers, whitening, root canals, gum disease, emergencies, aftercare, pregnancy, children…), each editable. It quotes the sentence that answers the question ("how long do implants take?" → "3 to 6 months…"). Prices are quoted **only** if the clinic sets them; clinic policies stay unpublished until filled in. |
| **Booking** | Understands "next Tuesday afternoon", "after 4", "Oct 20 at 10:30", offers real free slots inside opening hours (clinic time zone, DST-safe), books them as *Requested*, and never double-books. |
| **Leads** | Contact details captured from natural conversation ("I'm Maria, maria@x.com"), merged into one lead per person, scored 0–100 with the reason for every point (treatment value, booking, urgency, buying signals…). |
| **Follow-up** | Emails at day 0, 1, 3 and 7, written from the knowledge base for the treatment the lead asked about. They stop automatically when the lead books, replies, opts out, unsubscribes, or staff mark them done. Appointment confirmations and staff alerts too. |
| **Dashboard** | Overview KPIs and activity chart, *needs attention* queue, leads, full transcripts with *why the assistant said that* (intent, confidence, sources), appointments workflow, knowledge editor with a live test console, email log, team roles, opening hours, widget install with live preview. |
| **Learning loop** | Questions the assistant couldn't answer are listed on the overview with a one-click "Teach an answer". New articles are used immediately. |
| **Multi-clinic** | Every clinic is isolated (all queries scoped by organization). Roles: Owner, Admin, Staff, Viewer. |

## Architecture

```
public/widget.js ──► chat.html (vanilla TS, ~4 KB) ──► POST /api/public/chat/:key
                                                          │
                     server/chat.ts — one transaction per message (row-locked conversation)
                                                          │
                     server/receptionist/engine.ts — skills pipeline on localbrain:
                       capture → safety → opt-out → medical advice → pending step
                       → intents (book, price, insurance, hours, …) → knowledge → fallback
                                                          │
        PostgreSQL (Drizzle ORM, migrations on boot) ◄────┴───► server/worker.ts (emails)
                                                          │
                     client/ — React dashboard (Vite + Tailwind)
```

- `packages/localbrain/` — the reusable AI engine (intent classifier, entity extraction, BM25 knowledge search with extractive answers, sentiment/urgency, dialogue skills). Copy it into any project; see its [README](packages/localbrain/README.md).
- `server/` — Express API, auth (scrypt + hashed session tokens), receptionist, scheduling, follow-ups, billing.
- `server/knowledge/library.ts` — the starter dental knowledge library every clinic receives.
- `client/` — dashboard and patient chat.
- `test/` — receptionist, safety, scheduling and API tests.

## Run it locally

Requirements: Node 20+ and PostgreSQL (Docker is the easiest way to get one).

```bash
npm install
docker compose up -d          # PostgreSQL on localhost:5432
cp .env.example .env
npm run dev                   # http://localhost:3000
```

Sign in with the demo clinic — **demo@leadflow.local / demo1234** — or create your own clinic.
Open *Settings → Website chat* to talk to the assistant, then watch the lead, booking and
emails appear in the dashboard.

## Tests

```bash
npm run lint                                   # typecheck
npm test                                       # engine, receptionist, scheduling
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test   # + API tests
```

The API tests create a throwaway database, run the real HTTP API, and drop it afterwards.
CI runs everything against PostgreSQL 16 on every push.

## Configuration

All configuration is environment variables — see [.env.example](.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `PUBLIC_BASE_URL` | recommended | Public URL, used in email links and the widget snippet |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Send email through [Resend](https://resend.com). Without them, emails are written and shown in the dashboard's *Emails* page but not sent |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional | Subscription billing |
| `SEED_DEMO` | optional | Create the demo clinic (default: on outside production) |

## Deploy

See [DEPLOY.md](DEPLOY.md) — a Render blueprint (web service + managed PostgreSQL) is included,
and the Docker image runs anywhere.

## Honest limits

- The assistant is not a large language model: it understands intent, extracts details, quotes
  the right passage and follows the flows in `server/receptionist/engine.ts`. Unusual questions
  get an honest "I'm not sure — want the team to get back to you?" and are listed for you to teach.
  `localbrain`'s `refine` hook is where a generative model could be plugged in later.
- Appointments are *requests* for staff to confirm; there is no two-way calendar sync yet.
- Email only (no SMS) for follow-ups.
