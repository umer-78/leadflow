import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIBRARY } from '../server/knowledge/library.ts';
import { checkSafety, isDiagnosisRequest, isMedicationQuestion } from '../server/receptionist/safety.ts';
import { scoreLead } from '../server/receptionist/scoring.ts';
import { demoClinic, toArticles } from './helpers.ts';

const last = <T>(a: T[]) => a[a.length - 1];

describe('safety rules', () => {
  it('sends medical emergencies to 911 / the ER', () => {
    for (const text of [
      'my face is swollen and it is spreading to my eye',
      "I can't swallow and my jaw is swollen",
      'my jaw is swollen and I can barely swallow',
      'I have a fever and my gum is swollen',
      'I was in a car accident and broke my jaw',
    ]) {
      assert.equal(checkSafety(text)?.level, 'ER', text);
    }
  });

  it('treats dental emergencies as urgent', () => {
    assert.equal(checkSafety('I knocked my tooth out playing soccer')?.topic, 'knocked-out-tooth');
    assert.equal(checkSafety('I chipped my front tooth')?.topic, 'broken-or-chipped-tooth');
    assert.equal(checkSafety('my tooth is killing me, I could not sleep')?.level, 'URGENT');
    assert.equal(checkSafety("it won't stop bleeding after my extraction")?.level, 'URGENT');
    assert.equal(checkSafety('my crown fell off')?.level, 'SOON');
  });

  it('does not flag questions about procedures or normal symptoms', () => {
    for (const text of [
      'does whitening hurt?',
      'will my teeth hurt after braces?',
      'how much does a crown cost',
      'my gums bleed when I brush',
      'how long does swelling last after wisdom teeth surgery',
      "my son's baby tooth fell out",
    ]) {
      assert.equal(checkSafety(text), undefined, text);
    }
  });

  it('recognises diagnosis and medication questions', () => {
    assert.ok(isDiagnosisRequest('do I need a root canal?'));
    assert.ok(isDiagnosisRequest("what's wrong with my tooth"));
    assert.ok(!isDiagnosisRequest('do I need an appointment?'));
    assert.ok(isMedicationQuestion('how much ibuprofen can I take?'));
    assert.ok(isMedicationQuestion('what should I take for the pain?'));
  });
});

describe('receptionist', () => {
  it('quotes only clinic-set prices', async () => {
    const priced = demoClinic();
    const [t] = await priced.chat(['how much are dental implants?']);
    assert.match(t.reply.text, /\$3,000–\$5,000 per tooth/);
    assert.equal(t.meta.skill, 'price');

    const unpriced = demoClinic(toArticles(LIBRARY));
    const [u] = await unpriced.chat(['how much are dental implants?']);
    assert.doesNotMatch(u.reply.text, /\$/);
    assert.match(u.reply.text, /exact quote after an exam/);
  });

  it('answers specific questions with the relevant passage, and follow-ups in context', async () => {
    const { chat } = demoClinic();
    const turns = await chat(['tell me about dental implants', 'how long does the whole process take', 'does it hurt?']);
    assert.match(turns[0].reply.text, /titanium or zirconia post/);
    assert.match(turns[1].reply.text, /3 to 6 months/);
    assert.match(turns[2].reply.text, /discomfort/);
    assert.deepEqual(turns[2].meta.sources.map((s) => s.slug), ['dental-implants']);
  });

  it('books a real open slot and collects contact details', async () => {
    const { chat, bookings } = demoClinic();
    const turns = await chat(["Hi, I'm Maria and I'm interested in veneers", 'yes', '2', 'maria@example.com, 555-410-2020']);
    assert.match(turns[0].reply.text, /Nice to meet you, Maria/);
    assert.match(turns[1].reply.text, /1\. .*\n2\. /s);
    assert.match(turns[2].reply.text, /phone number or email/);
    const done = last(turns);
    assert.match(done.reply.text, /You're all set, Maria/);
    assert.equal(done.events.appointmentId, 'apt-1');
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].service, 'Porcelain veneers');
    assert.deepEqual(done.state.contact, { name: 'Maria', email: 'maria@example.com', phone: '5554102020' });
  });

  it('respects date and time preferences', async () => {
    const { chat } = demoClinic();
    const [t] = await chat(['can I book an appointment next tuesday afternoon?']);
    assert.match(t.reply.text, /Tuesday, October 20 in the afternoon/);
    for (const label of t.reply.suggestions ?? []) assert.match(label, /^Tue, Oct 20 at ([1-4]|12)(:\d\d)? PM$/);
  });

  it('never double-books a slot', async () => {
    const clinic = demoClinic();
    const a = await clinic.chat(['book me in please', '1', 'Ann Lee 555 100 2000']);
    assert.match(last(a).reply.text, /You're all set/);
    const firstSlot = clinic.bookings[0].startsAt;
    const b = await clinic.chat(['book me in please']);
    assert.ok(!(b[0].state.offered ?? []).some((s) => s.startsAt === firstSlot));
  });

  it('escalates emergencies and asks for a callback number for urgent problems', async () => {
    const { chat } = demoClinic();
    const [er] = await chat(['my face is swollen and it is spreading to my eye']);
    assert.match(er.reply.text, /call 911/);
    assert.equal(er.events.escalate?.level, 'ER');

    const urgent = await chat(['I knocked my tooth out!!', 'Tom Hardy 555 777 1234']);
    assert.match(urgent[0].reply.text, /by the crown/);
    assert.equal(urgent[0].state.awaiting, 'contact');
    assert.equal(urgent[1].events.escalate?.level, 'URGENT');
    assert.match(urgent[1].reply.text, /\(555\) 777-1234/);
  });

  it('declines to diagnose or prescribe', async () => {
    const { chat } = demoClinic();
    const [d, m] = await chat(['do I need a root canal? my tooth is sensitive to cold', 'how much ibuprofen should I take?']);
    assert.match(d.reply.text, /can't diagnose/);
    assert.match(m.reply.text, /can't recommend medicines/);
  });

  it('uses only published policies and never answers from placeholders', async () => {
    const unconfigured = demoClinic(toArticles(LIBRARY));
    const [t] = await unconfigured.chat(['do you take delta dental insurance?']);
    assert.doesNotMatch(t.reply.text, /\[/);
    assert.match(t.reply.text, /don't have .* insurance details/);

    const configured = demoClinic();
    const [c] = await configured.chat(['do you take delta dental insurance?']);
    assert.match(c.reply.text, /Delta Dental/);
  });

  it('handles hours, location, opt-out and hand-off', async () => {
    const { chat } = demoClinic();
    const [hours, sat, location, human, details, optOut] = await chat([
      'what are your hours?',
      'are you open on saturday?',
      'where are you located?',
      'can I talk to a real person',
      'Jim, jim@example.com',
      'please unsubscribe me',
    ]);
    assert.match(hours.reply.text, /Mon, Tue 8 AM–5 PM/);
    assert.match(sat.reply.text, /Saturday, October 17 we're open 9 AM–1 PM/);
    assert.match(location.reply.text, /248 Harbor View Ave/);
    assert.equal(human.state.awaiting, 'contact');
    assert.equal(details.events.escalate?.level, 'HANDOFF');
    assert.equal(optOut.events.optOut, true);
  });

  it('understands typos, stays on topic and admits when it does not know', async () => {
    const { chat } = demoClinic();
    const [typo, weather, unknown] = await chat(['do u do invisalgn', 'what is the weather in paris', 'can you do botox for my migraines?']);
    assert.deepEqual(typo.meta.sources.map((s) => s.slug), ['clear-aligners']);
    assert.match(typo.reply.text, /^Yes, we offer clear aligners/);
    assert.equal(weather.meta.skill, 'offtopic');
    assert.match(weather.reply.text, /only help with dental questions/);
    assert.equal(unknown.meta.unanswered, true);
    assert.match(unknown.reply.text, /rather not guess/);
  });
});

describe('lead scoring', () => {
  it('explains every point', () => {
    const s = scoreLead({
      service: 'Dental implants',
      caseValue: 4500,
      hasName: true,
      hasPhone: true,
      hasEmail: false,
      appointmentRequested: true,
      askedToBook: true,
      urgent: false,
      wantsSoon: true,
      buyingSignals: 1,
      visitorMessages: 5,
      optedOut: false,
    });
    assert.equal(s.score, 30 + 25 + 15 + 5 + 5 + 5 + 5);
    assert.equal(s.tier, 'HIGH');
    assert.equal(s.reasons.length, 7);
    assert.equal(s.estimatedValue, 4500);
  });

  it('drops opted-out leads to low priority', () => {
    const s = scoreLead({ service: 'Dental implants', caseValue: 4500, hasName: true, hasPhone: true, hasEmail: true, appointmentRequested: false, askedToBook: true, urgent: false, wantsSoon: false, buyingSignals: 0, visitorMessages: 2, optedOut: true });
    assert.equal(s.tier, 'LOW');
  });
});
