/**
 * Reminders and follow-ups against a real PostgreSQL database (see api.test.ts).
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { and, eq } from 'drizzle-orm';
import pg from 'pg';
import { createApp } from '../server/app.ts';
import { loadConfig } from '../server/config.ts';
import { connect, runMigrations, type Database } from '../server/db/client.ts';
import { appointments, leads, organizations, outboundMessages } from '../server/db/schema.ts';
import { mergeAutomations, DEFAULT_AUTOMATIONS } from '../server/automations.ts';
import { newUnsubscribeToken } from '../server/leads.ts';
import type { MailMessage, Mailer } from '../server/mailer.ts';
import { utcToZoned, zonedToUtc } from '../server/scheduling.ts';
import { processDue, runSweeps } from '../server/worker.ts';

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const HOUR = 3_600_000;

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any; text: string }>;

describe('automation settings', () => {
  it('validates changes and keeps the defaults for the rest', () => {
    const next = mergeAutomations(DEFAULT_AUTOMATIONS, { reminders: { hoursBefore: [2, 48, 2] }, recall: { months: 12 } });
    assert.deepEqual(next.reminders.hoursBefore, [48, 2]);
    assert.equal(next.recall.months, 12);
    assert.equal(next.noShow.enabled, true);
    assert.throws(() => mergeAutomations(DEFAULT_AUTOMATIONS, { reviews: { enabled: true } }), /review link/);
    assert.throws(() => mergeAutomations(DEFAULT_AUTOMATIONS, { reviews: { url: 'javascript:alert(1)' } }), /https/);
    assert.throws(() => mergeAutomations(DEFAULT_AUTOMATIONS, { recall: { months: 0 } }), /1 to 24/);
    assert.throws(() => mergeAutomations(DEFAULT_AUTOMATIONS, { teleport: {} }), /Unknown automation/);
  });
});

describe('automations', { skip: !ADMIN_URL && 'set TEST_DATABASE_URL to run the automation tests' }, () => {
  const dbName = `leadflow_auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  let database: Database;
  let server: Server;
  let base = '';
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    live: true,
    async send(m) {
      sent.push(m);
      return { id: `test-${sent.length}` };
    },
  };
  const config = loadConfig({ env: 'test', publicUrl: 'https://app.test', seedDemo: false });
  const deps = () => ({ db: database.db, mailer, config });
  const mailTo = (to: string) => sent.filter((m) => m.to === to);

  function client(): Call {
    let cookie = '';
    return async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
        redirect: 'manual',
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* html */
      }
      return { status: res.status, body: parsed, text };
    };
  }

  let owner: Call;
  let orgId = '';

  before(async () => {
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${dbName}`;
    database = connect(url.toString());
    await runMigrations(database.db);
    server = createApp({ db: database.db, config, mailer }).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    owner = client();
    const signup = await owner('POST', '/api/auth/signup', { clinicName: 'Reminder Dental', name: 'Rae', email: 'rae@reminder.test', password: 'password123' });
    assert.equal(signup.status, 201);
    const settings = await owner('PATCH', '/api/settings', { notificationEmail: 'team@reminder.test', phone: '5552223333' });
    assert.equal(settings.status, 200);
    orgId = settings.body.id;
  });

  after(async () => {
    server?.close();
    await database?.close();
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  const hourFrom = (ms: number) => new Date(Math.ceil((Date.now() + ms) / HOUR) * HOUR);

  async function book(name: string, email: string, startsAt: Date, extra: Record<string, unknown> = {}) {
    const r = await owner('POST', '/api/appointments', { startsAt: startsAt.toISOString(), service: 'Check-up and cleaning', name, email, ...extra });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body as { id: string; leadId: string; manageToken: string };
  }

  const queued = (appointmentId: string) => database.db.select().from(outboundMessages).where(eq(outboundMessages.appointmentId, appointmentId));

  it('reminds patients before a visit, with confirm and cancel links, and offers a cancelled slot to the waitlist', async () => {
    const db = database.db;
    const startsAt = hourFrom(3 * 24 * HOUR);
    const appt = await book('Pat Lee', 'pat@example.com', startsAt);
    const reminders = (await queued(appt.id)).filter((m) => m.kind === 'REMINDER');
    assert.deepEqual(reminders.map((m) => [m.step, m.scheduledFor.getTime()]).sort(), [
      [2, startsAt.getTime() - 2 * HOUR],
      [24, startsAt.getTime() - 24 * HOUR],
    ].sort());

    // A patient waiting for an earlier slot.
    await db.insert(leads).values({ orgId, name: 'Wren Wait', email: 'wren@example.com', waitlist: true, waitlistSince: new Date(), unsubscribeToken: newUnsubscribeToken() });

    await processDue(deps(), new Date(startsAt.getTime() - 24 * HOUR + 60_000));
    const [reminder] = mailTo('pat@example.com');
    assert.ok(reminder, 'reminder sent');
    assert.match(reminder.subject, /^Reminder: your appointment/);
    const link = `https://app.test/a/${appt.manageToken}`;
    assert.ok(reminder.text.includes(link), reminder.text);
    assert.match(reminder.text, /Please confirm you can make it/);

    // Opening the link changes nothing; the buttons do.
    const patient = client();
    const page = await patient('GET', `/a/${appt.manageToken}`);
    assert.equal(page.status, 200);
    assert.match(page.text, /I'll be there/);
    assert.equal((await patient('GET', '/a/not-a-real-token-at-all-xx')).status, 404);
    const confirmed = await patient('POST', `/a/${appt.manageToken}/confirm`);
    assert.match(confirmed.text, /Thanks for confirming/);
    const [afterConfirm] = await db.select().from(appointments).where(eq(appointments.id, appt.id));
    assert.ok(afterConfirm.patientConfirmedAt);
    assert.equal(afterConfirm.status, 'CONFIRMED');

    const cancelled = await patient('POST', `/a/${appt.manageToken}/cancel`);
    assert.match(cancelled.text, /has been cancelled/);
    const rows = await queued(appt.id);
    assert.equal(rows.find((m) => m.kind === 'REMINDER' && m.step === 2)?.status, 'SKIPPED');
    assert.equal(rows.find((m) => m.kind === 'REMINDER' && m.step === 2)?.statusReason, 'Appointment cancelled');
    const offer = rows.find((m) => m.kind === 'WAITLIST');
    assert.equal(offer?.toAddress, 'wren@example.com');
    const [alert] = await db
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.orgId, orgId), eq(outboundMessages.kind, 'STAFF_ALERT')));
    assert.match(alert.subject, /cancelled by the patient: Pat Lee/);
    // Cancelling again just shows the page.
    assert.equal((await patient('POST', `/a/${appt.manageToken}/cancel`)).status, 303);

    await processDue(deps(), new Date());
    const [waitlistMail] = mailTo('wren@example.com');
    assert.match(waitlistMail.subject, /An earlier appointment just opened up/);
    assert.match(waitlistMail.text, /chat\.html\?key=/);
  });

  it("doesn't offer a waitlist slot that has been taken again", async () => {
    const db = database.db;
    const startsAt = hourFrom(5 * 24 * HOUR);
    const first = await book('Cal Cancel', 'cal@example.com', startsAt);
    await owner('PATCH', `/api/appointments/${first.id}`, { status: 'CANCELLED' });
    // Someone else books the same time before the offer goes out.
    await book('Quinn Quick', 'quinn@example.com', startsAt);
    await processDue(deps(), new Date());
    const [offer] = (await queued(first.id)).filter((m) => m.kind === 'WAITLIST');
    assert.equal(offer.status, 'SKIPPED');
    assert.equal(offer.statusReason, 'Opening has been taken');
    assert.equal(mailTo('wren@example.com').length, 1);
    void db;
  });

  it('follows up after the visit: review request, recall, and a no-show email unless they rebooked', async () => {
    const db = database.db;
    assert.equal((await owner('PATCH', '/api/settings', { automations: { reviews: { enabled: true } } })).status, 400);
    const saved = await owner('PATCH', '/api/settings', { automations: { reviews: { enabled: true, url: 'https://g.page/r/reminder-dental/review' } } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.automations.reviews.enabled, true);
    assert.equal(saved.body.automations.recall.months, 6);

    const visit = await book('Vic Visit', 'vic@example.com', new Date(Date.now() - 3 * HOUR));
    const done = await owner('PATCH', `/api/appointments/${visit.id}`, { status: 'COMPLETED' });
    assert.equal(done.status, 200);
    const rows = await queued(visit.id);
    const review = rows.find((m) => m.kind === 'REVIEW')!;
    const recall = rows.find((m) => m.kind === 'RECALL')!;
    assert.ok(review && recall);
    const months = (recall.scheduledFor.getTime() - Date.now()) / (30.44 * 24 * HOUR);
    assert.ok(months > 5.7 && months < 6.3, `recall in ${months} months`);
    assert.equal(utcToZoned(recall.scheduledFor, 'America/New_York').time, '10:00');

    await processDue(deps(), new Date(Date.now() + 3 * HOUR));
    const [reviewMail] = mailTo('vic@example.com');
    assert.match(reviewMail.subject, /How was your visit/);
    assert.ok(reviewMail.text.includes('https://g.page/r/reminder-dental/review'));

    await processDue(deps(), new Date(recall.scheduledFor.getTime() + 60_000));
    const recallMail = mailTo('vic@example.com').find((m) => /check-up/.test(m.subject));
    assert.ok(recallMail, 'recall sent');
    assert.match(recallMail.text, /about 6 months since your last visit/);

    // A no-show who rebooks within the hour isn't chased.
    const missed = await book('Nia Noshow', 'nia@example.com', new Date(Date.now() - HOUR));
    await owner('PATCH', `/api/appointments/${missed.id}`, { status: 'NO_SHOW' });
    const [noShow] = (await queued(missed.id)).filter((m) => m.kind === 'NO_SHOW');
    assert.ok(noShow.scheduledFor.getTime() > Date.now() + 50 * 60_000);
    await book('Nia Noshow', 'nia@example.com', hourFrom(48 * HOUR), { leadId: missed.leadId, name: undefined, email: undefined });
    await processDue(deps(), new Date(Date.now() + 2 * HOUR));
    const [skipped] = (await queued(missed.id)).filter((m) => m.kind === 'NO_SHOW');
    assert.equal(skipped.status, 'SKIPPED');
    assert.equal(skipped.statusReason, 'Patient has already rebooked');
    void db;
  });

  it('invites quiet leads back once and sends the team one digest each morning', async () => {
    const db = database.db;
    assert.equal((await owner('PATCH', '/api/settings', { automations: { reactivation: { enabled: true, afterDays: 30 } } })).status, 200);
    const [quiet] = await db
      .insert(leads)
      .values({
        orgId,
        name: 'Quinn Quiet',
        email: 'quiet@example.com',
        status: 'CONTACTED',
        serviceInterest: 'Teeth whitening',
        lastActivityAt: new Date(Date.now() - 60 * 24 * HOUR),
        unsubscribeToken: newUnsubscribeToken(),
      })
      .returning();
    const first = await runSweeps(deps(), new Date());
    assert.ok(first.reactivations >= 1);
    assert.equal((await runSweeps(deps(), new Date())).reactivations, 0, 'only once');
    const [row] = await db.select().from(outboundMessages).where(and(eq(outboundMessages.leadId, quiet.id), eq(outboundMessages.kind, 'REACTIVATION')));
    await processDue(deps(), new Date(row.scheduledFor.getTime() + 60_000));
    const [mail] = mailTo('quiet@example.com');
    assert.match(mail.subject, /Still thinking about teeth whitening\?/);
    assert.match(mail.text, /Unsubscribe: https:\/\/app\.test\/u\//);

    // Tomorrow at 9am clinic time: one digest covering today.
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const today = utcToZoned(new Date(), org.timezone).date;
    const nineTomorrow = new Date(zonedToUtc(today, '09:00', org.timezone).getTime() + 24 * HOUR);
    assert.equal((await runSweeps(deps(), nineTomorrow)).digests, 1);
    assert.equal((await runSweeps(deps(), new Date(nineTomorrow.getTime() + HOUR))).digests, 0);
    const [digest] = await db.select().from(outboundMessages).where(and(eq(outboundMessages.orgId, orgId), eq(outboundMessages.kind, 'DIGEST')));
    assert.equal(digest.toAddress, 'team@reminder.test');
    assert.equal(digest.status, 'PENDING');
    assert.match(digest.subject, /^Reminder Dental: \d+ new leads?, \d+ bookings?/);
    assert.match(digest.body, /New leads: \d+/);
  });
});
