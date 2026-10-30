/**
 * Public endpoints used by the website widget, the unsubscribe link, and the
 * confirm / cancel page linked from appointment reminders.
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { rateLimit } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { onAppointmentChange } from '../automations.ts';
import { chatTurn, conversationHistory, widgetConfig } from '../chat.ts';
import { appointments, leads, organizations } from '../db/schema.ts';
import { HttpError, body, route, str } from '../http.ts';
import { logActivity, queueStaffAlert, skipPendingFollowups } from '../leads.ts';
import { formatPhone } from '../../packages/localbrain/src/index.ts';
import { formatSlot } from '../scheduling.ts';

const KEY = /^pk_[A-Za-z0-9_-]{6,64}$/;
const VISITOR = /^[A-Za-z0-9_-]{8,64}$/;

function key(raw: string | undefined): string {
  if (!raw || !KEY.test(raw)) throw new HttpError(404, 'This chat is not available.');
  return raw;
}

export function publicRoutes(deps: AppDeps): Router {
  const r = Router();
  const chatLimiter = rateLimit({ windowMs: 60_000, max: 30, key: (req) => req.params.key ?? '' });

  r.get(
    '/widget/:key',
    route(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await widgetConfig(deps, key(req.params.key)));
    })
  );

  r.get(
    '/chat/:key/:conversationId',
    route(async (req, res) => {
      const visitorId = String(req.query.visitorId ?? '');
      if (!VISITOR.test(visitorId)) throw new HttpError(400, 'visitorId is required.');
      res.json(await conversationHistory(deps, key(req.params.key), req.params.conversationId, visitorId));
    })
  );

  r.post(
    '/chat/:key',
    chatLimiter,
    route(async (req, res) => {
      const b = body(req);
      const visitorId = str(b, 'visitorId', { required: true, max: 64 })!;
      if (!VISITOR.test(visitorId)) throw new HttpError(400, 'Invalid visitorId.');
      const message = str(b, 'message', { required: true, max: 1000 })!;
      const result = await chatTurn(deps, {
        publicKey: key(req.params.key),
        conversationId: str(b, 'conversationId', { max: 64 }),
        visitorId,
        message,
        pageUrl: str(b, 'pageUrl', { max: 500 }),
      });
      res.json(result);
    })
  );

  return r;
}

const page = (title: string, text: string, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;color:#1f2937;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;max-width:440px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 8px;line-height:1.5;color:#4b5563}
form{display:inline}button{font:inherit;border-radius:10px;padding:10px 18px;margin:12px 6px 0;cursor:pointer;border:1px solid #d1d5db;background:#fff;color:#1f2937}
button.primary{background:#0f766e;border-color:#0f766e;color:#fff}</style>
</head><body><main><h1>${title}</h1><p>${text}</p>${extra}</main></body></html>`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** GET /u/:token — one-click unsubscribe from follow-up emails. */
export function unsubscribeRoute(deps: AppDeps): Router {
  const r = Router();
  r.get(
    '/u/:token',
    route(async (req, res) => {
      const token = req.params.token;
      const [lead] = /^[A-Za-z0-9_-]{20,64}$/.test(token)
        ? await deps.db.select().from(leads).where(eq(leads.unsubscribeToken, token)).limit(1)
        : [];
      if (!lead) {
        res.status(404).type('html').send(page('Link not recognised', 'This unsubscribe link is not valid or has expired.'));
        return;
      }
      if (!lead.optedOut) {
        await deps.db.update(leads).set({ optedOut: true, status: 'DO_NOT_CONTACT', updatedAt: new Date() }).where(eq(leads.id, lead.id));
        await skipPendingFollowups(deps.db, lead.id, 'Lead unsubscribed');
        await logActivity(deps.db, lead.orgId, 'LEAD_UNSUBSCRIBED', 'LEAD', lead.id);
      }
      const [org] = await deps.db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, lead.orgId));
      res.type('html').send(page("You're unsubscribed", `You won't receive any more follow-up emails from ${escapeHtml(org?.name ?? 'this clinic')}.`));
    })
  );
  return r;
}

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/**
 * GET /a/:token — the patient's confirm / cancel page from a reminder email.
 * Changes happen only on POST, so link scanners that open the email can't cancel a visit.
 */
export function appointmentLinksRoute(deps: AppDeps): Router {
  const { db } = deps;
  const r = Router();
  const limiter = rateLimit({ windowMs: 60_000, max: 20, key: (req) => req.ip ?? '' });

  async function find(token: string) {
    if (!TOKEN.test(token)) return undefined;
    const [appt] = await db.select().from(appointments).where(eq(appointments.manageToken, token)).limit(1);
    if (!appt) return undefined;
    const [org] = await db.select().from(organizations).where(eq(organizations.id, appt.orgId));
    const [lead] = appt.leadId ? await db.select().from(leads).where(eq(leads.id, appt.leadId)) : [];
    return org ? { appt, org, lead } : undefined;
  }
  const missing = () => page('Link not recognised', 'This appointment link is not valid or has expired. Please contact the clinic.');
  const callUs = (org: { phone: string | null }) => (org.phone ? ` call us on ${escapeHtml(formatPhone(org.phone))} or` : '');

  r.get(
    '/a/:token',
    limiter,
    route(async (req, res) => {
      const found = await find(req.params.token);
      res.set('Cache-Control', 'no-store');
      if (!found) return void res.status(404).type('html').send(missing());
      const { appt, org } = found;
      const when = escapeHtml(formatSlot(appt.startsAt, org.timezone));
      const what = `${escapeHtml(appt.service)} at ${escapeHtml(org.name)}`;
      const active = (appt.status === 'REQUESTED' || appt.status === 'CONFIRMED') && appt.startsAt.getTime() > Date.now();
      if (!active) {
        const state = appt.status === 'CANCELLED' ? 'has been cancelled' : appt.startsAt.getTime() <= Date.now() ? 'has already taken place' : `is ${appt.status.toLowerCase().replace('_', '-')}`;
        return void res.type('html').send(page('Your appointment', `${what} on ${when} ${state}. To book again,${callUs(org)} reply to our email.`));
      }
      const base = `/a/${encodeURIComponent(req.params.token)}`;
      const buttons = [
        appt.patientConfirmedAt ? '' : `<form method="post" action="${base}/confirm"><button class="primary" type="submit">I'll be there</button></form>`,
        `<form method="post" action="${base}/cancel" onsubmit="return confirm('Cancel this appointment?')"><button type="submit">Cancel appointment</button></form>`,
      ].join('');
      const note = appt.patientConfirmedAt ? '<p>Thanks — you’ve confirmed you can make it.</p>' : '';
      res.type('html').send(page('Your appointment', `${what}<br><strong>${when}</strong>`, `${note}${buttons}<p style="margin-top:16px;font-size:14px">Need a different time?${callUs(org)} reply to our email.</p>`));
    })
  );

  r.post(
    '/a/:token/confirm',
    limiter,
    route(async (req, res) => {
      const found = await find(req.params.token);
      if (!found) return void res.status(404).type('html').send(missing());
      const { appt, org } = found;
      if (!(appt.status === 'REQUESTED' || appt.status === 'CONFIRMED') || appt.startsAt.getTime() <= Date.now()) {
        return void res.redirect(303, `/a/${encodeURIComponent(req.params.token)}`);
      }
      if (!appt.patientConfirmedAt) {
        await db.update(appointments).set({ patientConfirmedAt: new Date(), updatedAt: new Date() }).where(eq(appointments.id, appt.id));
        await logActivity(db, org.id, 'APPOINTMENT_CONFIRMED_BY_PATIENT', 'APPOINTMENT', appt.id, { leadId: appt.leadId });
      }
      res.type('html').send(page('See you soon!', `Thanks for confirming your appointment at ${escapeHtml(org.name)} on ${escapeHtml(formatSlot(appt.startsAt, org.timezone))}.`));
    })
  );

  r.post(
    '/a/:token/cancel',
    limiter,
    route(async (req, res) => {
      const found = await find(req.params.token);
      if (!found) return void res.status(404).type('html').send(missing());
      const { appt, org, lead } = found;
      const now = new Date();
      if (!(appt.status === 'REQUESTED' || appt.status === 'CONFIRMED') || appt.startsAt.getTime() <= now.getTime()) {
        return void res.redirect(303, `/a/${encodeURIComponent(req.params.token)}`);
      }
      const label = formatSlot(appt.startsAt, org.timezone);
      await db.transaction(async (tx) => {
        const [updated] = await tx.update(appointments).set({ status: 'CANCELLED', updatedAt: now }).where(eq(appointments.id, appt.id)).returning();
        await onAppointmentChange(tx, org, appt, updated, now);
        await logActivity(tx, org.id, 'APPOINTMENT_CANCELLED_BY_PATIENT', 'APPOINTMENT', appt.id, { leadId: appt.leadId, startsAt: appt.startsAt });
        await queueStaffAlert(tx, { org, kind: 'CANCELLED', lead: lead ?? null, detail: `${appt.service} on ${label}`, publicUrl: deps.config.publicUrl });
      });
      res
        .type('html')
        .send(page('Appointment cancelled', `Your appointment on ${escapeHtml(label)} has been cancelled. Whenever you'd like to book again,${callUs(org)} reply to our email.`));
    })
  );
  return r;
}
