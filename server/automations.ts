/**
 * Patient reminders and follow-ups beyond the first enquiry: appointment
 * reminders with confirm / cancel links, check-up recalls, no-show and
 * review emails, a one-time "still thinking about it?" for leads that went
 * quiet, waitlist offers when a slot frees up, and the team's morning digest.
 *
 * Messages are queued in outbound_messages when something happens (a booking,
 * a status change) and written when they are sent, after checking they still
 * make sense: a reminder for a cancelled visit, or a recall for someone who
 * already booked, is skipped with the reason shown in the Outbox.
 */
import crypto from 'node:crypto';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notExists, sql, type Column } from 'drizzle-orm';
import type { DB } from './db/client.ts';
import {
  appointments,
  conversations,
  knowledgeArticles,
  leads,
  messages,
  organizations,
  outboundMessages,
  type Appointment,
  type AutomationSettings,
  type Lead,
  type OutboundKind,
  type OutboundMessage,
  type Organization,
} from './db/schema.ts';
import {
  renderDigest,
  renderNoShow,
  renderReactivation,
  renderRecall,
  renderReminder,
  renderReviewRequest,
  renderWaitlistOffer,
  type RenderedEmail,
} from './emails.ts';
import { HttpError } from './http.ts';
import type { Queryable } from './leads.ts';
import { formatSlot, formatTime, utcToZoned, zonedToUtc } from './scheduling.ts';

export const DEFAULT_AUTOMATIONS: AutomationSettings = {
  reminders: { enabled: true, hoursBefore: [24, 2] },
  recall: { enabled: true, months: 6 },
  noShow: { enabled: true },
  reviews: { enabled: false, url: null, delayHours: 2 },
  // Off until the clinic turns it on: it writes to every lead that went quiet.
  reactivation: { enabled: false, afterDays: 90 },
  waitlist: { enabled: true },
  digest: { enabled: true, hour: 8 },
};

/** The clinic's settings with defaults filled in. */
export function automationsOf(org: Pick<Organization, 'automations'>): AutomationSettings {
  const a = org.automations ?? {};
  const out = {} as AutomationSettings;
  for (const key of Object.keys(DEFAULT_AUTOMATIONS) as (keyof AutomationSettings)[]) {
    Object.assign(out, { [key]: { ...DEFAULT_AUTOMATIONS[key], ...(a[key] ?? {}) } });
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Validate a settings change (any subset of keys) and merge it into the current settings. */
export function mergeAutomations(current: AutomationSettings, input: unknown): AutomationSettings {
  if (!isObject(input)) throw new HttpError(400, 'automations must be an object.');
  const next = structuredClone(current);
  const flag = (group: Record<string, unknown>, name: string, key: string) => {
    if (!(key in group)) return undefined;
    if (typeof group[key] !== 'boolean') throw new HttpError(400, `automations.${name}.${key} must be true or false.`);
    return group[key] as boolean;
  };
  const whole = (group: Record<string, unknown>, name: string, key: string, min: number, max: number) => {
    if (!(key in group)) return undefined;
    const n = group[key];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `automations.${name}.${key} must be a whole number from ${min} to ${max}.`);
    return n;
  };
  for (const [name, raw] of Object.entries(input)) {
    if (!(name in DEFAULT_AUTOMATIONS)) throw new HttpError(400, `Unknown automation: ${name}.`);
    if (!isObject(raw)) throw new HttpError(400, `automations.${name} must be an object.`);
    const target = next[name as keyof AutomationSettings] as Record<string, unknown>;
    const enabled = flag(raw, name, 'enabled');
    if (enabled !== undefined) target.enabled = enabled;
    if (name === 'reminders' && 'hoursBefore' in raw) {
      const list = raw.hoursBefore;
      if (!Array.isArray(list) || list.length > 3 || list.some((h) => typeof h !== 'number' || !Number.isInteger(h) || h < 1 || h > 168)) {
        throw new HttpError(400, 'automations.reminders.hoursBefore must list up to 3 whole numbers of hours (1–168).');
      }
      target.hoursBefore = [...new Set(list as number[])].sort((x, y) => y - x);
    }
    const ranges: Record<string, [string, number, number][]> = {
      recall: [['months', 1, 24]],
      reviews: [['delayHours', 0, 72]],
      reactivation: [['afterDays', 14, 365]],
      digest: [['hour', 0, 23]],
    };
    for (const [key, min, max] of ranges[name] ?? []) {
      const n = whole(raw, name, key, min, max);
      if (n !== undefined) target[key] = n;
    }
    if (name === 'reviews' && 'url' in raw) {
      const url = raw.url;
      if (url === null || url === '') target.url = null;
      else if (typeof url !== 'string' || url.length > 500 || !/^https:\/\/[^\s]+$/i.test(url)) throw new HttpError(400, 'The review link must start with https://');
      else target.url = url;
    }
  }
  if (next.reviews.enabled && !next.reviews.url) throw new HttpError(400, 'Add your review link (for example your Google review page) to turn on review requests.');
  return next;
}

export const newManageToken = () => crypto.randomBytes(24).toString('base64url');

/** Patient-facing automations (everything but the team's digest). */
const PATIENT_KINDS: OutboundKind[] = ['REMINDER', 'RECALL', 'NO_SHOW', 'REVIEW', 'REACTIVATION', 'WAITLIST'];
export const AUTOMATION_KINDS: OutboundKind[] = [...PATIENT_KINDS, 'DIGEST'];

async function skipFor(q: Queryable, appointmentId: string, kinds: OutboundKind[], reason: string): Promise<void> {
  await q
    .update(outboundMessages)
    .set({ status: 'SKIPPED', statusReason: reason })
    .where(and(eq(outboundMessages.appointmentId, appointmentId), inArray(outboundMessages.kind, kinds), eq(outboundMessages.status, 'PENDING')));
}

const canEmail = (lead: Lead | undefined | null): lead is Lead & { email: string } => !!lead?.email && !lead.optedOut;

/** 10:00 at the clinic on the day `d` falls on (or the next day when that has passed). */
function morningOf(d: Date, tz: string, notBefore?: Date): Date {
  let at = zonedToUtc(utcToZoned(d, tz).date, '10:00', tz);
  if (notBefore && at.getTime() <= notBefore.getTime()) at = zonedToUtc(utcToZoned(new Date(at.getTime() + 86_400_000), tz).date, '10:00', tz);
  return at;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/** Queue the reminders for a booked visit (replacing any queued for an earlier time). */
export async function scheduleReminders(q: Queryable, org: Organization, appt: Appointment, lead: Lead | undefined | null, now: Date): Promise<number> {
  await skipFor(q, appt.id, ['REMINDER'], 'Appointment changed');
  const settings = automationsOf(org).reminders;
  if (!settings.enabled || !canEmail(lead) || !['REQUESTED', 'CONFIRMED'].includes(appt.status)) return 0;
  if (!appt.manageToken) await q.update(appointments).set({ manageToken: newManageToken() }).where(eq(appointments.id, appt.id));
  const rows = settings.hoursBefore
    .map((hours) => ({ hours, at: new Date(appt.startsAt.getTime() - hours * 3_600_000) }))
    // Too close to send this one (a visit booked for this afternoon gets only the later reminder).
    .filter((r) => r.at.getTime() > now.getTime() + 10 * 60_000)
    .map((r) => ({
      orgId: org.id,
      leadId: lead.id,
      appointmentId: appt.id,
      kind: 'REMINDER' as const,
      step: r.hours,
      toAddress: lead.email,
      subject: `Reminder (${r.hours} hours before)`,
      body: '',
      scheduledFor: r.at,
    }));
  if (rows.length) await q.insert(outboundMessages).values(rows);
  return rows.length;
}

/**
 * Something changed about a visit (status or time): cancel what no longer
 * applies and queue what follows from it.
 */
export async function onAppointmentChange(q: Queryable, org: Organization, before: Appointment, after: Appointment, now: Date): Promise<void> {
  const settings = automationsOf(org);
  const [lead] = after.leadId ? await q.select().from(leads).where(eq(leads.id, after.leadId)).limit(1) : [];
  const moved = before.startsAt.getTime() !== after.startsAt.getTime();
  if (before.status === after.status && !moved) return;
  const queue = (kind: OutboundKind, scheduledFor: Date, subject: string) =>
    q.insert(outboundMessages).values({ orgId: org.id, leadId: lead!.id, appointmentId: after.id, kind, toAddress: lead!.email!, subject, body: '', scheduledFor });

  switch (after.status) {
    case 'REQUESTED':
    case 'CONFIRMED':
      // Reopened (a mistaken "completed" or "no-show"): what that queued no longer applies.
      if (before.status !== after.status) await skipFor(q, after.id, ['NO_SHOW', 'REVIEW', 'RECALL'], 'Appointment reopened');
      if (moved || ['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(before.status)) await scheduleReminders(q, org, after, lead, now);
      return;
    case 'CANCELLED':
      await skipFor(q, after.id, ['REMINDER', 'NO_SHOW', 'REVIEW', 'RECALL'], 'Appointment cancelled');
      if (settings.waitlist.enabled && after.startsAt.getTime() > now.getTime() + Math.max(org.minNoticeHours, 1) * 3_600_000) {
        await queueWaitlistOffers(q, org, after, now);
      }
      return;
    case 'NO_SHOW':
      await skipFor(q, after.id, ['REMINDER', 'NO_SHOW', 'REVIEW', 'RECALL'], 'Marked as a no-show');
      // An hour's grace, so a mistaken click can be undone before the email goes.
      if (settings.noShow.enabled && canEmail(lead)) await queue('NO_SHOW', new Date(now.getTime() + 3_600_000), 'We missed you');
      return;
    case 'COMPLETED':
      await skipFor(q, after.id, ['REMINDER', 'NO_SHOW', 'REVIEW', 'RECALL'], 'Visit completed');
      if (!canEmail(lead)) return;
      if (settings.reviews.enabled) await queue('REVIEW', new Date(now.getTime() + settings.reviews.delayHours * 3_600_000), 'Review request');
      if (settings.recall.enabled) {
        const due = morningOf(addMonths(after.startsAt, settings.recall.months), org.timezone, now);
        await queue('RECALL', due, `Check-up recall (${settings.recall.months} months)`);
      }
      return;
  }
}

/** A visit was cancelled: tell up to three waitlisted patients, longest-waiting first. */
async function queueWaitlistOffers(q: Queryable, org: Organization, appt: Appointment, now: Date): Promise<number> {
  const waiting = await q
    .select()
    .from(leads)
    .where(and(eq(leads.orgId, org.id), eq(leads.waitlist, true), eq(leads.optedOut, false), isNotNull(leads.email)))
    .orderBy(asc(leads.waitlistSince), asc(leads.createdAt))
    .limit(10);
  const chosen = waiting.filter((l) => l.id !== appt.leadId).slice(0, 3);
  if (!chosen.length) return 0;
  await q.insert(outboundMessages).values(
    chosen.map((l) => ({
      orgId: org.id,
      leadId: l.id,
      appointmentId: appt.id,
      kind: 'WAITLIST' as const,
      toAddress: l.email!,
      subject: 'Waitlist: an earlier time opened up',
      body: '',
      scheduledFor: now,
    }))
  );
  return chosen.length;
}

// ---------------------------------------------------------------- at send time

export interface SendContext {
  db: DB;
  publicUrl?: string;
  now: Date;
}

export type Prepared = { send: RenderedEmail } | { skip: string };

const ACTIVE: Appointment['status'][] = ['REQUESTED', 'CONFIRMED'];

/** Check a queued automation still applies and write it from the latest details. */
export async function prepareAutomation(ctx: SendContext, m: OutboundMessage): Promise<Prepared> {
  const { db, now } = ctx;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, m.orgId));
  if (!org) return { skip: 'Clinic no longer exists' };
  if (m.kind === 'DIGEST') return { send: { subject: m.subject, text: m.body } };
  const settings = automationsOf(org);
  const [lead] = m.leadId ? await db.select().from(leads).where(eq(leads.id, m.leadId)).limit(1) : [];
  if (!lead) return { skip: 'Lead no longer exists' };
  if (lead.optedOut) return { skip: 'Lead opted out' };
  if (!lead.email) return { skip: 'No email address' };
  const [appt] = m.appointmentId ? await db.select().from(appointments).where(eq(appointments.id, m.appointmentId)).limit(1) : [];
  const base = {
    org,
    lead,
    bookingUrl: ctx.publicUrl ? `${ctx.publicUrl}/chat.html?key=${org.publicKey}&book=1` : undefined,
    unsubscribeUrl: ctx.publicUrl ? `${ctx.publicUrl}/u/${lead.unsubscribeToken}` : undefined,
  };
  const label = appt ? formatSlot(appt.startsAt, org.timezone) : '';
  const upcoming = async () => {
    const [next] = await db
      .select({ id: appointments.id, startsAt: appointments.startsAt })
      .from(appointments)
      .where(and(eq(appointments.leadId, lead.id), inArray(appointments.status, ACTIVE), gte(appointments.startsAt, now)))
      .orderBy(asc(appointments.startsAt))
      .limit(1);
    return next;
  };

  switch (m.kind) {
    case 'REMINDER': {
      if (!settings.reminders.enabled) return { skip: 'Reminders are turned off in Settings' };
      if (!appt || !ACTIVE.includes(appt.status)) return { skip: `Appointment is ${appt ? appt.status.toLowerCase().replace('_', '-') : 'gone'}` };
      if (appt.startsAt.getTime() <= now.getTime()) return { skip: 'Appointment time has passed' };
      let token = appt.manageToken;
      if (!token) {
        token = newManageToken();
        await db.update(appointments).set({ manageToken: token }).where(eq(appointments.id, appt.id));
      }
      const today = utcToZoned(now, org.timezone).date;
      const day = utcToZoned(appt.startsAt, org.timezone).date;
      const tomorrow = utcToZoned(new Date(now.getTime() + 86_400_000), org.timezone).date;
      return {
        send: renderReminder({
          ...base,
          service: appt.service,
          label,
          when: day === today ? 'today' : day === tomorrow ? 'tomorrow' : 'soon',
          manageUrl: ctx.publicUrl ? `${ctx.publicUrl}/a/${token}` : undefined,
          confirmed: !!appt.patientConfirmedAt,
        }),
      };
    }
    case 'NO_SHOW': {
      if (!settings.noShow.enabled) return { skip: 'No-show follow-ups are turned off in Settings' };
      if (!appt || appt.status !== 'NO_SHOW') return { skip: 'Appointment is no longer marked as a no-show' };
      if (await upcoming()) return { skip: 'Patient has already rebooked' };
      return { send: renderNoShow({ ...base, service: appt.service, label }) };
    }
    case 'REVIEW': {
      if (!settings.reviews.enabled || !settings.reviews.url) return { skip: 'Review requests are turned off in Settings' };
      if (!appt || appt.status !== 'COMPLETED') return { skip: 'Visit is no longer marked as completed' };
      // At most one review request per patient every six months.
      const [recent] = await db
        .select({ id: outboundMessages.id })
        .from(outboundMessages)
        .where(
          and(
            eq(outboundMessages.leadId, lead.id),
            eq(outboundMessages.kind, 'REVIEW'),
            inArray(outboundMessages.status, ['SENT', 'LOGGED']),
            gte(outboundMessages.sentAt, new Date(now.getTime() - 182 * 86_400_000))
          )
        )
        .limit(1);
      if (recent) return { skip: 'Already asked for a review recently' };
      return { send: renderReviewRequest({ ...base, reviewUrl: settings.reviews.url }) };
    }
    case 'RECALL': {
      if (!settings.recall.enabled) return { skip: 'Recalls are turned off in Settings' };
      if (!appt || appt.status !== 'COMPLETED') return { skip: 'Visit is no longer marked as completed' };
      if (await upcoming()) return { skip: 'Patient already has an appointment booked' };
      const [later] = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.leadId, lead.id), eq(appointments.status, 'COMPLETED'), sql`${appointments.startsAt} > ${appt.startsAt}`))
        .limit(1);
      if (later) return { skip: 'Patient has visited since' };
      return { send: renderRecall({ ...base, months: settings.recall.months }) };
    }
    case 'REACTIVATION': {
      if (!settings.reactivation.enabled) return { skip: 'Reactivation emails are turned off in Settings' };
      if (!['NEW', 'CONTACTED', 'QUALIFIED'].includes(lead.status)) return { skip: `Lead is ${lead.status.toLowerCase().replace(/_/g, ' ')}` };
      if (await upcoming()) return { skip: 'Lead has an appointment' };
      const articles = await db.select().from(knowledgeArticles).where(and(eq(knowledgeArticles.orgId, org.id), eq(knowledgeArticles.published, true)));
      const usable = articles.filter((a) => !/\[[^\]]{3,}\]/.test(a.summary));
      const article = lead.serviceInterest ? usable.find((a) => a.service === lead.serviceInterest && a.category === 'PROCEDURE') : undefined;
      return { send: renderReactivation({ ...base, article, financing: usable.find((a) => a.slug === 'payment-and-financing') }) };
    }
    case 'WAITLIST': {
      if (!settings.waitlist.enabled) return { skip: 'Waitlist offers are turned off in Settings' };
      if (!lead.waitlist) return { skip: 'Patient is no longer on the waitlist' };
      if (!appt) return { skip: 'Opening no longer exists' };
      if (appt.startsAt.getTime() < now.getTime() + Math.max(org.minNoticeHours, 1) * 3_600_000) return { skip: 'Opening is too soon to offer' };
      const [taken] = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.orgId, org.id),
            ne(appointments.id, appt.id),
            inArray(appointments.status, ACTIVE),
            lt(appointments.startsAt, appt.endsAt),
            sql`${appointments.endsAt} > ${appt.startsAt}`
          )
        )
        .limit(1);
      if (taken) return { skip: 'Opening has been taken' };
      const next = await upcoming();
      if (next && next.startsAt.getTime() <= appt.startsAt.getTime()) return { skip: 'Patient already has an earlier appointment' };
      return { send: renderWaitlistOffer({ ...base, label }) };
    }
    default:
      return { skip: `Unknown kind ${m.kind}` };
  }
}

// ---------------------------------------------------------------- periodic sweeps

/** Leads that went quiet without booking get one "still thinking about it?" email. */
export async function queueReactivations(db: DB, now: Date, perClinic = 25): Promise<number> {
  let queued = 0;
  for (const org of await db.select().from(organizations)) {
    const settings = automationsOf(org).reactivation;
    if (!settings.enabled) continue;
    const quiet = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.orgId, org.id),
          inArray(leads.status, ['NEW', 'CONTACTED', 'QUALIFIED']),
          eq(leads.optedOut, false),
          isNotNull(leads.email),
          isNull(leads.reactivatedAt),
          lt(leads.lastActivityAt, new Date(now.getTime() - settings.afterDays * 86_400_000)),
          notExists(db.select({ id: appointments.id }).from(appointments).where(eq(appointments.leadId, leads.id)))
        )
      )
      .orderBy(desc(leads.score))
      .limit(perClinic);
    if (!quiet.length) continue;
    const at = morningOf(now, org.timezone, now);
    await db.insert(outboundMessages).values(
      quiet.map((l) => ({ orgId: org.id, leadId: l.id, kind: 'REACTIVATION' as const, toAddress: l.email!, subject: 'Reactivation', body: '', scheduledFor: at }))
    );
    await db.update(leads).set({ reactivatedAt: now }).where(inArray(leads.id, quiet.map((l) => l.id)));
    queued += quiet.length;
  }
  return queued;
}

/** The previous clinic day as [start, end) in UTC, plus today's date at the clinic. */
function clinicDays(now: Date, tz: string) {
  const today = utcToZoned(now, tz).date;
  const yesterday = utcToZoned(new Date(zonedToUtc(today, '12:00', tz).getTime() - 86_400_000), tz).date;
  return { today, yesterday, start: zonedToUtc(yesterday, '00:00', tz), end: zonedToUtc(today, '00:00', tz), endOfToday: zonedToUtc(today, '23:59', tz) };
}

/** Build the morning summary for one clinic. */
export async function buildDigest(db: DB, org: Organization, now: Date, publicUrl?: string) {
  const { yesterday, start, end, today, endOfToday } = clinicDays(now, org.timezone);
  const inDay = (col: Column) => and(gte(col, start), lt(col, end));
  const newLeads = await db
    .select()
    .from(leads)
    .where(and(eq(leads.orgId, org.id), inDay(leads.createdAt)))
    .orderBy(desc(leads.score));
  const [{ chats }] = await db.select({ chats: count() }).from(conversations).where(and(eq(conversations.orgId, org.id), inDay(conversations.createdAt)));
  const [{ flagged }] = await db
    .select({ flagged: count() })
    .from(conversations)
    .where(and(eq(conversations.orgId, org.id), inDay(conversations.createdAt), eq(conversations.needsAttention, true)));
  const [{ unanswered }] = await db
    .select({ unanswered: count() })
    .from(messages)
    .where(and(eq(messages.orgId, org.id), eq(messages.role, 'assistant'), inDay(messages.createdAt), sql`${messages.meta}->>'unanswered' = 'true'`));
  const [{ bookings }] = await db
    .select({ bookings: count() })
    .from(appointments)
    .where(and(eq(appointments.orgId, org.id), inDay(appointments.createdAt)));
  const attention = await db
    .select({ id: conversations.id, reason: conversations.attentionReason, name: leads.name })
    .from(conversations)
    .leftJoin(leads, eq(leads.id, conversations.leadId))
    .where(and(eq(conversations.orgId, org.id), eq(conversations.needsAttention, true), ne(conversations.status, 'CLOSED')))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(5);
  const visits = await db
    .select({ startsAt: appointments.startsAt, service: appointments.service, status: appointments.status, name: leads.name })
    .from(appointments)
    .leftJoin(leads, eq(leads.id, appointments.leadId))
    .where(and(eq(appointments.orgId, org.id), inArray(appointments.status, ACTIVE), gte(appointments.startsAt, end), lt(appointments.startsAt, endOfToday)))
    .orderBy(asc(appointments.startsAt));
  const sentRows = await db
    .select({ status: outboundMessages.status, n: count() })
    .from(outboundMessages)
    .where(and(eq(outboundMessages.orgId, org.id), ne(outboundMessages.kind, 'DIGEST'), inDay(outboundMessages.scheduledFor)))
    .groupBy(outboundMessages.status);
  const sent = sentRows.filter((r) => r.status === 'SENT' || r.status === 'LOGGED').reduce((a, r) => a + r.n, 0);
  const failed = sentRows.find((r) => r.status === 'FAILED')?.n ?? 0;
  const dayLabel = new Date(`${yesterday}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const email = renderDigest({
    org,
    dayLabel,
    leads: {
      total: newLeads.length,
      high: newLeads.filter((l) => l.tier === 'HIGH').length,
      top: newLeads.slice(0, 5).map((l) => ({ name: l.name ?? 'Website visitor', service: l.serviceInterest, tier: l.tier })),
    },
    conversations: { total: chats, handled: chats - flagged, unanswered },
    bookings,
    attention: attention.map((a) => ({ name: a.name ?? 'Website visitor', reason: a.reason ?? 'Needs a reply' })),
    today: visits.map((v) => ({ time: formatTime(utcToZoned(v.startsAt, org.timezone).time), name: v.name ?? 'Patient', service: v.service, status: v.status })),
    emails: { sent, failed },
    link: publicUrl ? `${publicUrl}/` : undefined,
  });
  const quiet = !newLeads.length && !chats && !bookings && !attention.length && !visits.length;
  return { email, step: Number(today.replace(/-/g, '')), quiet };
}

/** Each clinic's morning digest, once per clinic day, in the six hours after the chosen time. */
export async function queueDigests(db: DB, now: Date, publicUrl?: string): Promise<number> {
  let queued = 0;
  for (const org of await db.select().from(organizations)) {
    const settings = automationsOf(org).digest;
    const to = org.notificationEmail ?? org.email;
    if (!settings.enabled || !to) continue;
    const local = utcToZoned(now, org.timezone);
    const hour = Number(local.time.slice(0, 2));
    // A server that was down all morning doesn't send a "morning" digest at 11 PM.
    if (hour < settings.hour || hour >= settings.hour + 6) continue;
    const step = Number(local.date.replace(/-/g, ''));
    const [already] = await db
      .select({ id: outboundMessages.id })
      .from(outboundMessages)
      .where(and(eq(outboundMessages.orgId, org.id), eq(outboundMessages.kind, 'DIGEST'), eq(outboundMessages.step, step)))
      .limit(1);
    if (already) continue;
    const digest = await buildDigest(db, org, now, publicUrl);
    await db.insert(outboundMessages).values({
      orgId: org.id,
      kind: 'DIGEST',
      step,
      toAddress: to,
      subject: digest.email.subject,
      body: digest.email.text,
      status: digest.quiet ? 'SKIPPED' : 'PENDING',
      statusReason: digest.quiet ? 'Nothing to report' : null,
      scheduledFor: now,
    });
    queued++;
  }
  return queued;
}
