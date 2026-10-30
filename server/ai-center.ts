/**
 * The AI Center: how much the assistant is doing (workload), how well it is
 * doing it (answer rate, questions it couldn't answer, answers patients said
 * were wrong), whether the clinic's setup lets it do its job (setup checks and
 * a self-test run against the clinic's own knowledge), and whether its
 * knowledge is current (built-in library updates).
 */
import crypto from 'node:crypto';
import { and, asc, count, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { DB } from './db/client.ts';
import { appointments, conversations, knowledgeArticles, leads, messages, outboundMessages, type Organization } from './db/schema.ts';
import { libraryFor, removedTopics } from './knowledge/sync.ts';
import { libraryVersion } from './orgs.ts';
import { automationsOf } from './automations.ts';
import { claudeCost, type ClaudeUsage } from './claude.ts';
import { receptionistFor, slotFinder } from './chat.ts';
import { newChatState, type TurnResult } from './receptionist/engine.ts';
import { isOpenAt, utcToZoned } from './scheduling.ts';

const DAY = 86_400_000;

interface Meta {
  skill?: string;
  unanswered?: boolean;
  safety?: 'ER' | 'URGENT' | 'SOON';
  sources?: { slug: string; title: string }[];
  llm?: { model: string; answered: boolean; usage?: ClaudeUsage };
}

export interface Workload {
  days: number;
  conversations: number;
  visitorMessages: number;
  /** Conversations the assistant finished without needing the team. */
  handledAlone: number;
  escalations: { reason: string; count: number }[];
  /** Appointments booked in chat. */
  bookings: number;
  /** Leads captured from chat. */
  leads: number;
  /** Conversations started while the clinic was closed. */
  afterHours: number;
  /** Conversations started in each clinic-local hour (0–23). */
  byHour: number[];
  byDay: { date: string; conversations: number; messages: number }[];
  emails: { kind: string; sent: number; skipped: number; failed: number; scheduled: number }[];
  /** Answers Claude wrote, its tokens and their estimated cost (null when the model's prices aren't known). */
  claude: { answers: number; unanswered: number; tokens: ClaudeUsage; cost: number | null };
}

export interface Quality {
  answered: number;
  unanswered: number;
  /** Turns where the patient said an answer was wrong. */
  complaints: number;
  safety: { er: number; urgent: number; soon: number };
  topics: { slug: string; title: string; count: number }[];
  /** Questions the assistant couldn't answer, most asked first. */
  gaps: { question: string; count: number; lastAsked: string; conversationId: string }[];
  /** "That's not what I asked": the question, the answer and what the patient said. */
  corrections: { question: string; answer: string; reply: string; at: string; conversationId: string }[];
}

const normalize = (q: string) =>
  q
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9$%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Workload and answer quality over the last `days` days. */
export async function aiActivity(db: DB, org: Organization, days: number, now = new Date()): Promise<{ workload: Workload; quality: Quality }> {
  const since = new Date(now.getTime() - days * DAY);
  const convos = await db
    .select({ id: conversations.id, createdAt: conversations.createdAt, needsAttention: conversations.needsAttention, reason: conversations.attentionReason })
    .from(conversations)
    .where(and(eq(conversations.orgId, org.id), gte(conversations.createdAt, since)));
  const rows = await db
    .select({ conversationId: messages.conversationId, role: messages.role, body: messages.body, meta: messages.meta, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.orgId, org.id), gte(messages.createdAt, since)))
    .orderBy(asc(messages.conversationId), asc(messages.createdAt))
    .limit(20_000);

  const byHour = Array.from({ length: 24 }, () => 0);
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayKeys.push(utcToZoned(new Date(now.getTime() - i * DAY), org.timezone).date);
  const byDay = new Map(dayKeys.map((d) => [d, { date: d, conversations: 0, messages: 0 }]));
  let afterHours = 0;
  const escalations = new Map<string, number>();
  for (const c of convos) {
    const local = utcToZoned(c.createdAt, org.timezone);
    byHour[Number(local.time.slice(0, 2))]++;
    const bucket = byDay.get(local.date);
    if (bucket) bucket.conversations++;
    if (!isOpenAt(org.hours, c.createdAt, org.timezone)) afterHours++;
    if (c.needsAttention) {
      const reason = c.reason ?? 'Needs a reply';
      escalations.set(reason, (escalations.get(reason) ?? 0) + 1);
    }
  }

  const claude: Workload['claude'] = { answers: 0, unanswered: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, cost: 0 };
  const quality: Quality = { answered: 0, unanswered: 0, complaints: 0, safety: { er: 0, urgent: 0, soon: 0 }, topics: [], gaps: [], corrections: [] };
  const topics = new Map<string, { slug: string; title: string; count: number }>();
  const gaps = new Map<string, Quality['gaps'][number]>();
  let visitorMessages = 0;
  // The last two exchanges in the conversation being read.
  let current = '';
  let lastQuestion = '';
  let lastAnswer = '';
  let previousQuestion = '';
  let previousAnswer = '';
  for (const m of rows) {
    if (m.conversationId !== current) {
      current = m.conversationId;
      lastQuestion = lastAnswer = previousQuestion = previousAnswer = '';
    }
    if (m.role === 'visitor') {
      visitorMessages++;
      const bucket = byDay.get(utcToZoned(m.createdAt, org.timezone).date);
      if (bucket) bucket.messages++;
      previousQuestion = lastQuestion;
      previousAnswer = lastAnswer;
      lastQuestion = m.body;
      continue;
    }
    lastAnswer = m.body;
    const meta = m.meta as Meta;
    if (meta.llm) {
      claude.answers++;
      if (!meta.llm.answered) claude.unanswered++;
      const usage = meta.llm.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      for (const key of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) claude.tokens[key] += usage[key] ?? 0;
      const cost = claudeCost(meta.llm.model, usage);
      claude.cost = cost === undefined || claude.cost === null ? null : claude.cost + cost;
    }
    if (meta.unanswered) {
      quality.unanswered++;
      const key = normalize(lastQuestion);
      if (key.length >= 3) {
        const gap = gaps.get(key);
        if (gap) {
          gap.count++;
          gap.lastAsked = m.createdAt.toISOString();
          gap.conversationId = m.conversationId;
        } else {
          gaps.set(key, { question: lastQuestion.slice(0, 300), count: 1, lastAsked: m.createdAt.toISOString(), conversationId: m.conversationId });
        }
      }
    } else {
      quality.answered++;
    }
    if (meta.skill?.split('+').includes('complaint')) {
      quality.complaints++;
      if (previousQuestion) {
        quality.corrections.push({
          question: previousQuestion.slice(0, 300),
          answer: previousAnswer.slice(0, 500),
          reply: lastQuestion.slice(0, 300),
          at: m.createdAt.toISOString(),
          conversationId: m.conversationId,
        });
      }
    }
    if (meta.safety === 'ER') quality.safety.er++;
    else if (meta.safety === 'URGENT') quality.safety.urgent++;
    else if (meta.safety === 'SOON') quality.safety.soon++;
    for (const s of meta.sources ?? []) {
      const t = topics.get(s.slug) ?? { slug: s.slug, title: s.title, count: 0 };
      t.count++;
      topics.set(s.slug, t);
    }
  }
  quality.topics = [...topics.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  quality.gaps = [...gaps.values()].sort((a, b) => b.count - a.count || b.lastAsked.localeCompare(a.lastAsked)).slice(0, 20);
  quality.corrections = quality.corrections.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);

  const [{ bookings }] = await db
    .select({ bookings: count() })
    .from(appointments)
    .where(and(eq(appointments.orgId, org.id), eq(appointments.source, 'AI_RECEPTIONIST'), gte(appointments.createdAt, since)));
  const [{ captured }] = await db
    .select({ captured: count() })
    .from(leads)
    .where(and(eq(leads.orgId, org.id), eq(leads.source, 'WEB_CHAT'), gte(leads.createdAt, since)));
  const emailRows = await db
    .select({ kind: outboundMessages.kind, status: outboundMessages.status, n: count() })
    .from(outboundMessages)
    .where(and(eq(outboundMessages.orgId, org.id), gte(outboundMessages.scheduledFor, since), sql`${outboundMessages.scheduledFor} <= ${now}`))
    .groupBy(outboundMessages.kind, outboundMessages.status);
  const emails = new Map<string, Workload['emails'][number]>();
  for (const r of emailRows) {
    const e = emails.get(r.kind) ?? { kind: r.kind, sent: 0, skipped: 0, failed: 0, scheduled: 0 };
    if (r.status === 'SENT' || r.status === 'LOGGED') e.sent += r.n;
    else if (r.status === 'SKIPPED') e.skipped += r.n;
    else if (r.status === 'FAILED') e.failed += r.n;
    else e.scheduled += r.n;
    emails.set(r.kind, e);
  }

  return {
    workload: {
      days,
      conversations: convos.length,
      visitorMessages,
      handledAlone: convos.filter((c) => !c.needsAttention).length,
      escalations: [...escalations.entries()].map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count),
      bookings,
      leads: captured,
      afterHours,
      byHour,
      byDay: [...byDay.values()],
      emails: [...emails.values()].sort((a, b) => b.sent - a.sent),
      claude: { ...claude, cost: claude.cost === null ? null : Math.round(claude.cost * 100) / 100 },
    },
    quality,
  };
}

// ---------------------------------------------------------------- setup checks and self-test

export interface Check {
  id: string;
  area: 'Clinic' | 'Knowledge' | 'Email' | 'Website' | 'Assistant';
  status: 'ok' | 'warn' | 'fail';
  title: string;
  detail: string;
  fix?: { label: string; href: string };
}

const PLACEHOLDER = /\[[^\]]{3,}\]/;

/** Whether the clinic's setup lets the assistant do its job. */
export async function setupChecks(db: DB, org: Organization, emailLive: boolean, now = new Date(), claudeModel?: string): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const clinic = { label: 'Clinic settings', href: '#/settings/clinic' };
  add(
    org.phone
      ? { id: 'phone', area: 'Clinic', status: 'ok', title: 'Phone number', detail: 'Patients with urgent problems are given your number.' }
      : { id: 'phone', area: 'Clinic', status: 'fail', title: 'Phone number missing', detail: 'Urgent problems are told to call the clinic, but there is no number to give.', fix: clinic }
  );
  add(
    org.notificationEmail || org.email
      ? { id: 'alerts', area: 'Clinic', status: 'ok', title: 'Team alerts', detail: `New leads, bookings and urgent problems are emailed to ${org.notificationEmail ?? org.email}.` }
      : { id: 'alerts', area: 'Clinic', status: 'fail', title: 'Nowhere to send team alerts', detail: 'Add a notification email so the team hears about new leads, bookings and urgent problems.', fix: clinic }
  );
  const openDays = Object.values(org.hours ?? {}).filter((d) => d.length).length;
  add(
    openDays
      ? { id: 'hours', area: 'Clinic', status: 'ok', title: 'Opening hours', detail: `Open ${openDays} day${openDays === 1 ? '' : 's'} a week; the assistant only offers times inside these hours.` }
      : { id: 'hours', area: 'Clinic', status: 'fail', title: 'No opening hours', detail: "Without opening hours the assistant can't offer appointment times.", fix: { label: 'Hours & booking', href: '#/settings/hours' } }
  );
  if (!org.address) add({ id: 'address', area: 'Clinic', status: 'warn', title: 'No address', detail: 'The assistant can’t answer “where are you?” or give directions.', fix: clinic });
  if (!org.emergencyInstructions) {
    add({ id: 'emergency', area: 'Assistant', status: 'warn', title: 'No out-of-hours emergency instructions', detail: 'Urgent problems after hours are only told to call 911 for emergencies or the clinic when it opens. Add an on-call number if you have one.', fix: { label: 'Assistant settings', href: '#/settings/assistant' } });
  }
  add(
    emailLive
      ? { id: 'email', area: 'Email', status: 'ok', title: 'Email delivery', detail: 'Follow-ups, reminders and alerts are being delivered.' }
      : { id: 'email', area: 'Email', status: 'warn', title: 'Emails are not being delivered', detail: 'No email provider is connected, so emails are written and logged in the Outbox but not sent.' }
  );
  if (claudeModel) {
    add(
      org.claudeEnabled
        ? { id: 'claude', area: 'Assistant', status: 'ok', title: 'Claude answers open questions', detail: `Questions about treatments and follow-ups are answered by ${claudeModel} from your knowledge base.` }
        : { id: 'claude', area: 'Assistant', status: 'warn', title: 'Claude answers are off', detail: 'Open questions are answered by the built-in assistant only.', fix: { label: 'Assistant settings', href: '#/settings/assistant' } }
    );
  }
  const automations = automationsOf(org);
  if (!automations.reminders.enabled) add({ id: 'reminders', area: 'Email', status: 'warn', title: 'Appointment reminders are off', detail: 'Reminders with a confirm link cut no-shows.', fix: { label: 'Reminders', href: '#/settings/automations' } });

  const all = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.orgId, org.id));
  const articles = all.filter((a) => a.published);
  if (!articles.length) add({ id: 'knowledge', area: 'Knowledge', status: 'fail', title: 'No published knowledge', detail: 'The assistant has nothing to answer from.', fix: { label: 'Knowledge', href: '#/knowledge' } });
  // Clinic policies start as templates with [placeholders] and stay hidden until they're filled in.
  const unfinished = all.filter((a) => a.category === 'POLICY' && (!a.published || PLACEHOLDER.test(`${a.summary} ${a.body}`)));
  add(
    unfinished.length
      ? {
          id: 'placeholders',
          area: 'Knowledge',
          status: 'fail',
          title: `${unfinished.length} clinic polic${unfinished.length === 1 ? 'y isn’t' : 'ies aren’t'} filled in`,
          detail: `Until they are, the assistant can’t answer these from your own details: ${unfinished.slice(0, 4).map((a) => a.title).join(', ')}${unfinished.length > 4 ? '…' : ''}.`,
          fix: { label: 'Knowledge', href: '#/knowledge' },
        }
      : { id: 'placeholders', area: 'Knowledge', status: 'ok', title: 'Policies filled in', detail: 'Insurance, payment and visit policies are written in your own words.' }
  );
  const unpriced = articles.filter((a) => a.category === 'PROCEDURE' && a.service && a.priceMin === null);
  const priced = articles.filter((a) => a.category === 'PROCEDURE' && a.service && a.priceMin !== null);
  if (unpriced.length) {
    add({
      id: 'prices',
      area: 'Knowledge',
      status: priced.length ? 'warn' : 'fail',
      title: `${unpriced.length} treatment${unpriced.length === 1 ? ' has' : 's have'} no price`,
      detail: `For these the assistant says the team will give a quote: ${unpriced.slice(0, 4).map((a) => a.title).join(', ')}${unpriced.length > 4 ? '…' : ''}. Prices are the most-asked question.`,
      fix: { label: 'Set prices', href: '#/knowledge' },
    });
  } else if (priced.length) {
    add({ id: 'prices', area: 'Knowledge', status: 'ok', title: 'Prices set', detail: `The assistant can quote ${priced.length} treatments.` });
  }

  const [{ seen }] = await db
    .select({ seen: count() })
    .from(conversations)
    .where(and(eq(conversations.orgId, org.id), isNotNull(conversations.pageUrl), gte(conversations.createdAt, new Date(now.getTime() - 30 * DAY))));
  add(
    seen
      ? { id: 'widget', area: 'Website', status: 'ok', title: 'Chat is live on your website', detail: `${seen} chat${seen === 1 ? '' : 's'} from your website in the last 30 days.` }
      : { id: 'widget', area: 'Website', status: 'warn', title: 'No chats from your website yet', detail: 'Check the chat snippet is on every page of your website.', fix: { label: 'Website chat', href: '#/settings/widget' } }
  );
  return checks;
}

export interface Probe {
  id: string;
  question: string;
  ok: boolean;
  problem?: string;
  reply: string;
  skill: string;
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;
/** "How much are dental implants?" / "How much is teeth whitening?" */
const howMuch = (service: string) => `How much ${/[^s]s$/i.test(service) ? 'are' : 'is'} ${service.toLowerCase()}?`;

/** Ask the assistant what patients ask most, using the clinic's own knowledge, and check the answers. Nothing is saved. */
export async function selfTest(db: DB, org: Organization, now = new Date()): Promise<Probe[]> {
  const receptionist = await receptionistFor(db, org);
  const port = { findSlots: slotFinder(db, org, now), reserve: async () => ({ ok: true as const, appointmentId: 'self-test' }) };
  const articles = await db.select().from(knowledgeArticles).where(and(eq(knowledgeArticles.orgId, org.id), eq(knowledgeArticles.published, true)));
  const probes: { id: string; question: string; check: (t: TurnResult) => string | undefined }[] = [];
  const noPlaceholder = (t: TurnResult) => (PLACEHOLDER.test(t.reply.text) ? 'The answer shows a [placeholder] from an unfilled article.' : undefined);

  probes.push({
    id: 'hours',
    question: 'What are your opening hours?',
    check: (t) => (t.meta.skill !== 'hours' ? 'Didn’t answer with your opening hours.' : /don['’]t have|not sure/i.test(t.reply.text) ? 'Opening hours are missing.' : undefined),
  });
  if (org.address) {
    const part = org.address.split(',')[0].trim();
    probes.push({ id: 'location', question: 'Where are you located?', check: (t) => (t.reply.text.includes(part) ? undefined : 'Didn’t give your address.') });
  }
  probes.push({ id: 'insurance', question: 'Do you take insurance?', check: noPlaceholder });
  probes.push({ id: 'financing', question: 'Do you offer payment plans?', check: noPlaceholder });
  probes.push({ id: 'first-visit', question: 'What happens at my first visit?', check: (t) => noPlaceholder(t) ?? (t.meta.unanswered ? 'Couldn’t answer.' : undefined) });
  const priced = articles.filter((a) => a.category === 'PROCEDURE' && a.service && a.priceMin !== null).slice(0, 4);
  for (const a of priced) {
    probes.push({
      id: `price-${a.slug}`,
      question: howMuch(a.service!),
      check: (t) => (t.reply.text.includes(money(a.priceMin!)) ? undefined : `Didn’t quote your price (${money(a.priceMin!)}${a.priceMax && a.priceMax !== a.priceMin ? `–${money(a.priceMax)}` : ''}).`),
    });
  }
  const unpriced = articles.find((a) => a.category === 'PROCEDURE' && a.service && a.priceMin === null);
  if (unpriced) {
    probes.push({
      id: `no-price-${unpriced.slug}`,
      question: howMuch(unpriced.service!),
      check: (t) => (/\$\d/.test(t.reply.text) ? 'Quoted a price you haven’t set.' : undefined),
    });
  }
  probes.push({ id: 'urgent', question: 'I knocked my tooth out playing football', check: (t) => (t.meta.safety === 'URGENT' ? undefined : 'Didn’t treat a knocked-out tooth as urgent.') });
  probes.push({ id: 'er', question: 'My face is swollen and the swelling is spreading to my eye', check: (t) => (t.meta.safety === 'ER' ? undefined : 'Didn’t send a spreading facial swelling to the ER.') });
  probes.push({
    id: 'booking',
    question: 'Can I book a check-up next week?',
    check: (t) => (t.meta.skill === 'offer_slots' && /\b1\.\s/.test(t.reply.text) ? undefined : 'Didn’t offer appointment times (check your opening hours and booking settings).'),
  });

  const out: Probe[] = [];
  for (const p of probes) {
    const t = await receptionist.respond(p.question, newChatState(), port, now);
    const problem = p.check(t);
    out.push({ id: p.id, question: p.question, ok: !problem, problem, reply: t.reply.text.slice(0, 600), skill: t.meta.skill });
  }
  return out;
}

// ---------------------------------------------------------------- updates

export interface UpdateStatus {
  /** Short fingerprint of the built-in library as shipped with this server. */
  version: string;
  articles: number;
  upToDate: number;
  /** Library articles in this clinic that a sync would update. */
  pending: number;
  /** New library articles this clinic doesn't have yet. */
  available: number;
  /** Topics the clinic deleted (never re-added). */
  removed: number;
  /** Library articles the clinic rewrote; `changed` when the library has a newer version since. */
  edited: { id: string; title: string; changed: boolean }[];
  checkedAt: string;
}

export async function updateStatus(db: DB, org: Organization, now = new Date()): Promise<UpdateStatus> {
  const library = libraryFor(org.isDemo);
  const versions = library.map((a) => libraryVersion(a));
  const rows = await db
    .select({ id: knowledgeArticles.id, slug: knowledgeArticles.slug, title: knowledgeArticles.title, source: knowledgeArticles.source, libraryVersion: knowledgeArticles.libraryVersion })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.orgId, org.id));
  const have = new Map(rows.map((r) => [r.slug, r]));
  const removedSet = await removedTopics(db, org.id);
  const status: UpdateStatus = {
    version: crypto.createHash('sha256').update(versions.join('|')).digest('hex').slice(0, 8),
    articles: library.length,
    upToDate: 0,
    pending: 0,
    available: 0,
    removed: 0,
    edited: [],
    checkedAt: now.toISOString(),
  };
  library.forEach((a, i) => {
    const row = have.get(a.slug);
    if (!row) {
      if (removedSet.has(a.slug) || removedSet.has(a.title.toLowerCase())) status.removed++;
      else status.available++;
    } else if (row.source === 'library') {
      if (row.libraryVersion === versions[i]) status.upToDate++;
      else status.pending++;
    } else if (row.source === 'edited') {
      status.edited.push({ id: row.id, title: row.title, changed: !!row.libraryVersion && row.libraryVersion !== versions[i] });
    }
  });
  status.edited.sort((a, b) => Number(b.changed) - Number(a.changed) || a.title.localeCompare(b.title));
  return status;
}
