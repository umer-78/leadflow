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
| **Website chat** | One `<script>` tag adds a chat button to any website, in the clinic's colours. Answers questions about treatments, prices, insurance, payment plans, hours and location from the clinic's own knowledge base, follows the conversation ("what about veneers?"), handles several questions in one message, typos and texting shorthand. Times appear as tap-to-book buttons, contact details go in a short form, emergencies get a call card, and bookings get a confirmation card with add-to-calendar. |
| **Medical safety** | Deterministic rules run first: swelling spreading to the eye or neck, trouble breathing/swallowing, fever with swelling, jaw injury → *call 911 / go to the ER*. Knocked-out tooth, severe pain, abscess, broken tooth → first-aid guidance, the clinic's number, urgent staff alert. Never diagnoses, never recommends medicines or doses. |
| **Real knowledge** | 69 patient-information articles plus 7 clinic-policy templates (implants, aligners, veneers, whitening, root canals, gum disease, emergencies, aftercare, children, pregnancy, medicines, older adults…). Every clinical fact was checked against published patient information (ADA, NHS, CDC, NIH, Mayo Clinic, Cleveland Clinic, AAE, AAO and others), and each article lists its sources in the dashboard. It works out *what* is being asked (how long it takes vs. how long it lasts, pain, safety, cost, aftercare…) and quotes the sentence that answers it. Prices are quoted **only** if the clinic sets them; clinic policies stay unpublished until filled in. |
| **Website import** | Paste the clinic's website address and LeadFlow reads up to 15 of its pages (same site only, public addresses only, robots.txt respected), then suggests prices for its treatments, wording for its insurance, financing, new-patient and cancellation policies, its FAQs, and its phone number, address and opening hours. The clinic ticks what to add; text arrives as hidden drafts to check and publish. |
| **Booking** | Understands "next Tuesday afternoon", "after 4", "Oct 20 at 10:30", offers real free slots inside opening hours (clinic time zone, DST-safe), books them as *Requested*, and never double-books. |
| **Leads** | Contact details captured from natural conversation ("I'm Maria, maria@x.com"), merged into one lead per person, scored 0–100 with the reason for every point (treatment value, booking, urgency, buying signals…). |
| **Follow-up** | Emails at day 0, 1, 3 and 7, written from the knowledge base for the treatment the lead asked about. They stop automatically when the lead books, replies, opts out, unsubscribes, or staff mark them done. Appointment confirmations and staff alerts too. |
| **Reminders** | Appointment reminders (24 h and 2 h before by default) with a confirm / cancel page; a cancelled slot is offered to waitlisted patients; review request and check-up recall after a completed visit; no-show follow-up; an optional "still thinking about it?" for leads that went quiet; a morning digest for the team. Every email is re-checked just before it goes out (a reminder for a cancelled visit is skipped, with the reason in the Outbox). Settings → Reminders. |
| **AI Center** | The assistant's workload (chats, share handled without the team, after-hours share, bookings, busiest hours), answer quality (questions it couldn't answer, answers patients corrected, most-used articles), setup checks with links to fix them, a self-test that asks it common questions with the clinic's own knowledge, and library update status. |
| **Dashboard** | Overview KPIs and activity chart, *needs attention* queue, leads, full transcripts with *why the assistant said that* (intent, confidence, sources), appointments workflow, knowledge editor with a live test console, email log, team roles, opening hours, widget install with live preview. |
| **Learning loop** | Questions the assistant couldn't answer are listed on the overview with a one-click "Teach an answer". New articles are used immediately. Corrections and new articles in the built-in library reach every clinic on the next start, without overwriting anything a clinic reworded, priced or deleted. |
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
- `server/knowledge/library.ts` — the dental knowledge library every clinic receives, with sources per article; `server/knowledge/sync.ts` keeps existing clinics up to date.
- `client/chat/` — the patient chat window; `client/demo/` + `npm run build:site` — the live demo on the marketing site (`docs/`), which runs the real engine in the browser.
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
npm test                                       # engine, receptionist, scheduling, quality bench
npm run eval                                   # quality report: 305 patient questions and conversations
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test   # + API tests
```

The quality bench (`test/eval/cases.ts`) is a set of real patient questions with the answer a good
front desk would give; `npm test` fails if any of them regresses. Add a case whenever you teach
the assistant something new.

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
- Email only (no SMS) for follow-ups and reminders.
- See [docs/business/competitors.md](docs/business/competitors.md) for how LeadFlow compares with
  Weave, NexHealth and AI receptionists, and the gaps worth closing next.
