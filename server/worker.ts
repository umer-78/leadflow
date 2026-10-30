/**
 * Background worker: sends due follow-ups, confirmations, staff alerts and the
 * reminders in automations.ts, and runs the periodic automation sweeps.
 * Rows are claimed with FOR UPDATE SKIP LOCKED, so several app instances can
 * run the worker safely.
 */
import { and, asc, eq, inArray, lt, lte } from 'drizzle-orm';
import type { Config } from './config.ts';
import type { DB } from './db/client.ts';
import { appointments, knowledgeArticles, leads, organizations, outboundMessages, type OutboundMessage } from './db/schema.ts';
import { AUTOMATION_KINDS, prepareAutomation, queueDigests, queueReactivations } from './automations.ts';
import { renderFollowup } from './emails.ts';
import { STOP_STATUSES } from './leads.ts';
import { textToHtml, type Mailer } from './mailer.ts';

export interface WorkerDeps {
  db: DB;
  mailer: Mailer;
  config: Pick<Config, 'publicUrl'>;
}

/** Why a follow-up should not be sent, or undefined if it should. */
async function stopReason(db: DB, m: OutboundMessage): Promise<string | undefined> {
  if (!m.leadId) return 'Lead no longer exists';
  const [lead] = await db.select().from(leads).where(eq(leads.id, m.leadId)).limit(1);
  if (!lead) return 'Lead no longer exists';
  if (lead.optedOut) return 'Lead opted out';
  if (STOP_STATUSES.includes(lead.status)) return `Lead is ${lead.status.replace(/_/g, ' ').toLowerCase()}`;
  const [appt] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.leadId, lead.id), inArray(appointments.status, ['REQUESTED', 'CONFIRMED', 'COMPLETED'])))
    .limit(1);
  if (appt) return 'Lead has an appointment';
  const [org] = await db.select({ followupsEnabled: organizations.followupsEnabled }).from(organizations).where(eq(organizations.id, m.orgId));
  if (!org?.followupsEnabled) return 'Follow-ups are turned off in Settings';
  return undefined;
}

async function renderDueFollowup(deps: WorkerDeps, m: OutboundMessage): Promise<{ subject: string; text: string }> {
  const { db, config } = deps;
  const [lead] = await db.select().from(leads).where(eq(leads.id, m.leadId!));
  const [org] = await db.select().from(organizations).where(eq(organizations.id, m.orgId));
  const articles = await db
    .select()
    .from(knowledgeArticles)
    .where(and(eq(knowledgeArticles.orgId, org.id), eq(knowledgeArticles.published, true)));
  const usable = articles.filter((a) => !/\[[^\]]{3,}\]/.test(a.summary));
  const article =
    usable.find((a) => a.service === lead.serviceInterest && a.category === 'PROCEDURE') ??
    usable.find((a) => a.service === lead.serviceInterest);
  return renderFollowup(m.step ?? 0, {
    org,
    lead,
    article,
    financing: usable.find((a) => a.slug === 'payment-and-financing'),
    insurance: usable.find((a) => a.slug === 'insurance'),
    bookingUrl: config.publicUrl ? `${config.publicUrl}/chat.html?key=${org.publicKey}&book=1` : undefined,
    unsubscribeUrl: config.publicUrl ? `${config.publicUrl}/u/${lead.unsubscribeToken}` : undefined,
  });
}

/** Send everything that is due. Returns how many messages were processed. */
export async function processDue(deps: WorkerDeps, now: Date = new Date(), limit = 25): Promise<number> {
  const { db, mailer } = deps;
  // Recover rows left in SENDING by a crashed process.
  await db
    .update(outboundMessages)
    .set({ status: 'PENDING' })
    .where(and(eq(outboundMessages.status, 'SENDING'), lt(outboundMessages.scheduledFor, new Date(now.getTime() - 10 * 60_000))));

  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.status, 'PENDING'), lte(outboundMessages.scheduledFor, now)))
      .orderBy(asc(outboundMessages.scheduledFor))
      .limit(limit)
      .for('update', { skipLocked: true });
    if (rows.length) {
      await tx
        .update(outboundMessages)
        .set({ status: 'SENDING' })
        .where(inArray(outboundMessages.id, rows.map((r) => r.id)));
    }
    return rows;
  });

  for (const m of claimed) {
    try {
      let subject = m.subject;
      let text = m.body;
      if (m.kind === 'FOLLOWUP') {
        const reason = await stopReason(db, m);
        if (reason) {
          await db.update(outboundMessages).set({ status: 'SKIPPED', statusReason: reason }).where(eq(outboundMessages.id, m.id));
          continue;
        }
        ({ subject, text } = await renderDueFollowup(deps, m));
      } else if (AUTOMATION_KINDS.includes(m.kind)) {
        const prepared = await prepareAutomation({ db, publicUrl: deps.config.publicUrl, now }, m);
        if ('skip' in prepared) {
          await db.update(outboundMessages).set({ status: 'SKIPPED', statusReason: prepared.skip }).where(eq(outboundMessages.id, m.id));
          continue;
        }
        ({ subject, text } = prepared.send);
      }
      if (!mailer.live) {
        await db
          .update(outboundMessages)
          .set({ status: 'LOGGED', subject, body: text, sentAt: new Date(), statusReason: 'No email provider configured: logged, not sent' })
          .where(eq(outboundMessages.id, m.id));
        continue;
      }
      const result = await mailer.send({ to: m.toAddress, subject, text, html: textToHtml(text) });
      await db
        .update(outboundMessages)
        .set({ status: 'SENT', subject, body: text, sentAt: new Date(), providerId: result.id ?? null, statusReason: null })
        .where(eq(outboundMessages.id, m.id));
    } catch (err) {
      await db
        .update(outboundMessages)
        .set({ status: 'FAILED', statusReason: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error' })
        .where(eq(outboundMessages.id, m.id));
    }
  }
  return claimed.length;
}

/** Queue the periodic automations (each is idempotent, so running it twice queues nothing new). */
export async function runSweeps(deps: WorkerDeps, now: Date = new Date()): Promise<{ reactivations: number; digests: number }> {
  return {
    reactivations: await queueReactivations(deps.db, now),
    digests: await queueDigests(deps.db, now, deps.config.publicUrl),
  };
}

const SWEEP_EVERY_MS = 15 * 60_000;

export interface Worker {
  /** Run a pass now (no-op if one is already running). */
  tick(): Promise<void>;
  stop(): void;
}

export function startWorker(deps: WorkerDeps, intervalMs: number): Worker {
  let running: Promise<void> | undefined;
  let lastSweep = 0;
  const tick = () => {
    running ??= (async () => {
      try {
        if (Date.now() - lastSweep >= SWEEP_EVERY_MS) {
          lastSweep = Date.now();
          await runSweeps(deps);
        }
        while ((await processDue(deps)) > 0) {
          /* drain the queue */
        }
      } catch (err) {
        console.error('[worker] pass failed:', err instanceof Error ? err.message : err);
      } finally {
        running = undefined;
      }
    })();
    return running;
  };
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  void tick();
  return { tick, stop: () => clearInterval(timer) };
}
