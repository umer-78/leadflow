/**
 * Website chat: one visitor message in, one assistant reply out, everything
 * persisted. Each turn runs in a transaction with the conversation row locked,
 * so concurrent messages can't corrupt the dialogue state or double-book.
 */
import { and, asc, eq, gte, inArray, lte, max, sql } from 'drizzle-orm';
import { formatPhone } from '../packages/localbrain/src/index.ts';
import type { Config } from './config.ts';
import type { DB } from './db/client.ts';
import {
  appointments,
  conversations,
  knowledgeArticles,
  leads,
  messages,
  organizations,
  outboundMessages,
  type Conversation,
  type Organization,
} from './db/schema.ts';
import { renderConfirmation } from './emails.ts';
import { HttpError, isUuid } from './http.ts';
import {
  haltFollowupsOnReply,
  logActivity,
  queueStaffAlert,
  rescoreLead,
  scheduleFollowups,
  skipPendingFollowups,
  upsertLeadFromContact,
  type Queryable,
} from './leads.ts';
import {
  Receptionist,
  newChatState,
  type Article,
  type ChatState,
  type ClinicPort,
  type Slot,
  type SlotPreference,
} from './receptionist/engine.ts';
import { findSlots, formatSlot } from './scheduling.ts';

export interface ChatDeps {
  db: DB;
  config: Pick<Config, 'publicUrl'>;
  /** Called after a turn that queued email, to send it promptly. */
  kick?: () => void;
  now?: () => Date;
}

// ---------------------------------------------------------------- receptionists

const cache = new Map<string, { key: string; receptionist: Receptionist }>();

export function clinicProfile(org: Organization) {
  return {
    name: org.name,
    phone: org.phone,
    email: org.email,
    address: org.address,
    website: org.website,
    timezone: org.timezone,
    hours: org.hours,
    greeting: org.greeting,
    emergencyInstructions: org.emergencyInstructions,
  };
}

/** The org's receptionist, rebuilt only when its settings or knowledge change. */
export async function receptionistFor(q: Queryable, org: Organization): Promise<Receptionist> {
  const [{ n, latest }] = await q
    .select({ n: sql<number>`count(*)::int`, latest: max(knowledgeArticles.updatedAt) })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.orgId, org.id));
  const key = `${org.updatedAt.getTime()}|${n}|${latest ? new Date(latest).getTime() : 0}`;
  const hit = cache.get(org.id);
  if (hit?.key === key) return hit.receptionist;
  const rows = await q.select().from(knowledgeArticles).where(eq(knowledgeArticles.orgId, org.id));
  const receptionist = new Receptionist(clinicProfile(org), rows as Article[]);
  cache.set(org.id, { key, receptionist });
  return receptionist;
}

// ---------------------------------------------------------------- scheduling port

async function busyIntervals(q: Queryable, orgId: string, from: Date, to: Date) {
  const rows = await q
    .select({ start: appointments.startsAt, end: appointments.endsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, orgId),
        inArray(appointments.status, ['REQUESTED', 'CONFIRMED']),
        lte(appointments.startsAt, to),
        gte(appointments.endsAt, from)
      )
    );
  return rows;
}

export function slotFinder(q: Queryable, org: Organization, now: Date) {
  return async (pref: SlotPreference): Promise<Slot[]> => {
    const busy = await busyIntervals(q, org.id, now, new Date(now.getTime() + 30 * 86_400_000));
    return findSlots({
      now,
      tz: org.timezone,
      hours: org.hours,
      slotMinutes: org.slotMinutes,
      minNoticeHours: org.minNoticeHours,
      busy,
      ...pref,
    }).map((d) => ({ startsAt: d.toISOString(), label: formatSlot(d, org.timezone) }));
  };
}

// ---------------------------------------------------------------- public API

export async function orgByKey(db: DB, publicKey: string): Promise<Organization> {
  const [org] = await db.select().from(organizations).where(eq(organizations.publicKey, publicKey)).limit(1);
  if (!org) throw new HttpError(404, 'This chat is not available.');
  return org;
}

export async function widgetConfig(deps: ChatDeps, publicKey: string) {
  const org = await orgByKey(deps.db, publicKey);
  const receptionist = await receptionistFor(deps.db, org);
  return {
    clinic: { name: org.name, phone: org.phone ? formatPhone(org.phone) : null, website: org.website },
    greeting: receptionist.greeting(),
  };
}

/** Messages of a visitor's conversation, so the widget can restore it after a page load. */
export async function conversationHistory(deps: ChatDeps, publicKey: string, conversationId: string, visitorId: string) {
  const org = await orgByKey(deps.db, publicKey);
  if (!isUuid(conversationId)) return { messages: [] };
  const [convo] = await deps.db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.orgId, org.id), eq(conversations.visitorId, visitorId)))
    .limit(1);
  if (!convo) return { messages: [] };
  const rows = await deps.db
    .select({ role: messages.role, body: messages.body, meta: messages.meta, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .orderBy(asc(messages.createdAt));
  return {
    messages: rows.map((m) => ({
      role: m.role,
      body: m.body,
      suggestions: (m.meta as { suggestions?: string[] }).suggestions,
      createdAt: m.createdAt,
    })),
  };
}

export interface ChatInput {
  publicKey: string;
  conversationId?: string;
  visitorId: string;
  message: string;
  pageUrl?: string;
}

export interface ChatOutput {
  conversationId: string;
  reply: { text: string; suggestions?: string[] };
}

export async function chatTurn(deps: ChatDeps, input: ChatInput): Promise<ChatOutput> {
  const now = deps.now?.() ?? new Date();
  const org = await orgByKey(deps.db, input.publicKey);
  let queuedEmail = false;

  const output = await deps.db.transaction(async (tx) => {
    let convo: Conversation | undefined;
    if (input.conversationId && isUuid(input.conversationId)) {
      [convo] = await tx
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.orgId, org.id)))
        .limit(1)
        .for('update');
      if (convo && convo.visitorId !== input.visitorId) convo = undefined;
    }
    if (!convo) {
      [convo] = await tx
        .insert(conversations)
        .values({ orgId: org.id, visitorId: input.visitorId, pageUrl: input.pageUrl?.slice(0, 500) ?? null, state: newChatState() as unknown as Record<string, unknown> })
        .returning();
    }
    const conversation = convo;
    await tx.insert(messages).values({ conversationId: conversation.id, orgId: org.id, role: 'visitor', body: input.message });

    const receptionist = await receptionistFor(tx, org);
    const state: ChatState = { ...newChatState(), ...(conversation.state as Partial<ChatState>) };

    const port: ClinicPort = {
      findSlots: slotFinder(tx, org, now),
      async reserve(slot, service, contact) {
        const start = new Date(slot.startsAt);
        const end = new Date(start.getTime() + org.slotMinutes * 60_000);
        if (start.getTime() < now.getTime()) return { ok: false, reason: 'That time has passed' };
        const clash = await busyIntervals(tx, org.id, start, end);
        if (clash.some((b) => b.start < end && b.end > start)) return { ok: false, reason: 'Slot taken' };
        const { lead } = await upsertLeadFromContact(tx, org, conversation, contact, service);
        conversation.leadId = lead.id;
        const [appt] = await tx
          .insert(appointments)
          .values({ orgId: org.id, leadId: lead.id, startsAt: start, endsAt: end, service, notes: 'Requested by the website assistant' })
          .returning();
        const [booked] = await tx
          .update(leads)
          .set({ status: lead.status === 'WON' ? 'WON' : 'BOOKED', updatedAt: now })
          .where(eq(leads.id, lead.id))
          .returning();
        await skipPendingFollowups(tx, lead.id, 'Lead requested an appointment');
        await logActivity(tx, org.id, 'APPOINTMENT_REQUESTED', 'APPOINTMENT', appt.id, { service, startsAt: appt.startsAt, leadId: lead.id });
        if (booked.email && !booked.optedOut) {
          const email = renderConfirmation(org, booked, service, slot.label, deps.config.publicUrl ? `${deps.config.publicUrl}/u/${booked.unsubscribeToken}` : undefined);
          await tx.insert(outboundMessages).values({
            orgId: org.id,
            leadId: booked.id,
            kind: 'CONFIRMATION',
            toAddress: booked.email,
            subject: email.subject,
            body: email.text,
            scheduledFor: now,
          });
        }
        await queueStaffAlert(tx, {
          org,
          kind: 'APPOINTMENT',
          lead: booked,
          detail: `${service} on ${slot.label} (please confirm with the patient)`,
          conversationId: conversation.id,
          dedupeKey: `appointment:${appt.id}`,
          publicUrl: deps.config.publicUrl,
        });
        queuedEmail = true;
        return { ok: true, appointmentId: appt.id };
      },
    };

    const result = await receptionist.respond(input.message, state, port, now);
    await tx.insert(messages).values({
      conversationId: conversation.id,
      orgId: org.id,
      role: 'assistant',
      body: result.reply.text,
      meta: {
        ...result.meta,
        suggestions: result.reply.suggestions,
        // Unanswered questions are listed in the dashboard so the clinic can teach the assistant.
        ...(result.meta.unanswered ? { question: input.message.slice(0, 500) } : {}),
      } as Record<string, unknown>,
    });

    // ---- lead sync
    const contact = result.state.contact;
    let lead = undefined as Awaited<ReturnType<typeof upsertLeadFromContact>>['lead'] | undefined;
    if (conversation.leadId || contact.email || contact.phone) {
      const upserted = await upsertLeadFromContact(tx, org, conversation, contact, result.state.service);
      lead = upserted.lead;
      if (result.state.service && lead.serviceInterest !== result.state.service && lead.status !== 'BOOKED') {
        [lead] = await tx.update(leads).set({ serviceInterest: result.state.service }).where(eq(leads.id, lead.id)).returning();
      }
      const urgent = result.state.urgency === 'URGENT' || result.state.urgency === 'ER';
      const patch: Partial<typeof lead> = { lastActivityAt: now };
      if (urgent && !lead.urgent) patch.urgent = true;
      if (result.events.optOut || result.state.optedOut) {
        patch.optedOut = true;
        patch.status = 'DO_NOT_CONTACT';
      }
      [lead] = await tx.update(leads).set(patch).where(eq(leads.id, lead.id)).returning();
      lead = await rescoreLead(tx, lead, result.state, receptionist.caseValueFor(lead.serviceInterest), now);

      if (lead.optedOut) await skipPendingFollowups(tx, lead.id, 'Lead opted out');
      if (upserted.created) {
        if ((await scheduleFollowups(tx, org, lead, now)) > 0) queuedEmail = true;
        await queueStaffAlert(tx, {
          org,
          kind: 'NEW_LEAD',
          lead,
          conversationId: conversation.id,
          dedupeKey: 'new_lead',
          publicUrl: deps.config.publicUrl,
        });
        queuedEmail = true;
      } else {
        await haltFollowupsOnReply(tx, lead.id);
      }
    }

    // ---- escalation
    const esc = result.events.escalate;
    if (esc) {
      const queued = await queueStaffAlert(tx, {
        org,
        kind: esc.level,
        lead: lead ?? null,
        reason: esc.reason,
        conversationId: conversation.id,
        dedupeKey: `${esc.level}:${lead?.id ?? 'anon'}`,
        publicUrl: deps.config.publicUrl,
      });
      if (queued) queuedEmail = true;
    }

    const flagged = !!esc || result.meta.safety === 'ER' || result.meta.safety === 'URGENT';
    await tx
      .update(conversations)
      .set({
        state: result.state as unknown as Record<string, unknown>,
        leadId: lead?.id ?? conversation.leadId,
        messageCount: sql`${conversations.messageCount} + 2`,
        lastMessageAt: now,
        status: esc ? 'ESCALATED' : conversation.status === 'CLOSED' ? 'OPEN' : conversation.status,
        needsAttention: conversation.needsAttention || flagged,
        attentionReason: flagged ? (esc?.reason ?? result.meta.safetyReason ?? null) : conversation.attentionReason,
      })
      .where(eq(conversations.id, conversation.id));

    return { conversationId: conversation.id, reply: { text: result.reply.text, suggestions: result.reply.suggestions } };
  });

  if (queuedEmail) deps.kick?.();
  return output;
}
