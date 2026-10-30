import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decompose, isSymptom } from '../server/receptionist/decompose.ts';
import { learnProfile, type PatientProfile } from '../server/receptionist/profile.ts';
import {
  WHEN_DONE,
  comparedAttribute,
  finishWindow,
  monthTarget,
  monthsIn,
  percentOf,
  perItem,
  quantityOf,
  yearsIn,
} from '../server/receptionist/reasoning.ts';
import { explainTerms } from '../server/knowledge/plain.ts';

describe('reasoning helpers', () => {
  it('reads quantities, per-item prices and percentages', () => {
    assert.deepEqual(quantityOf('how much would 3 veneers cost'), { count: 3, item: 'veneers' });
    assert.deepEqual(quantityOf('price for both wisdom teeth'), { count: 2, item: 'wisdom teeth' });
    assert.deepEqual(quantityOf('two upper front crowns'), { count: 2, item: 'crowns' });
    assert.equal(quantityOf('how much is a crown'), undefined);
    assert.equal(perItem('per tooth (implant, abutment and crown)'), 'tooth');
    assert.equal(perItem('per visit'), undefined);
    assert.equal(percentOf('my plan covers 80% of it'), 80);
    assert.equal(percentOf('covers 250%'), undefined);
  });

  it('reads lengths of time, not intervals', () => {
    assert.deepEqual(monthsIn('treatment often takes 6 to 18 months'), { min: 6, max: 18 });
    assert.deepEqual(monthsIn('commonly around 18 months to 2 years'), { min: 18, max: 24 });
    assert.equal(monthsIn('adjustment visits every 4 to 8 weeks'), undefined);
    assert.deepEqual(yearsIn('bridges commonly last 5 to 15 years'), { min: 5, max: 15 });
    assert.ok((yearsIn('with good care they can last for decades')?.min ?? 0) >= 20);
  });

  it('works out deadlines and finishing dates', () => {
    const now = new Date('2026-10-16T14:00:00Z');
    assert.equal(monthTarget('can I be done by June?', now), '2027-06-30');
    assert.equal(monthTarget("i'm getting married next june, can i get braces done by then", now), '2027-06-30');
    assert.equal(monthTarget('before my wedding in march 2028', now), '2028-03-31');
    assert.equal(monthTarget('I started in June', now), undefined);
    assert.deepEqual(finishWindow(now, { min: 6, max: 18 }, 'America/New_York'), { from: 'April 2027', to: 'April 2028' });
    assert.ok(WHEN_DONE.test('if i start invisalign now when will i be done'));
    assert.ok(WHEN_DONE.test('can i get my teeth straight with invisalign before my wedding'));
    assert.ok(!WHEN_DONE.test('how long do braces take'));
  });

  it('knows what a comparison is about', () => {
    assert.deepEqual(comparedAttribute('which lasts longer, an implant or a bridge'), { attribute: 'longevity', wantHigh: true });
    assert.deepEqual(comparedAttribute('which is faster, invisalign or braces'), { attribute: 'duration', wantHigh: false });
    assert.deepEqual(comparedAttribute('is a bridge cheaper than an implant'), { attribute: 'cost', wantHigh: false });
  });
});

describe('patient memory', () => {
  it('learns facts the patient mentions, and corrections', () => {
    const p: PatientProfile = {};
    assert.deepEqual(learnProfile(p, "I'm 12 weeks pregnant and I smoke"), ['pregnant', 'smoker']);
    assert.deepEqual(learnProfile(p, 'I quit smoking last year actually'), ['smoker']);
    assert.equal(p.smoker, false);
    learnProfile(p, "I don't have dental insurance and I'm on warfarin");
    assert.equal(p.uninsured, true);
    assert.equal(p.bloodThinner, true);
    learnProfile(p, 'my insurance covers 50 percent');
    assert.equal(p.coveragePercent, 50);
    learnProfile(p, 'for my 7 year old son');
    assert.deepEqual([p.child, p.childAge], [true, 7]);
  });

  it("doesn't learn what wasn't said", () => {
    const p: PatientProfile = {};
    learnProfile(p, "I'm not nervous, I just want a cleaning. When I was pregnant my gums bled.");
    assert.equal(p.anxious, undefined);
    assert.equal(p.pregnant, false);
    assert.deepEqual(learnProfile({}, 'do implants hurt?'), []);
  });
});

describe('long messages', () => {
  it('splits a story into the problem and each ask', () => {
    const parts = decompose(
      "I've had a throbbing pain on my left side for about a week and it wakes me up at night. I'm really nervous about dentists and I don't have insurance. How much would it cost to get it checked and can you see me this week?"
    );
    assert.deepEqual(parts, [
      "I've had a throbbing pain on my left side for about a week and it wakes me up at night.",
      'How much does an exam cost without insurance?',
      'can you see me this week?',
      "I'm nervous about going to the dentist.",
    ]);
    assert.ok(isSymptom(parts![0]));
    assert.ok(!isSymptom('does it hurt?'));
  });

  it('leaves short messages alone', () => {
    assert.equal(decompose('how much are implants and do they hurt?'), undefined);
  });
});

describe('plain words', () => {
  it('explains the dental terms in a sentence', () => {
    const terms = explainTerms('Root canal treatment removes infected pulp and cleans the canals.');
    assert.ok(terms.some((t) => t.startsWith('pulp means')));
    assert.ok(terms.some((t) => t.startsWith('canals means')));
  });
});
