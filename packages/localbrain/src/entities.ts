/**
 * Entity extraction: emails, phone numbers, person names, dates, times, and
 * custom dictionary values (e.g. product or service names, typo tolerant).
 */
import { Vocabulary } from './fuzzy.ts';
import { normalize, stem, titleCase, tokenize } from './text.ts';

// ---------------------------------------------------------------------------
// Email / phone
// ---------------------------------------------------------------------------

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

export function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
}

const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d[\d\s.-]{5,}\d/g;

/** Phone numbers with 7-15 digits, normalised to digits (leading + kept). */
export function extractPhones(text: string): string[] {
  const out: string[] = [];
  const withoutEmails = text.replace(EMAIL_RE, ' ');
  for (const m of withoutEmails.matchAll(PHONE_RE)) {
    const raw = m[0].trim();
    const start = m.index ?? 0;
    const before = withoutEmails[start - 1] ?? '';
    const after = withoutEmails[start + m[0].length] ?? '';
    if (before === '/' || after === '/' || before === '$' || before === ':' || after === ':') continue;
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) continue;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) continue;
    const value = (raw.startsWith('+') ? '+' : '') + digits;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * Text with contact details and the person's name removed — useful before a
 * knowledge search, where "I'm Maria, maria@x.com" adds nothing but noise.
 */
export function stripPersonalDetails(text: string, name?: string): string {
  let out = text.replace(EMAIL_RE, ' ').replace(PHONE_RE, ' ');
  for (const part of name?.split(/\s+/) ?? []) {
    if (part.length > 1) out = out.replace(new RegExp(`\\b${part.replace(/[^a-z'-]/gi, '')}\\b`, 'gi'), ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Pretty-print a normalised phone number (NANP numbers as (555) 123-4567). */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return phone;
}

// ---------------------------------------------------------------------------
// Person names
// ---------------------------------------------------------------------------

/** Words that follow "I'm" / "this is" but are not names. */
const NOT_NAME = new Set(
  (
    'a an the and or but so just very really also still only not no yes yeah yep nope ok okay sure fine good great well ' +
    'interested looking wondering calling writing trying having hoping planning thinking considering going getting ' +
    'feeling experiencing suffering asking inquiring enquiring reaching contacting emailing texting needing wanting ' +
    'scared worried nervous anxious afraid terrified available free busy ready able unable sorry glad happy sad curious ' +
    'pregnant new here there back over under about after from with at on in for to of by as into ' +
    'urgent painful swollen bleeding broken chipped cracked missing loose sensitive hurting sore done finished late early ' +
    'open closed booked booking need want would will can could should may might must have has had do does did is are was ' +
    'your my our his her their its it that this what who how why when where which hi hello hey thanks thank please ' +
    'patient client customer mom dad mother father parent wife husband son daughter friend dentist doctor dr nurse ' +
    'appointment tooth teeth pain today tomorrow tonight morning afternoon evening week weekend ' +
    'monday tuesday wednesday thursday friday saturday sunday ' +
    'phone number email mobile cell call text contact name first last full my i im me ' +
    'cost price implant implants veneers veneer invisalign braces whitening cleaning checkup crown crowns filling ' +
    'emergency help info information question questions same not sure unsure confused ' +
    'been again anyway everyone everybody guys bye goodbye lot much alot you u ya rather prefer ' +
    "i'd i'll i've id ill ive gonna wanna kinda sort kind bit little quite pretty too totally definitely " +
    'probably maybe perhaps actually literally currently already almost always never sometimes usually recently finally'
  ).split(' ')
);

const NAME_WORD = /^[a-z][a-z'-]{0,24}$/i;
const TRAILING_OK = new Set(['here', 'thanks', 'thank', 'please', 'speaking', 'thx', 'ty']);

function pickName(words: string[], strict: boolean): { name: string; count: number } | undefined {
  const picked: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[.,!?;:]+$/, '');
    const lower = clean.toLowerCase();
    if (!NAME_WORD.test(clean) || NOT_NAME.has(lower)) break;
    if (strict && lower.length > 4 && /(?:ing|ed)$/.test(lower)) break;
    picked.push(clean);
    if (/[.,!?;:]$/.test(w) || picked.length === 3) break;
  }
  if (!picked.length || (picked.length === 1 && picked[0].length < 2)) return undefined;
  return { name: titleCase(picked.join(' ')), count: picked.length };
}

/** Cues that are almost always followed by a name. */
const STRONG_NAME_CUES: RegExp[] = [/\bmy name(?:'s| is)\s+(.+)/i, /\bname(?:'s| is)\s*[:-]?\s*(.+)/i, /\bcall me\s+(.+)/i];
/** Cues that are often followed by something else ("I'm worried", "this is urgent"). */
const WEAK_NAME_CUES: RegExp[] = [/\b(?:i am|i'm|im|this is|it's|its|it is)\s+(.+)/i, /\b(?:regards|cheers),?\s+(.+)$/i];

const splitWords = (s: string) => s.split(/[\s,]+/).filter(Boolean);

/**
 * A person's name from cues like "my name is Jane Doe" / "I'm Sam". With
 * `expectingName` (the assistant just asked for a name) a bare reply such as
 * "Jane Doe" or "jane" is accepted too.
 */
export function extractName(text: string, options: { expectingName?: boolean } = {}): string | undefined {
  const cleaned = text.replace(EMAIL_RE, ' ').replace(PHONE_RE, ' ').replace(/\s+/g, ' ').trim();

  for (const cue of STRONG_NAME_CUES) {
    const m = cue.exec(cleaned);
    const p = m && pickName(splitWords(m[1]), false);
    if (p) return p.name;
  }

  const allLower = !/[A-Z]/.test(cleaned);
  for (const cue of WEAK_NAME_CUES) {
    const m = cue.exec(cleaned);
    if (!m) continue;
    const words = splitWords(m[1]);
    const p = pickName(words, true);
    if (!p) continue;
    const rest = words.slice(p.count).join(' ').toLowerCase();
    const endsClause =
      !rest || /^(and|here|from|calling|again|speaking)\b/.test(rest) || /[.,!?;:]$/.test(words[p.count - 1]);
    // "I'm Sam" (capitalised) or "im sam" typed all lower-case at the end of a clause.
    if (/^[A-Z]/.test(words[0]) || (allLower && endsClause) || options.expectingName) return p.name;
  }

  if (options.expectingName && !cleaned.includes('?')) {
    const parts = splitWords(cleaned.replace(/^(?:sure|ok|okay|yes|yeah|hi|hello|hey|of course)[,.!\s]+/i, ''));
    if (parts.length >= 1 && parts.length <= 4) {
      const p = pickName(parts, false);
      const rest = parts.slice(p?.count ?? 0).map((w) => w.toLowerCase().replace(/[.,!?]+$/, ''));
      if (p && rest.every((w) => TRAILING_OK.has(w))) return p.name;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Dates (calendar arithmetic is done on plain Y-M-D values, never local time)
// ---------------------------------------------------------------------------

export interface CalendarDate {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export function toISODate(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

export function parseISODate(s: string): CalendarDate {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}

export function addDays(d: CalendarDate, n: number): CalendarDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(d: CalendarDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Today's calendar date in an IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  couple: 2, few: 3,
};

export interface DateMatch {
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** The words that produced it. */
  text: string;
}

export interface DateOptions {
  /** Interpret 03/04 as 3 April instead of March 4 (default false, US order). */
  dayFirst?: boolean;
}

/** First date mentioned in `text`, resolved relative to `today`. */
export function extractDate(text: string, today: CalendarDate, options: DateOptions = {}): DateMatch | undefined {
  const t = normalize(text);
  const rollForward = (y: number | undefined, m: number, d: number): CalendarDate | undefined => {
    let year = y ?? today.year;
    if (y !== undefined && y < 100) year = 2000 + y;
    if (!isValidDate(year, m, d)) return undefined;
    let date = { year, month: m, day: d };
    if (y === undefined && compareDates(date, today) < 0 && isValidDate(year + 1, m, d)) {
      date = { year: year + 1, month: m, day: d };
    }
    return date;
  };
  const found = (d: CalendarDate | undefined, src: string): DateMatch | undefined =>
    d ? { date: toISODate(d), text: src } : undefined;

  let m: RegExpExecArray | null;
  if ((m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(t))) {
    const r = found(rollForward(Number(m[1]), Number(m[2]), Number(m[3])), m[0]);
    if (r) return r;
  }
  if ((m = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`).exec(t))) {
    const month = MONTHS.indexOf(m[1].slice(0, 3)) + 1;
    const r = found(rollForward(m[3] ? Number(m[3]) : undefined, month, Number(m[2])), m[0]);
    if (r) return r;
  }
  if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s*(\\d{4}))?`).exec(t))) {
    const month = MONTHS.indexOf(m[2].slice(0, 3)) + 1;
    const r = found(rollForward(m[3] ? Number(m[3]) : undefined, month, Number(m[1])), m[0]);
    if (r) return r;
  }
  if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [month, day] = options.dayFirst ? [b, a] : [a, b];
    const r = found(rollForward(m[3] ? Number(m[3]) : undefined, month, day), m[0]);
    if (r) return r;
  }
  if ((m = /\b(?:the\s+)?day after (?:tomorrow|tmrw|tmr)\b/.exec(t))) return found(addDays(today, 2), m[0]);
  if ((m = /\b(today|tonight|this (?:morning|afternoon|evening))\b/.exec(t))) return found(today, m[0]);
  if ((m = /\b(tomorrow|tmrw|tmr|tomorow|tommorow|tommorrow)\b/.exec(t))) return found(addDays(today, 1), m[0]);
  if ((m = /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|a couple of|a few)\s+(days?|weeks?)\b/.exec(t))) {
    const key = m[1].replace(/^a\s+/, '').replace(/\s+of$/, '');
    const n = /^\d+$/.test(key) ? Number(key) : NUMBER_WORDS[key] ?? 1;
    return found(addDays(today, m[2].startsWith('week') ? n * 7 : n), m[0]);
  }
  if ((m = /\b(?:(this|next|coming|on)\s+)?(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?\b/.exec(t))) {
    const target = WEEKDAYS[m[2]];
    const todayWd = weekdayOf(today);
    let delta = (target - todayWd + 7) % 7;
    if (delta === 0 && m[1] !== 'this') delta = 7;
    if (m[1] === 'next' && delta < 2) delta += 7;
    return found(addDays(today, delta), m[0]);
  }
  if ((m = /\bnext week\b/.exec(t))) {
    const wd = weekdayOf(today);
    return found(addDays(today, ((8 - wd) % 7) || 7), m[0]);
  }
  if ((m = /\b(?:this |the )?weekend\b/.exec(t))) {
    const wd = weekdayOf(today);
    return found(addDays(today, (6 - wd + 7) % 7), m[0]);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

export interface TimeMatch {
  /** 24h HH:MM when a clock time was given. */
  time?: string;
  partOfDay?: PartOfDay;
  /** "after 4", "before noon" */
  relation?: 'at' | 'after' | 'before';
  text: string;
}

const hhmm = (h: number, min: number) => `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

export function extractTime(text: string): TimeMatch | undefined {
  const t = normalize(text).replace(/\b([ap])\.m\.?/g, '$1m');
  const relOf = (s: string | undefined): TimeMatch['relation'] =>
    s === 'after' ? 'after' : s === 'before' || s === 'by' ? 'before' : 'at';
  let m: RegExpExecArray | null;

  if ((m = /\b(?:(at|after|before|by|around|about)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(t))) {
    let h = Number(m[2]);
    const min = Number(m[3] ?? 0);
    if (h >= 1 && h <= 12 && min < 60) {
      if (m[4] === 'pm' && h !== 12) h += 12;
      if (m[4] === 'am' && h === 12) h = 0;
      return { time: hhmm(h, min), relation: relOf(m[1]), text: m[0] };
    }
  }
  if ((m = /\b(?:(at|after|before|by|around|about)\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(t))) {
    let h = Number(m[2]);
    if (h >= 1 && h <= 6) h += 12; // "at 3:30" in clinic context means afternoon
    return { time: hhmm(h, Number(m[3])), relation: relOf(m[1]), text: m[0] };
  }
  if ((m = /\b(?:(at|after|before|by|around|about)\s+)?(noon|midday|lunch ?time|lunch)\b/.exec(t))) {
    return { time: '12:00', relation: relOf(m[1]), text: m[0] };
  }
  if ((m = /\b(at|after|before|by|around|about)\s+(\d{1,2})(?:\s*o'?clock)?\b(?!\s*(?:\/|-|st|nd|rd|th|days?|weeks?|months?|years?|teeth|tooth|\d))/.exec(t))) {
    let h = Number(m[2]);
    if (h >= 1 && h <= 12) {
      if (h <= 6) h += 12;
      return { time: hhmm(h, 0), relation: relOf(m[1]), text: m[0] };
    }
  }
  if ((m = /\b(mornings?|early)\b/.exec(t))) return { partOfDay: 'morning', text: m[0] };
  if ((m = /\b(afternoons?)\b/.exec(t))) return { partOfDay: 'afternoon', text: m[0] };
  if ((m = /\b(evenings?|after work|after school|late)\b/.exec(t))) return { partOfDay: 'evening', text: m[0] };
  return undefined;
}

// ---------------------------------------------------------------------------
// Dictionary entities (typo-tolerant, multi-word)
// ---------------------------------------------------------------------------

export interface DictionaryEntry {
  /** Canonical value returned on a match. */
  value: string;
  /** Phrases that refer to this value (the value itself is included automatically). */
  synonyms?: string[];
}

export interface DictionaryMatch {
  value: string;
  /** Position (token index) of the match. */
  index: number;
}

export class EntityDictionary {
  private readonly phrases: { value: string; stems: string[] }[] = [];
  private readonly vocab = new Vocabulary();

  constructor(entries: DictionaryEntry[] = []) {
    for (const e of entries) this.add(e);
  }

  add(entry: DictionaryEntry): void {
    for (const p of [entry.value, ...(entry.synonyms ?? [])]) {
      const tokens = tokenize(p);
      if (!tokens.length) continue;
      this.vocab.addAll(tokens);
      this.phrases.push({ value: entry.value, stems: tokens.map(stem) });
    }
    // Longest phrases first so "dental implant" beats "implant".
    this.phrases.sort((a, b) => b.stems.length - a.stems.length);
  }

  /** All distinct values mentioned in `text`, in order of appearance. */
  find(text: string): DictionaryMatch[] {
    const stems = tokenize(text).map((t) => stem(this.vocab.correct(t)));
    const used = new Array(stems.length).fill(false);
    const out: DictionaryMatch[] = [];
    for (const p of this.phrases) {
      for (let i = 0; i + p.stems.length <= stems.length; i++) {
        let ok = true;
        for (let j = 0; j < p.stems.length; j++) {
          if (used[i + j] || stems[i + j] !== p.stems[j]) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (let j = 0; j < p.stems.length; j++) used[i + j] = true;
        if (!out.some((o) => o.value === p.value)) out.push({ value: p.value, index: i });
      }
    }
    return out.sort((a, b) => a.index - b.index);
  }
}
