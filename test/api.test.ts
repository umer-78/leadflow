/**
 * End-to-end API tests against a real PostgreSQL database.
 * Set TEST_DATABASE_URL to a server URL the tests may create databases on,
 * e.g. postgresql://postgres:postgres@localhost:5432/postgres
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
import { conversations, leads, outboundMessages } from '../server/db/schema.ts';
import type { MailMessage, Mailer } from '../server/mailer.ts';
import { ensureDemo } from '../server/orgs.ts';
import { processDue } from '../server/worker.ts';

const ADMIN_URL = process.env.TEST_DATABASE_URL;

type Call = (method: string, path: string, body?: unknown) => Promise<{ status: number; body: any; text: string }>;

describe('API', { skip: !ADMIN_URL && 'set TEST_DATABASE_URL to run the API tests' }, () => {
  const dbName = `leadflow_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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

  function client(): Call {
    let cookie = '';
    return async (method, path, body) => {
      const res = await fetch(base + path, {
        method,
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

  /** A website visitor talking to a clinic's chat. */
  function visitor(key: string, id = `visitor_${Math.random().toString(36).slice(2, 12)}`) {
    const http = client();
    let conversationId: string | undefined;
    return {
      id,
      get conversationId() {
        return conversationId;
      },
      async say(message: string) {
        const r = await http('POST', `/api/public/chat/${key}`, { visitorId: id, conversationId, message });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        conversationId = r.body.conversationId;
        return r.body.reply as { text: string; suggestions?: string[] };
      },
    };
  }

  before(async () => {
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${dbName}`;
    database = connect(url.toString());
    await runMigrations(database.db);
    await ensureDemo(database.db);
    server = createApp({ db: database.db, config, mailer }).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    await database?.close();
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  });

  it('reports health', async () => {
    const r = await client()('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.database, 'ok');
  });

  it('signs up, signs in and protects the dashboard', async () => {
    const owner = client();
    const signup = await owner('POST', '/api/auth/signup', { clinicName: 'Smile Studio', name: 'Sam Owner', email: 'sam@smile.test', password: 'correct horse 1' });
    assert.equal(signup.status, 201);
    assert.equal((await owner('GET', '/api/auth/me')).body.org.name, 'Smile Studio');
    assert.equal((await client()('POST', '/api/auth/signup', { clinicName: 'X', name: 'Y', email: 'SAM@smile.test', password: 'whatever12' })).status, 409);
    assert.equal((await client()('POST', '/api/auth/login', { email: 'sam@smile.test', password: 'wrong password' })).status, 401);
    assert.equal((await client()('GET', '/api/leads')).status, 401);
    assert.equal((await client()('GET', '/api/auth/me')).body.user, null);
    await owner('POST', '/api/auth/logout');
    assert.equal((await owner('GET', '/api/leads')).status, 401);
  });

  it('turns a chat into a scored lead with follow-ups, then books and stops the follow-ups', async () => {
    const v = visitor('pk_demo_brightside');
    assert.match((await v.say('How much are porcelain veneers?')).text, /\$950–\$2,500 per tooth/);
    await v.say('my email is nina@example.com');

    const db = database.db;
    const [lead] = await db.select().from(leads).where(eq(leads.email, 'nina@example.com'));
    assert.ok(lead, 'lead created');
    assert.equal(lead.serviceInterest, 'Porcelain veneers');
    const pending = await db.select().from(outboundMessages).where(eq(outboundMessages.leadId, lead.id));
    assert.deepEqual(pending.filter((m) => m.kind === 'FOLLOWUP').map((m) => m.step), [0, 1, 3, 7]);
    assert.ok(pending.some((m) => m.kind === 'STAFF_ALERT' && /New .* lead/.test(m.subject)));

    // Day-0 follow-up goes out 15 minutes later, written from the knowledge base.
    await processDue({ db, mailer, config }, new Date(Date.now() + 20 * 60_000));
    const day0 = sent.find((m) => m.to === 'nina@example.com');
    assert.ok(day0, 'day-0 follow-up sent');
    assert.match(day0.subject, /Thanks for reaching out/);
    assert.match(day0.text, /thin, custom-made shells/);
    assert.match(day0.text, /https:\/\/app\.test\/u\//);

    // Booking in the same chat.
    const offer = await v.say("I'd like to book a consultation");
    assert.ok(offer.suggestions?.length);
    assert.match(await v.say('1').then((r) => r.text), /full name/);
    assert.match((await v.say('Nina Patel')).text, /You're all set, Nina/);

    const [booked] = await db.select().from(leads).where(eq(leads.id, lead.id));
    assert.equal(booked.status, 'BOOKED');
    assert.equal(booked.tier, 'HIGH');
    assert.ok(booked.scoreReasons.some((r) => /Requested an appointment/.test(r)));
    const followups = await db.select().from(outboundMessages).where(and(eq(outboundMessages.leadId, lead.id), eq(outboundMessages.kind, 'FOLLOWUP')));
    assert.ok(followups.filter((m) => m.step! > 0).every((m) => m.status === 'SKIPPED'));
    const confirmation = await db.select().from(outboundMessages).where(and(eq(outboundMessages.leadId, lead.id), eq(outboundMessages.kind, 'CONFIRMATION')));
    assert.equal(confirmation.length, 1);
  });

  it('never double-books the same slot', async () => {
    const a = visitor('pk_demo_brightside');
    const b = visitor('pk_demo_brightside');
    const offerA = await a.say('can I book an appointment for next thursday morning?');
    const offerB = await b.say('can I book an appointment for next thursday morning?');
    assert.equal(offerA.suggestions?.[0], offerB.suggestions?.[0]);
    await a.say('1');
    assert.match((await a.say('Al Green, al@example.com')).text, /You're all set/);
    await b.say('1');
    const r = await b.say('Bo Diddley, bo@example.com');
    assert.match(r.text, /was just taken/);
  });

  it('flags emergencies for staff', async () => {
    const v = visitor('pk_demo_brightside');
    assert.match((await v.say('my face is swollen and the swelling is spreading to my eye')).text, /call 911/);
    const [convo] = await database.db.select().from(conversations).where(eq(conversations.id, v.conversationId!));
    assert.equal(convo.needsAttention, true);
    assert.equal(convo.status, 'ESCALATED');
    const alerts = await database.db.select().from(outboundMessages).where(eq(outboundMessages.kind, 'STAFF_ALERT'));
    assert.ok(alerts.some((m) => m.subject === 'Possible medical emergency in website chat'));
  });

  it('unsubscribes with one click', async () => {
    const v = visitor('pk_demo_brightside');
    await v.say('Interested in whitening, reach me at tom@example.com');
    const [lead] = await database.db.select().from(leads).where(eq(leads.email, 'tom@example.com'));
    const r = await client()('GET', `/u/${lead.unsubscribeToken}`);
    assert.equal(r.status, 200);
    assert.match(r.text, /unsubscribed/);
    const [after] = await database.db.select().from(leads).where(eq(leads.id, lead.id));
    assert.equal(after.optedOut, true);
    assert.equal(after.status, 'DO_NOT_CONTACT');
    const pending = await database.db
      .select()
      .from(outboundMessages)
      .where(and(eq(outboundMessages.leadId, lead.id), eq(outboundMessages.kind, 'FOLLOWUP'), eq(outboundMessages.status, 'PENDING')));
    assert.equal(pending.length, 0);
  });

  it('isolates clinics and enforces roles', async () => {
    const demo = client();
    assert.equal((await demo('POST', '/api/auth/login', { email: 'demo@leadflow.local', password: 'demo1234' })).status, 200);
    const demoLead = (await demo('GET', '/api/leads')).body.items[0];
    assert.ok(demoLead);

    const other = client();
    await other('POST', '/api/auth/signup', { clinicName: 'Other Clinic', name: 'Oz', email: 'oz@other.test', password: 'password123' });
    assert.equal((await other('GET', `/api/leads/${demoLead.id}`)).status, 404);
    assert.equal((await other('PATCH', `/api/leads/${demoLead.id}`, { status: 'LOST' })).status, 404);
    assert.equal((await other('GET', '/api/leads')).body.total, 0);

    await demo('POST', '/api/team', { name: 'Vee Viewer', email: 'vee@demo.test', password: 'viewer-pass-1', role: 'VIEWER' });
    await demo('POST', '/api/team', { name: 'Stu Staff', email: 'stu@demo.test', password: 'staff-pass-1', role: 'STAFF' });
    const viewer = client();
    await viewer('POST', '/api/auth/login', { email: 'vee@demo.test', password: 'viewer-pass-1' });
    assert.equal((await viewer('GET', `/api/leads/${demoLead.id}`)).status, 200);
    assert.equal((await viewer('PATCH', `/api/leads/${demoLead.id}`, { notes: 'x' })).status, 403);
    const staff = client();
    await staff('POST', '/api/auth/login', { email: 'stu@demo.test', password: 'staff-pass-1' });
    assert.equal((await staff('PATCH', `/api/leads/${demoLead.id}`, { notes: 'Called, will think about it' })).status, 200);
    assert.equal((await staff('PATCH', '/api/settings', { name: 'Hacked' })).status, 403);
    assert.equal((await staff('DELETE', `/api/leads/${demoLead.id}`)).status, 403);
  });

  it('answers from knowledge the clinic adds, and only quotes prices it sets', async () => {
    const owner = client();
    await owner('POST', '/api/auth/signup', { clinicName: 'Fresh Dental', name: 'Fay', email: 'fay@fresh.test', password: 'password123' });
    const { publicKey } = (await owner('GET', '/api/settings')).body;

    const v = visitor(publicKey);
    assert.doesNotMatch((await v.say('how much are dental implants?')).text, /\$/);

    const article = await owner('POST', '/api/knowledge', {
      title: 'Saturday appointments',
      category: 'POLICY',
      summary: 'Yes, we open on the first Saturday of every month from 9 AM to 1 PM for check-ups and cleanings.',
      tags: ['saturday', 'weekend'],
    });
    assert.equal(article.status, 201);
    assert.match((await visitor(publicKey).say('do you have saturday appointments?')).text, /first Saturday of every month/);

    await owner('PATCH', `/api/knowledge/${article.body.id}`, { published: false });
    assert.doesNotMatch((await visitor(publicKey).say('do you have saturday appointments?')).text, /first Saturday/);

    const implants = (await owner('GET', '/api/knowledge')).body.items.find((a: { slug: string }) => a.slug === 'dental-implants');
    await owner('PATCH', `/api/knowledge/${implants.id}`, { priceMin: 2800, priceMax: 4200 });
    assert.match((await visitor(publicKey).say('how much are dental implants?')).text, /\$2,800–\$4,200/);
  });

  it('validates input', async () => {
    const http = client();
    assert.equal((await http('POST', '/api/public/chat/pk_demo_brightside', { visitorId: 'visitor_123456', message: 'x'.repeat(1001) })).status, 400);
    assert.equal((await http('POST', '/api/public/chat/pk_demo_brightside', { visitorId: 'bad id!', message: 'hi' })).status, 400);
    assert.equal((await http('POST', '/api/public/chat/pk_unknown_key_123', { visitorId: 'visitor_123456', message: 'hi' })).status, 404);
    const owner = client();
    await owner('POST', '/api/auth/login', { email: 'demo@leadflow.local', password: 'demo1234' });
    assert.equal((await owner('PATCH', '/api/settings', { hours: { mon: [['17:00', '09:00']] } })).status, 400);
    assert.equal((await owner('PATCH', '/api/settings', { timezone: 'Mars/Olympus' })).status, 400);
  });

  it('stores manual appointments in the clinic time zone', async () => {
    const owner = client();
    await owner('POST', '/api/auth/login', { email: 'demo@leadflow.local', password: 'demo1234' });
    const r = await owner('POST', '/api/appointments', { name: 'Walk In', service: 'Check-up and cleaning', date: '2030-01-15', time: '09:00' });
    assert.equal(r.status, 201);
    assert.equal(r.body.startsAt, '2030-01-15T14:00:00.000Z');
  });
});
