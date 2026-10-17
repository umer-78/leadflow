import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { WeeklyHours } from '../server/db/schema.ts';
import { describeHours, findSlots, formatSlot, isOpenAt, nextOpening, utcToZoned, zonedToUtc } from '../server/scheduling.ts';

const HOURS: WeeklyHours = {
  sun: [],
  mon: [['09:00', '17:00']],
  tue: [['09:00', '17:00']],
  wed: [['09:00', '12:00'], ['13:00', '17:00']],
  thu: [['09:00', '17:00']],
  fri: [['09:00', '15:00']],
  sat: [],
};
const TZ = 'America/New_York';

describe('time zones', () => {
  it('converts clinic-local times to UTC across DST', () => {
    assert.equal(zonedToUtc('2026-07-01', '09:00', TZ).toISOString(), '2026-07-01T13:00:00.000Z');
    assert.equal(zonedToUtc('2026-12-01', '09:00', TZ).toISOString(), '2026-12-01T14:00:00.000Z');
    assert.equal(zonedToUtc('2026-03-09', '09:00', TZ).toISOString(), '2026-03-09T13:00:00.000Z'); // day after DST starts
    const back = utcToZoned(new Date('2026-12-01T14:00:00Z'), TZ);
    assert.deepEqual(back, { date: '2026-12-01', time: '09:00', weekday: 2 });
  });

  it('formats slots and hours for people', () => {
    assert.equal(formatSlot(new Date('2026-10-20T13:30:00Z'), TZ), 'Tue, Oct 20 at 9:30 AM');
    assert.equal(describeHours(HOURS), 'Mon, Tue 9 AM–5 PM; Wed 9 AM–12 PM, 1 PM–5 PM; Thu 9 AM–5 PM; Fri 9 AM–3 PM; Sat, Sun closed');
  });

  it('knows when the clinic is open', () => {
    assert.ok(isOpenAt(HOURS, new Date('2026-10-19T14:00:00Z'), TZ)); // Mon 10:00
    assert.ok(!isOpenAt(HOURS, new Date('2026-10-21T16:30:00Z'), TZ)); // Wed 12:30 lunch
    assert.ok(!isOpenAt(HOURS, new Date('2026-10-18T14:00:00Z'), TZ)); // Sunday
    assert.equal(nextOpening(HOURS, new Date('2026-10-17T14:00:00Z'), TZ)?.toISOString(), '2026-10-19T13:00:00.000Z'); // Sat -> Mon 9:00
  });
});

describe('slot search', () => {
  const base = { tz: TZ, hours: HOURS, slotMinutes: 30, minNoticeHours: 2, busy: [] as { start: Date; end: Date }[] };

  it('offers spread-out times inside opening hours with notice', () => {
    const now = new Date('2026-10-19T13:00:00Z'); // Mon 09:00
    const slots = findSlots({ ...base, now });
    assert.equal(slots.length, 3);
    assert.equal(slots[0].toISOString(), '2026-10-19T15:00:00.000Z'); // 11:00, two hours' notice
    for (const s of slots) assert.ok(isOpenAt(HOURS, s, TZ));
  });

  it('skips booked times, lunch breaks and closed days', () => {
    const now = new Date('2026-10-20T21:00:00Z'); // Tue 17:00, after hours
    const busy = [{ start: new Date('2026-10-21T13:00:00Z'), end: new Date('2026-10-21T13:30:00Z') }];
    const slots = findSlots({ ...base, now, busy, limit: 20 });
    assert.ok(!slots.some((s) => s.getTime() === busy[0].start.getTime()));
    assert.ok(!slots.some((s) => utcToZoned(s, TZ).time === '12:00' || utcToZoned(s, TZ).time === '12:30'));
    assert.ok(!slots.some((s) => [0, 6].includes(utcToZoned(s, TZ).weekday)));
  });

  it('honours date, part-of-day and time preferences', () => {
    const now = new Date('2026-10-16T14:00:00Z');
    const afternoon = findSlots({ ...base, now, date: '2026-10-22', partOfDay: 'afternoon' });
    for (const s of afternoon) {
      const z = utcToZoned(s, TZ);
      assert.equal(z.date, '2026-10-22');
      assert.ok(z.time >= '12:00' && z.time < '17:00');
    }
    const exact = findSlots({ ...base, now, date: '2026-10-22', time: '10:00', relation: 'at' });
    assert.equal(utcToZoned(exact.find((s) => utcToZoned(s, TZ).time === '10:00')!, TZ).date, '2026-10-22');
    const after = findSlots({ ...base, now, date: '2026-10-22', time: '15:00', relation: 'after' });
    for (const s of after) assert.ok(utcToZoned(s, TZ).time >= '15:00');
  });
});
