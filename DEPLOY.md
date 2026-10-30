# Deploying LeadFlow

LeadFlow is one container (API + background email worker + web app) and one PostgreSQL
database. Migrations run automatically when the server starts.

## Option A — Render (blueprint included)

1. Push this repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. `render.yaml` creates:
   - `leadflow-db` — managed PostgreSQL (its connection string is wired into `DATABASE_URL`)
   - `leadflow` — the web service, built from the `Dockerfile`, health check `/api/health`
3. When prompted, set:

   | Variable | Value |
   | --- | --- |
   | `PUBLIC_BASE_URL` | the service URL, e.g. `https://leadflow.onrender.com` (or your custom domain) |
   | `RESEND_API_KEY` / `EMAIL_FROM` | optional, see *Email* below |
   | `ANTHROPIC_API_KEY` | optional, see *Claude answers* below |
   | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | optional, see *Billing* below |

4. Deploy, then open `https://<your-url>/api/health` — you should see `"status":"ok"` and `"database":"ok"`.
5. Open the app, **create your clinic**, and follow the setup checklist on the overview.

> Render's free plans sleep when idle and the free database expires after a trial period.
> Use paid instances for real clinics so follow-up emails go out on time and data persists.

## Option B — any Docker host

```bash
docker build -t leadflow .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/leadflow \
  -e PUBLIC_BASE_URL=https://leadflow.example.com \
  leadflow
```

Any PostgreSQL 14+ works (Supabase, Neon, RDS, Cloud SQL, self-hosted). Connections to
Supabase/Neon/Render use SSL automatically; for others add `?sslmode=require` if needed.

Run more than one instance if you like: the email worker claims messages with
`FOR UPDATE SKIP LOCKED`, so nothing is sent twice. Set `RUN_WORKER=false` on instances that
should only serve traffic.

## Email

Follow-ups, appointment confirmations and staff alerts are always written and listed in the
dashboard (**Emails**). To actually send them:

1. Create a [Resend](https://resend.com) account and verify your sending domain.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `Brightside Dental <hello@brightside.com>`).
3. In the dashboard, set **Settings → Clinic → Send new-lead alerts to**.

Every patient email includes a one-click unsubscribe link (`/u/<token>`).

## Claude answers (optional)

Set `ANTHROPIC_API_KEY` and open questions (about treatments, comparisons, follow-ups, and questions the
built-in assistant can't answer) are answered by Claude from each clinic's own settings and knowledge
base. Emergencies and safety advice, booking, prices, opening hours and opt-outs always use the
built-in assistant, which also answers whenever Claude is slow (`CLAUDE_TIMEOUT_MS`, default 15 s),
declines or fails. Names, emails and phone numbers are removed from what is sent.

| Variable | Default | |
| --- | --- | --- |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | `claude-sonnet-5-5` or `claude-haiku-5-5` cost less per answer |
| `ANTHROPIC_EFFORT` | `low` | `medium` / `high` think longer and cost more |
| `CLAUDE_DAILY_LIMIT` | `500` | Claude answers per clinic per 24 hours; after that the built-in assistant answers |

Each clinic can turn it off in **Settings → Assistant**. **AI Center → Workload** shows how many
answers Claude wrote, the tokens used (most of the prompt is read from Anthropic's prompt cache)
and the estimated cost. Sending patients' questions to Anthropic is a change to where patient data
goes: check it fits your privacy notices before turning it on.

## Billing (optional)

1. In Stripe, copy your secret key and add a webhook endpoint
   `https://<your-url>/api/billing/webhook` for the `checkout.session.completed` event.
2. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, redeploy.
3. Owners can then subscribe under **Settings → Plan**. Plans and prices live in `server/billing.ts`.

## Putting the chat on a clinic website

**Settings → Website chat** shows the snippet:

```html
<script src="https://<your-url>/widget.js" data-key="pk_..." async></script>
```

Paste it before `</body>` (or in the site builder's custom-code area). Optional attributes:
`data-color="#0f766e"`, `data-label="Chat with us"`. The direct link
`https://<your-url>/chat.html?key=pk_...` works for emails, social profiles and QR codes.

## Keep it awake and watched

- **Keep-alive:** a free Render instance sleeps when idle, and the first chat after that waits for it to wake. Set the repository variable `LEADFLOW_URL` (GitHub → Settings → Secrets and variables → Actions → Variables) to your app's URL and `.github/workflows/keepalive.yml` pings `/api/health` (app and database) every 10 minutes. GitHub runs schedules on a best-effort basis; for a strict 5-minute ping, also point a free uptime monitor (UptimeRobot, cron-job.org) at `https://<your-url>/api/health`.
- **Security scanning:** `.github/workflows/codeql.yml` runs GitHub code scanning on every push and weekly (findings under Security → Code scanning). Dependabot (`.github/dependabot.yml`) proposes dependency updates weekly, after a two-week cooldown.
- **Site checks:** `.github/workflows/site.yml` checks the marketing site in `docs/` for broken links on every change and weekly.
- **AI Center:** after go-live, open **AI Center → Checks** in the dashboard and run the self-test; it asks the assistant what patients ask most using your own knowledge and settings, and lists anything to fix.

## Checklist before going live

- [ ] `npm run lint && npm test` pass (CI does this on every push)
- [ ] `/api/health` reports the database as `ok`
- [ ] Clinic phone, address, hours and alert email are set
- [ ] Insurance, payment, new-patient, cancellation and parking policies are filled in and published
- [ ] Price ranges are set for the treatments you want quoted (others are never quoted)
- [ ] Treatments you don't offer are hidden in **Knowledge & AI**
- [ ] A test conversation on the live site creates a lead and an appointment request
- [ ] Email sending is configured, or the team knows to check the **Emails** page
- [ ] **Settings → Reminders** reviewed (review link added if you want review requests)
- [ ] **AI Center → Checks** shows nothing to fix and the self-test passes
