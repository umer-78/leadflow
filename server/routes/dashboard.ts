/**
 * Clinic dashboard API: overview, leads, conversations, appointments, outbox.
 * Every query is scoped to the signed-in user's organization.
 */
import { Router } from 'express';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import {
  activity,
  appointments,
  conversations,
  leads,
  messages,
  outboundMessages,
  type AppointmentStatus,
  type LeadStatus,
  type LeadTier,
} from '../db/schema.ts';
import { HttpError, body, email, nullableStr, oneOf, route, str, uuidParam } from '../http.ts';
import { logActivity, newUnsubscribeToken, setLeadStatus } from '../leads.ts';

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'WON', 'LOST', 'DO_NOT_CONTACT'];
const TIERS: LeadTier[] = ['HIGH', 'MEDIUM', 'LOW'];
const APPT_STATUSES: AppointmentStatus[] = ['REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];

const page = (q: Record<string, unknown>) => ({
  limit: Math.min(100, Math.max(1, Number(q.limit) || 25)),
  offset: Math.max(0, Number(q.offset) || 0),
});

const parseDate = (v: unknown, name: string): Date | undefined => {
  if (v === undefined || v === '') return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${name} must be a valid date.`);
  return d;
};

export function dashboardRoutes(deps: AppDeps): Router {
  const { db } = deps;
  const r = Router();
  r.use(requireAuth(db));

  // ---------------------------------------------------------------- overview
  r.get(
    '/overview',
    route(async (req, res) => {
      const org = req.auth!.org;
      const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
      const since = new Date(Date.now() - days * 86_400_000);
      const orgLeads = and(eq(leads.orgId, org.id), gte(leads.createdAt, since));

      const [[convos], [leadStats], [appts], [followups], [answered], [unanswered]] = await Promise.all([
        db.select({ n: count() }).from(conversations).where(and(eq(conversations.orgId, org.id), gte(conversations.createdAt, since))),
        db
          .select({
            n: count(),
            high: sql<number>`count(*) filter (where ${leads.tier} = 'HIGH')::int`,
            pipeline: sql<number>`coalesce(sum(${leads.estimatedValue}) filter (where ${leads.status} not in ('LOST','DO_NOT_CONTACT')), 0)::int`,
            booked: sql<number>`count(*) filter (where ${leads.status} in ('BOOKED','WON'))::int`,
          })
          .from(leads)
          .where(orgLeads),
        db.select({ n: count() }).from(appointments).where(and(eq(appointments.orgId, org.id), gte(appointments.createdAt, since))),
        db
          .select({ n: count() })
          .from(outboundMessages)
          .where(and(eq(outboundMessages.orgId, org.id), eq(outboundMessages.kind, 'FOLLOWUP'), inArray(outboundMessages.status, ['SENT', 'LOGGED']), gte(outboundMessages.createdAt, since))),
        db.select({ n: count() }).from(messages).where(and(eq(messages.orgId, org.id), eq(messages.role, 'assistant'), gte(messages.createdAt, since))),
        db
          .select({ n: count() })
          .from(messages)
          .where(and(eq(messages.orgId, org.id), eq(messages.role, 'assistant'), sql`${messages.meta}->>'unanswered' = 'true'`, gte(messages.createdAt, since))),
      ]);

      const series = await db.execute<{ day: string; conversations: number; leads: number }>(sql`
        with days as (
          select generate_series(
            date_trunc('day', now() at time zone ${org.timezone}) - interval '13 days',
            date_trunc('day', now() at time zone ${org.timezone}),
            interval '1 day'
          ) as day
        )
        select to_char(d.day, 'YYYY-MM-DD') as day,
          (select count(*)::int from ${conversations} c where c.org_id = ${org.id}
             and date_trunc('day', c.created_at at time zone ${org.timezone}) = d.day) as conversations,
          (select count(*)::int from ${leads} l where l.org_id = ${org.id}
             and date_trunc('day', l.created_at at time zone ${org.timezone}) = d.day) as leads
        from days d order by d.day`);

      const [attention, recentLeads, upcoming, unansweredList] = await Promise.all([
        db
          .select({
            id: conversations.id,
            status: conversations.status,
            reason: conversations.attentionReason,
            lastMessageAt: conversations.lastMessageAt,
            leadId: leads.id,
            leadName: leads.name,
            leadPhone: leads.phone,
          })
          .from(conversations)
          .leftJoin(leads, eq(leads.id, conversations.leadId))
          .where(and(eq(conversations.orgId, org.id), eq(conversations.needsAttention, true)))
          .orderBy(desc(conversations.lastMessageAt))
          .limit(10),
        db.select().from(leads).where(eq(leads.orgId, org.id)).orderBy(desc(leads.createdAt)).limit(8),
        db
          .select({ appointment: appointments, leadName: leads.name, leadPhone: leads.phone })
          .from(appointments)
          .leftJoin(leads, eq(leads.id, appointments.leadId))
          .where(and(eq(appointments.orgId, org.id), inArray(appointments.status, ['REQUESTED', 'CONFIRMED']), gte(appointments.startsAt, new Date())))
          .orderBy(asc(appointments.startsAt))
          .limit(8),
        db
          .select({ conversationId: messages.conversationId, meta: messages.meta, createdAt: messages.createdAt })
          .from(messages)
          .where(and(eq(messages.orgId, org.id), sql`${messages.meta}->>'unanswered' = 'true'`))
          .orderBy(desc(messages.createdAt))
          .limit(10),
      ]);

      res.json({
        days,
        kpis: {
          conversations: convos.n,
          leads: leadStats.n,
          highIntent: leadStats.high,
          appointmentsRequested: appts.n,
          bookingRate: leadStats.n ? Math.round((leadStats.booked / leadStats.n) * 100) : 0,
          pipelineValue: leadStats.pipeline,
          followupsSent: followups.n,
          answerRate: answered.n ? Math.round(((answered.n - unanswered.n) / answered.n) * 100) : 100,
        },
        series: series.rows,
        attention,
        recentLeads,
        upcoming: upcoming.map((u) => ({ ...u.appointment, leadName: u.leadName, leadPhone: u.leadPhone })),
        unanswered: unansweredList.map((m) => ({
          conversationId: m.conversationId,
          question: (m.meta as { question?: string }).question ?? '',
          createdAt: m.createdAt,
        })),
      });
    })
  );

  // ---------------------------------------------------------------- leads
  r.get(
    '/leads',
    route(async (req, res) => {
      const org = req.auth!.org;
      const { limit, offset } = page(req.query);
      const filters: SQL[] = [eq(leads.orgId, org.id)];
      const status = String(req.query.status ?? '');
      if (LEAD_STATUSES.includes(status as LeadStatus)) filters.push(eq(leads.status, status as LeadStatus));
      const tier = String(req.query.tier ?? '');
      if (TIERS.includes(tier as LeadTier)) filters.push(eq(leads.tier, tier as LeadTier));
      const q = String(req.query.q ?? '').trim();
      if (q) {
        const like = `%${q.replace(/[%_]/g, '')}%`;
        filters.push(or(ilike(leads.name, like), ilike(leads.email, like), ilike(leads.phone, like), ilike(leads.serviceInterest, like))!);
      }
      const where = and(...filters);
      const order = req.query.sort === 'score' ? [desc(leads.score), desc(leads.createdAt)] : [desc(leads.createdAt)];
      const [items, [{ n }]] = await Promise.all([
        db.select().from(leads).where(where).orderBy(...order).limit(limit).offset(offset),
        db.select({ n: count() }).from(leads).where(where),
      ]);
      res.json({ items, total: n });
    })
  );

  r.post(
    '/leads',
    requireRole('STAFF'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const b = body(req);
      const name = str(b, 'name', { max: 120 });
      const leadEmail = email(b, 'email');
      const phone = str(b, 'phone', { max: 40 })?.replace(/[^\d+]/g, '');
      if (!name && !leadEmail && !phone) throw new HttpError(400, 'Enter at least a name, email or phone number.');
      const [lead] = await db
        .insert(leads)
        .values({
          orgId: org.id,
          name: name ?? null,
          email: leadEmail ?? null,
          phone: phone || null,
          serviceInterest: str(b, 'serviceInterest', { max: 120 }) ?? null,
          notes: str(b, 'notes', { max: 5000 }) ?? null,
          source: 'MANUAL',
          unsubscribeToken: newUnsubscribeToken(),
        })
        .returning();
      await logActivity(db, org.id, 'LEAD_CREATED', 'LEAD', lead.id, { source: 'MANUAL' }, req.auth!.user.id);
      res.status(201).json(lead);
    })
  );

  r.get(
    '/leads/:id',
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.orgId, org.id))).limit(1);
      if (!lead) throw new HttpError(404, 'Lead not found.');
      const convos = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.leadId, id), eq(conversations.orgId, org.id)))
        .orderBy(desc(conversations.lastMessageAt));
      const transcript = convos.length
        ? await db
            .select()
            .from(messages)
            .where(inArray(messages.conversationId, convos.map((c) => c.id)))
            .orderBy(asc(messages.createdAt))
        : [];
      const [appts, outbound, log] = await Promise.all([
        db.select().from(appointments).where(and(eq(appointments.leadId, id), eq(appointments.orgId, org.id))).orderBy(desc(appointments.startsAt)),
        db.select().from(outboundMessages).where(and(eq(outboundMessages.leadId, id), eq(outboundMessages.orgId, org.id))).orderBy(asc(outboundMessages.scheduledFor)),
        db
          .select()
          .from(activity)
          .where(and(eq(activity.orgId, org.id), eq(activity.entityId, id)))
          .orderBy(desc(activity.createdAt))
          .limit(50),
      ]);
      res.json({
        lead,
        conversations: convos.map((c) => ({ ...c, state: undefined, messages: transcript.filter((m) => m.conversationId === c.id) })),
        appointments: appts,
        outbound,
        activity: log,
      });
    })
  );

  r.patch(
    '/leads/:id',
    requireRole('STAFF'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const b = body(req);
      let [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.orgId, org.id))).limit(1);
      if (!lead) throw new HttpError(404, 'Lead not found.');
      const status = oneOf(b, 'status', LEAD_STATUSES);
      const patch: Partial<typeof lead> = {};
      const name = nullableStr(b, 'name', 120);
      if (name !== undefined) patch.name = name;
      if ('email' in b) patch.email = b.email ? email(b, 'email')! : null;
      const phone = nullableStr(b, 'phone', 40);
      if (phone !== undefined) patch.phone = phone ? phone.replace(/[^\d+]/g, '') : null;
      const service = nullableStr(b, 'serviceInterest', 120);
      if (service !== undefined) patch.serviceInterest = service;
      const notes = nullableStr(b, 'notes', 5000);
      if (notes !== undefined) patch.notes = notes;
      if (Object.keys(patch).length) {
        [lead] = await db.update(leads).set({ ...patch, updatedAt: new Date() }).where(eq(leads.id, id)).returning();
        await logActivity(db, org.id, 'LEAD_UPDATED', 'LEAD', id, { fields: Object.keys(patch) }, req.auth!.user.id);
      }
      if (status && status !== lead.status) lead = await setLeadStatus(db, lead, status, req.auth!.user.id);
      res.json(lead);
    })
  );

  r.delete(
    '/leads/:id',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const deleted = await db.delete(leads).where(and(eq(leads.id, id), eq(leads.orgId, org.id))).returning({ id: leads.id });
      if (!deleted.length) throw new HttpError(404, 'Lead not found.');
      await logActivity(db, org.id, 'LEAD_DELETED', 'LEAD', id, {}, req.auth!.user.id);
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------- conversations
  r.get(
    '/conversations',
    route(async (req, res) => {
      const org = req.auth!.org;
      const { limit, offset } = page(req.query);
      const filters: SQL[] = [eq(conversations.orgId, org.id)];
      if (req.query.filter === 'attention') filters.push(eq(conversations.needsAttention, true));
      if (req.query.filter === 'leads') filters.push(sql`${conversations.leadId} is not null`);
      const where = and(...filters);
      const [rows, [{ n }]] = await Promise.all([
        db
          .select({
            id: conversations.id,
            status: conversations.status,
            needsAttention: conversations.needsAttention,
            attentionReason: conversations.attentionReason,
            messageCount: conversations.messageCount,
            createdAt: conversations.createdAt,
            lastMessageAt: conversations.lastMessageAt,
            pageUrl: conversations.pageUrl,
            leadId: conversations.leadId,
            leadName: leads.name,
            leadTier: leads.tier,
          })
          .from(conversations)
          .leftJoin(leads, eq(leads.id, conversations.leadId))
          .where(where)
          .orderBy(desc(conversations.lastMessageAt))
          .limit(limit)
          .offset(offset),
        db.select({ n: count() }).from(conversations).where(where),
      ]);
      const ids = rows.map((r) => r.id);
      const firstQuestions = ids.length
        ? await db
            .selectDistinctOn([messages.conversationId], { conversationId: messages.conversationId, body: messages.body })
            .from(messages)
            .where(and(inArray(messages.conversationId, ids), eq(messages.role, 'visitor')))
            .orderBy(messages.conversationId, asc(messages.createdAt))
        : [];
      const preview = new Map(firstQuestions.map((m) => [m.conversationId, m.body]));
      res.json({ items: rows.map((r) => ({ ...r, preview: preview.get(r.id) ?? '' })), total: n });
    })
  );

  r.get(
    '/conversations/:id',
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const [convo] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.orgId, org.id))).limit(1);
      if (!convo) throw new HttpError(404, 'Conversation not found.');
      const [rows, lead] = await Promise.all([
        db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt)),
        convo.leadId ? db.select().from(leads).where(eq(leads.id, convo.leadId)).then((l) => l[0] ?? null) : Promise.resolve(null),
      ]);
      res.json({ conversation: { ...convo, state: undefined }, lead, messages: rows });
    })
  );

  r.patch(
    '/conversations/:id',
    requireRole('STAFF'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const b = body(req);
      const status = oneOf(b, 'status', ['OPEN', 'CLOSED'] as const);
      const patch: Partial<typeof conversations.$inferInsert> = {};
      if (status) patch.status = status;
      if (b.needsAttention === false || status === 'CLOSED') patch.needsAttention = false;
      const [updated] = await db
        .update(conversations)
        .set(patch)
        .where(and(eq(conversations.id, id), eq(conversations.orgId, org.id)))
        .returning({ id: conversations.id, status: conversations.status, needsAttention: conversations.needsAttention });
      if (!updated) throw new HttpError(404, 'Conversation not found.');
      res.json(updated);
    })
  );

  // ---------------------------------------------------------------- appointments
  r.get(
    '/appointments',
    route(async (req, res) => {
      const org = req.auth!.org;
      const from = parseDate(req.query.from, 'from') ?? new Date(Date.now() - 86_400_000);
      const to = parseDate(req.query.to, 'to') ?? new Date(Date.now() + 60 * 86_400_000);
      const filters: SQL[] = [eq(appointments.orgId, org.id), gte(appointments.startsAt, from), lte(appointments.startsAt, to)];
      const status = String(req.query.status ?? '');
      if (APPT_STATUSES.includes(status as AppointmentStatus)) filters.push(eq(appointments.status, status as AppointmentStatus));
      const rows = await db
        .select({ appointment: appointments, leadName: leads.name, leadPhone: leads.phone, leadEmail: leads.email })
        .from(appointments)
        .leftJoin(leads, eq(leads.id, appointments.leadId))
        .where(and(...filters))
        .orderBy(asc(appointments.startsAt))
        .limit(500);
      res.json({ items: rows.map((r) => ({ ...r.appointment, leadName: r.leadName, leadPhone: r.leadPhone, leadEmail: r.leadEmail })) });
    })
  );

  r.post(
    '/appointments',
    requireRole('STAFF'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const b = body(req);
      const startsAt = parseDate(b.startsAt, 'startsAt');
      if (!startsAt) throw new HttpError(400, 'startsAt is required.');
      const service = str(b, 'service', { required: true, max: 120 })!;
      let leadId = str(b, 'leadId');
      if (leadId) {
        const [lead] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.orgId, org.id))).limit(1);
        if (!lead) throw new HttpError(400, 'Lead not found.');
      } else {
        const name = str(b, 'name', { max: 120 });
        if (!name) throw new HttpError(400, 'Choose a lead or enter the patient name.');
        const [lead] = await db
          .insert(leads)
          .values({
            orgId: org.id,
            name,
            phone: str(b, 'phone', { max: 40 })?.replace(/[^\d+]/g, '') || null,
            email: email(b, 'email') ?? null,
            serviceInterest: service,
            status: 'BOOKED',
            source: 'MANUAL',
            unsubscribeToken: newUnsubscribeToken(),
          })
          .returning();
        leadId = lead.id;
      }
      const minutes = Number(b.durationMinutes) || org.slotMinutes;
      const [appt] = await db
        .insert(appointments)
        .values({
          orgId: org.id,
          leadId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + minutes * 60_000),
          service,
          status: oneOf(b, 'status', APPT_STATUSES) ?? 'CONFIRMED',
          notes: str(b, 'notes', { max: 2000 }) ?? null,
          source: 'MANUAL',
        })
        .returning();
      await logActivity(db, org.id, 'APPOINTMENT_CREATED', 'APPOINTMENT', appt.id, { leadId, service }, req.auth!.user.id);
      res.status(201).json(appt);
    })
  );

  r.patch(
    '/appointments/:id',
    requireRole('STAFF'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const b = body(req);
      const [appt] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.orgId, org.id))).limit(1);
      if (!appt) throw new HttpError(404, 'Appointment not found.');
      const status = oneOf(b, 'status', APPT_STATUSES);
      const startsAt = parseDate(b.startsAt, 'startsAt');
      const notes = nullableStr(b, 'notes', 2000);
      const patch: Partial<typeof appt> = { updatedAt: new Date() };
      if (status) patch.status = status;
      if (startsAt) {
        patch.startsAt = startsAt;
        patch.endsAt = new Date(startsAt.getTime() + (appt.endsAt.getTime() - appt.startsAt.getTime()));
      }
      if (notes !== undefined) patch.notes = notes;
      const [updated] = await db.update(appointments).set(patch).where(eq(appointments.id, id)).returning();
      if (status && appt.leadId) {
        const [lead] = await db.select().from(leads).where(eq(leads.id, appt.leadId)).limit(1);
        if (lead && status === 'CONFIRMED' && !['BOOKED', 'WON'].includes(lead.status)) await setLeadStatus(db, lead, 'BOOKED', req.auth!.user.id);
        if (lead && status === 'COMPLETED' && lead.status !== 'WON') await setLeadStatus(db, lead, 'WON', req.auth!.user.id);
      }
      await logActivity(db, org.id, 'APPOINTMENT_UPDATED', 'APPOINTMENT', id, { status, startsAt }, req.auth!.user.id);
      res.json(updated);
    })
  );

  // ---------------------------------------------------------------- outbox & activity
  r.get(
    '/outbox',
    route(async (req, res) => {
      const org = req.auth!.org;
      const { limit, offset } = page(req.query);
      const rows = await db
        .select({ message: outboundMessages, leadName: leads.name })
        .from(outboundMessages)
        .leftJoin(leads, eq(leads.id, outboundMessages.leadId))
        .where(eq(outboundMessages.orgId, org.id))
        .orderBy(desc(outboundMessages.scheduledFor))
        .limit(limit)
        .offset(offset);
      const [{ n }] = await db.select({ n: count() }).from(outboundMessages).where(eq(outboundMessages.orgId, org.id));
      res.json({ items: rows.map((r) => ({ ...r.message, leadName: r.leadName })), total: n, emailLive: deps.mailer.live });
    })
  );

  r.get(
    '/activity',
    route(async (req, res) => {
      const rows = await db.select().from(activity).where(eq(activity.orgId, req.auth!.org.id)).orderBy(desc(activity.createdAt)).limit(100);
      res.json({ items: rows });
    })
  );

  return r;
}
