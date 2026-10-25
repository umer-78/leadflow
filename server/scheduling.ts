/**
 * Clinic hours, time-zone conversion and appointment slot search.
 * All instants are UTC Dates; clinic-local values are plain strings.
 */
import { addDays, parseISODate, toISODate, weekdayOf, type PartOfDay } from '../packages/localbrain/src/index.ts';
import type { DayKey, WeeklyHours } from './db/schema.ts';

export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_HOURS: WeeklyHours = {
  sun: [],
  mon: [['09:00', '17:00']],
  tue: [['09:00', '17:00']],
  wed: [['09:00', '17:00']],
  thu: [['09:00', '17:00']],
  fri: [['09:00', '17:00']],
  sat: [],
};

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsIn(date: Date, tz: string) {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatters.set(tz, f);
  }
  const p = f.formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function offsetMs(utcMs: number, tz: string): number {
  const p = partsIn(new Date(utcMs), tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

/** Clinic-local date (YYYY-MM-DD) and time (HH:MM) -> UTC instant. Handles DST. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const { year, month, day } = parseISODate(date);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hh, mm);
  const first = offsetMs(guess, tz);
  let utc = guess - first;
  const second = offsetMs(utc, tz);
  if (second !== first) utc = guess - second;
  return new Date(utc);
}

/** UTC instant -> clinic-local date, time and weekday. */
export function utcToZoned(d: Date, tz: string): { date: string; time: string; weekday: number } {
  const p = partsIn(d, tz);
  const date = toISODate({ year: p.year, month: p.month, day: p.day });
  return {
    date,
    time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
    weekday: weekdayOf({ year: p.year, month: p.month, day: p.day }),
  };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** "14:30" -> "2:30 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

/** "Tue, Oct 20 at 9 AM" in the clinic's zone. */
export function formatSlot(d: Date, tz: string): string {
  const z = utcToZoned(d, tz);
  const { month, day } = parseISODate(z.date);
  const monthName = new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${DAY_SHORT[z.weekday]}, ${monthName} ${day} at ${formatTime(z.time)}`;
}

/** "Saturday, October 17" */
export function formatDate(date: string): string {
  const { year, month, day } = parseISODate(date);
  const wd = weekdayOf({ year, month, day });
  const monthName = new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  return `${DAY_NAMES[wd]}, ${monthName} ${day}`;
}

export function hoursOn(hours: WeeklyHours, weekday: number): [string, string][] {
  return hours[DAY_KEYS[weekday]] ?? [];
}

const intervalsLabel = (iv: [string, string][]) => iv.map(([a, b]) => `${formatTime(a)}–${formatTime(b)}`).join(', ');

/** Human summary, grouping consecutive days with identical hours: "Mon–Fri 9 AM–5 PM; Sat 9 AM–1 PM; Sun closed". */
export function describeHours(hours: WeeklyHours): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { days: number[]; label: string }[] = [];
  for (const wd of order) {
    const iv = hoursOn(hours, wd);
    const label = iv.length ? intervalsLabel(iv) : 'closed';
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(wd);
    else groups.push({ days: [wd], label });
  }
  return groups
    .map((g) => {
      const span = g.days.length > 2 ? `${DAY_SHORT[g.days[0]]}–${DAY_SHORT[g.days[g.days.length - 1]]}` : g.days.map((d) => DAY_SHORT[d]).join(', ');
      return `${span} ${g.label}`;
    })
    .join('; ');
}

/** Opening hours on a given clinic-local date, as a sentence fragment. */
export function describeDay(hours: WeeklyHours, date: string): string {
  const iv = hoursOn(hours, weekdayOf(parseISODate(date)));
  return iv.length ? `open ${intervalsLabel(iv)}` : 'closed';
}

export function isOpenAt(hours: WeeklyHours, d: Date, tz: string): boolean {
  const z = utcToZoned(d, tz);
  const now = toMinutes(z.time);
  return hoursOn(hours, z.weekday).some(([a, b]) => now >= toMinutes(a) && now < toMinutes(b));
}

/** The next time the clinic opens after `now` (within a week), or undefined. */
export function nextOpening(hours: WeeklyHours, now: Date, tz: string): Date | undefined {
  const today = utcToZoned(now, tz).date;
  for (let i = 0; i < 8; i++) {
    const date = toISODate(addDays(parseISODate(today), i));
    for (const [open] of hoursOn(hours, weekdayOf(parseISODate(date)))) {
      const at = zonedToUtc(date, open, tz);
      if (at.getTime() > now.getTime()) return at;
    }
  }
  return undefined;
}

export interface SlotQuery {
  now: Date;
  tz: string;
  hours: WeeklyHours;
  slotMinutes: number;
  minNoticeHours: number;
  /** Already-booked intervals. */
  busy: { start: Date; end: Date }[];
  /** Preferred clinic-local date (YYYY-MM-DD). */
  date?: string;
  partOfDay?: PartOfDay;
  /** Preferred clinic-local time HH:MM. */
  time?: string;
  relation?: 'at' | 'after' | 'before';
  /** Only times strictly after this instant (ISO), e.g. "later than the ones offered". */
  after?: string;
  limit?: number;
  horizonDays?: number;
}

const PART_RANGES: Record<PartOfDay, [number, number]> = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [16 * 60, 24 * 60],
};

/**
 * Open appointment start times matching the preference, spread out so the
 * visitor gets real choices (not three back-to-back slots).
 */
export function findSlots(q: SlotQuery): Date[] {
  const limit = q.limit ?? 3;
  const horizon = q.horizonDays ?? 21;
  const earliest = Math.max(q.now.getTime() + q.minNoticeHours * 3_600_000, q.after ? new Date(q.after).getTime() + 1 : 0);
  const today = utcToZoned(q.now, q.tz).date;
  const start = q.date && q.date > today ? q.date : today;
  const candidates: { at: Date; date: string; minutes: number }[] = [];

  for (let i = 0; i < horizon && candidates.length < 200; i++) {
    const date = toISODate(addDays(parseISODate(start), i));
    for (const [open, close] of hoursOn(q.hours, weekdayOf(parseISODate(date)))) {
      for (let m = toMinutes(open); m + q.slotMinutes <= toMinutes(close); m += q.slotMinutes) {
        if (q.partOfDay) {
          const [lo, hi] = PART_RANGES[q.partOfDay];
          if (m < lo || m >= hi) continue;
        }
        if (q.time && q.relation === 'after' && m < toMinutes(q.time)) continue;
        if (q.time && q.relation === 'before' && m + q.slotMinutes > toMinutes(q.time)) continue;
        const at = zonedToUtc(date, fromMinutes(m), q.tz);
        if (at.getTime() < earliest) continue;
        const end = at.getTime() + q.slotMinutes * 60_000;
        if (q.busy.some((b) => at.getTime() < b.end.getTime() && end > b.start.getTime())) continue;
        candidates.push({ at, date, minutes: m });
      }
    }
  }
  if (!candidates.length) return [];

  // An exact time request: closest matches on the requested (or first) day first.
  if (q.time && (q.relation === 'at' || !q.relation)) {
    const target = toMinutes(q.time);
    const firstDay = candidates[0].date;
    const sameDay = candidates.filter((c) => c.date === (q.date ?? firstDay));
    const pool = sameDay.length ? sameDay : candidates.filter((c) => c.date === firstDay);
    return pool
      .sort((a, b) => Math.abs(a.minutes - target) - Math.abs(b.minutes - target))
      .slice(0, limit)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((c) => c.at);
  }

  const picked: typeof candidates = [];
  for (const c of candidates) {
    if (picked.length >= limit) break;
    const prev = picked[picked.length - 1];
    if (!prev || c.date !== prev.date || c.minutes - prev.minutes >= 120) picked.push(c);
  }
  for (const c of candidates) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.sort((a, b) => a.at.getTime() - b.at.getTime()).map((c) => c.at);
}
