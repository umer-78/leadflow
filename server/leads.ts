/**
 * Lead lifecycle: create/merge leads from conversations, keep scores current,
 * schedule follow-ups, stop them when they should stop, and queue staff alerts.
 */
import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { DB } from './db/client.ts';
import {
  activity,
  appointments,
  conversations,
  leads,
  messages,
  outboundMessages,
  type Conversation,
  type Lead,
  type LeadStatus,
  type Organization,
} from './db/schema.ts';
import { FOLLOWUP_STEPS, renderStaffAlert, type AlertInput } from './emails.ts';
import type { ChatState, Contact } from './receptionist/engine.ts';
import { scoreLead } from './receptionist/scoring.ts';

/** Anything that can run queries: the database or an open transaction. */
export type Queryable = Pick<DB, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

/** Statuses after which automated follow-ups stop. */
export const STOP_STATUSES: LeadStatus[] = ['BOOKED', 'WON', 'LOST', 'DO_NOT_CONTACT'];

export const newUnsubscribeToken = () => crypto.randomBytes(24).toString('base64url');

export async function logActivity(
  q: Queryable,
  orgId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
  userId: string | null = null
): Promise<void> {
  await q.insert(activity).values({ orgId, action, entityType, entityId, details, userId });
}

/**
 * Find the conversation's lead, or an existing lead with the same email/phone,
 * or create a new one. Fills in contact fields that are missing.
 */
export async function upsertLeadFromContact(
  q: Queryable,
  org: Organization,
  convo: Pick<Conversation, 'id' | 'leadId'>,
  contact: Contact,
  service?: string
): Promise<{ lead: Lead; created: boolean }> {
  let lead: Lead | undefined;
  if (convo.leadId) {
    [lead] = await q.select().from(leads).where(and(eq(leads.id, convo.leadId), eq(leads.orgId, org.id))).limit(1);
  }
  if (!lead && (contact.email || contact.phone)) {
    const match = [
      contact.email ? sql`lower(${leads.email}) = ${contact.email.toLowerCase()}` : undefined,
      contact.phone ? eq(leads.phone, contact.phone) : undefined,
    ].filter((x) => x !== undefined);
    [lead] = await q
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, org.id), or(...match)))
      .orderBy(desc(leads.createdAt))
      .limit(1);
  }
  if (lead) {
    const patch: Partial<Lead> = {};
    if (contact.name && contact.name !== lead.name) patch.name = contact.name;
    if (contact.email && contact.email !== lead.email) patch.email = contact.email;
    if (contact.phone && contact.phone !== lead.phone) patch.phone = contact.phone;
    if (service && !lead.serviceInterest) patch.serviceInterest = service;
    if (Object.keys(patch).length) {
      [lead] = await q
        .update(leads)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(leads.id, lead.id))
        .returning();
    }
    return { lead, created: false };
  }
  const [created] = await q
    .insert(leads)
    .values({
      orgId: org.id,
      name: contact.name ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      serviceInterest: service ?? null,
      unsubscribeToken: newUnsubscribeToken(),
    })
    .returning();
  await logActivity(q, org.id, 'LEAD_CAPTURED', 'LEAD', created.id, { conversationId: convo.id, source: 'WEB_CHAT' });
  return { lead: created, created: true };
}

/** Recompute and store the explainable score for a chat lead. */
export async function rescoreLead(
  q: Queryable,
  lead: Lead,
  state: ChatState,
  caseValue: number | null,
  now: Date
): Promise<Lead> {
  const [{ n }] = await q
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.leadId, lead.id), inArray(appointments.status, ['REQUESTED', 'CONFIRMED', 'COMPLETED'])));
  const preferred = state.signals.preferredDate ? new Date(`${state.signals.preferredDate}T12:00:00Z`) : undefined;
  const score = scoreLead({
    service: lead.serviceInterest ?? state.service,
    caseValue,
    hasName: !!(lead.name ?? state.contact.name),
    hasPhone: !!(lead.phone ?? state.contact.phone),
    hasEmail: !!(lead.email ?? state.contact.email),
    appointmentRequested: n > 0,
    askedToBook: !!state.signals.booking,
    urgent: lead.urgent || state.urgency === 'URGENT' || state.urgency === 'ER',
    wantsSoon: !!preferred && preferred.getTime() - now.getTime() < 14 * 86_400_000,
    buyingSignals: [state.signals.price, state.signals.insurance, state.signals.financing].filter(Boolean).length,
    visitorMessages: state.visitorMessages,
    optedOut: lead.optedOut || !!state.optedOut,
  });
  const [updated] = await q
    .update(leads)
    .set({
      score: score.score,
      tier: score.tier,
      scoreReasons: score.reasons,
      estimatedValue: score.estimatedValue,
      updatedAt: now,
    })
    .where(eq(leads.id, lead.id))
    .returning();
  return updated;
}

export async function scheduleFollowups(q: Queryable, org: Organization, lead: Lead, now: Date): Promise<number> {
  if (!lead.email || lead.optedOut || !org.followupsEnabled) return 0;
  const rows = FOLLOWUP_STEPS.map((step) => ({
    orgId: org.id,
    leadId: lead.id,
    kind: 'FOLLOWUP' as const,
    step,
    toAddress: lead.email!,
    // Final content is written when it is sent, from the latest lead details.
    subject: `Follow-up (day ${step})`,
    body: '',
    // Day-0 waits 15 minutes so a visitor who books in the same chat isn't emailed.
    scheduledFor: new Date(now.getTime() + (step === 0 ? 15 * 60_000 : step * 86_400_000)),
  }));
  await q.insert(outboundMessages).values(rows);
  return rows.length;
}

/** Mark a lead's pending follow-ups as skipped. */
export async function skipPendingFollowups(q: Queryable, leadId: string, reason: string): Promise<void> {
  await q
    .update(outboundMessages)
    .set({ status: 'SKIPPED', statusReason: reason })
    .where(and(eq(outboundMessages.leadId, leadId), eq(outboundMessages.kind, 'FOLLOWUP'), eq(outboundMessages.status, 'PENDING')));
}

/** The visitor came back and chatted after a follow-up went out: stop the sequence. */
export async function haltFollowupsOnReply(q: Queryable, leadId: string): Promise<void> {
  const [delivered] = await q
    .select({ id: outboundMessages.id })
    .from(outboundMessages)
    .where(and(eq(outboundMessages.leadId, leadId), eq(outboundMessages.kind, 'FOLLOWUP'), inArray(outboundMessages.status, ['SENT', 'LOGGED'])))
    .limit(1);
  if (delivered) await skipPendingFollowups(q, leadId, 'Lead replied in chat');
}

export async function setLeadStatus(q: Queryable, lead: Lead, status: LeadStatus, userId: string | null = null): Promise<Lead> {
  const patch: Partial<Lead> = { status, updatedAt: new Date() };
  if (status === 'DO_NOT_CONTACT') patch.optedOut = true;
  const [updated] = await q.update(leads).set(patch).where(eq(leads.id, lead.id)).returning();
  if (STOP_STATUSES.includes(status)) {
    await skipPendingFollowups(q, lead.id, `Lead marked ${status.replace(/_/g, ' ').toLowerCase()}`);
  }
  await logActivity(q, lead.orgId, 'LEAD_STATUS_CHANGED', 'LEAD', lead.id, { from: lead.status, to: status }, userId);
  return updated;
}

/**
 * Queue a staff alert email (sent by the worker). With a conversation and a
 * dedupe key, each kind of alert is sent once per conversation.
 */
export async function queueStaffAlert(
  q: Queryable,
  input: Omit<AlertInput, 'transcript'> & { conversationId?: string; dedupeKey?: string; publicUrl?: string }
): Promise<boolean> {
  const to = input.org.notificationEmail ?? input.org.email;
  if (input.conversationId && input.dedupeKey) {
    const [convo] = await q
      .select({ alertsSent: conversations.alertsSent })
      .from(conversations)
      .where(eq(conversations.id, input.conversationId))
      .limit(1);
    if (convo?.alertsSent.includes(input.dedupeKey)) return false;
    await q
      .update(conversations)
      .set({ alertsSent: [...(convo?.alertsSent ?? []), input.dedupeKey] })
      .where(eq(conversations.id, input.conversationId));
  }
  const transcript = input.conversationId
    ? await q
        .select({ role: messages.role, body: messages.body })
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(asc(messages.createdAt))
    : [];
  const link = input.publicUrl
    ? input.lead
      ? `${input.publicUrl}/#/leads/${input.lead.id}`
      : input.conversationId
        ? `${input.publicUrl}/#/conversations/${input.conversationId}`
        : undefined
    : undefined;
  const email = renderStaffAlert({ ...input, transcript, link });
  await q.insert(outboundMessages).values({
    orgId: input.org.id,
    leadId: input.lead?.id ?? null,
    kind: 'STAFF_ALERT',
    toAddress: to ?? '',
    subject: email.subject,
    body: email.text,
    status: to ? 'PENDING' : 'SKIPPED',
    statusReason: to ? null : 'No notification email set in Settings',
    scheduledFor: new Date(),
  });
  return true;
}
