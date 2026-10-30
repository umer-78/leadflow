/**
 * Small, exact reasoning over the clinic's own numbers and the library's
 * facts: "how much for 3 veneers?", "my insurance pays 50%, what would a
 * crown cost me?", "if I start Invisalign now, when would I be done?",
 * "which lasts longer, a bridge or an implant?", "what's the cheapest way to
 * replace a missing tooth?". Pure functions; the receptionist supplies the
 * prices and sentences.
 */

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, both: 2, 'a couple of': 2, couple: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, eighteen: 18, twenty: 20, several: 3,
};

const toNumber = (s: string): number | undefined => {
  const t = s.toLowerCase().trim();
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  return WORD_NUMBERS[t];
};

const NUMBER = '(\\d{1,2}(?:\\.\\d)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty|several)';

/** Things that are priced per item ("per tooth", "per crown"), so a price can be multiplied. */
const ITEMS =
  '(teeth|tooth|veneers?|crowns?|implants?|fillings?|caps?|bridges?|extractions?|wisdom teeth|wisdom tooth|sealants?|inlays?|onlays?|root canals?|dentures?|arch(?:es)?)';

/** "3 veneers", "three crowns", "for 4 teeth", "a couple of fillings", "both wisdom teeth". */
export function quantityOf(text: string): { count: number; item: string } | undefined {
  const t = text.toLowerCase();
  const m = new RegExp(
    `\\b(\\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|both|a couple of)\\s+(?:of\\s+(?:my|the)\\s+)?(?:(?:upper|lower|front|back|top|bottom|new|porcelain|missing|more|dental|tooth-colou?red|white|ceramic|zirconia)\\s+){0,2}${ITEMS}\\b`
  ).exec(t);
  if (!m) return undefined;
  const count = toNumber(m[1]);
  if (!count || count < 2 || count > 32) return undefined;
  return { count, item: m[2] };
}

/** The noun a price unit counts ("per tooth (implant, abutment and crown)" -> "tooth"), when it can be multiplied. */
export function perItem(unit: string | null | undefined): string | undefined {
  const m = /^per (tooth|crown|filling|implant|veneer|bridge|denture|arch|sealant|inlay|onlay|extraction|guard)\b/i.exec(unit?.trim() ?? '');
  return m?.[1].toLowerCase();
}

const PLURAL: Record<string, string> = { tooth: 'teeth', arch: 'arches' };
export const plural = (noun: string, n: number) => (n === 1 ? noun : (PLURAL[noun] ?? `${noun}s`));

/** "My insurance covers 50%" -> 50. */
export function percentOf(text: string): number | undefined {
  const m = /\b(\d{1,3})\s?(?:%|percent)/i.exec(text);
  const pct = m ? Number(m[1]) : undefined;
  return pct !== undefined && pct > 0 && pct <= 100 ? pct : undefined;
}

export interface Span {
  min: number;
  max: number;
}

const UNIT_MONTHS: Record<string, number> = { day: 1 / 30, week: 12 / 52, month: 1, year: 12 };
const unitOf = (u: string) => u.toLowerCase().replace(/s$/, '');

/**
 * A length of time in a sentence, in months: "6 to 18 months", "18 months to 2 years",
 * "1 to 3 years", "about two weeks". Intervals ("every 4 to 8 weeks") are not lengths.
 */
export function monthsIn(sentence: string): Span | undefined {
  const s = sentence.toLowerCase().replace(/[–—]/g, '-');
  const patterns: [RegExp, (m: RegExpExecArray) => Span | undefined][] = [
    [
      new RegExp(`\\b${NUMBER}\\s*(day|week|month|year)s?\\s*(?:to|-|or)\\s*${NUMBER}\\s*(day|week|month|year)s?\\b`, 'g'),
      (m) => {
        const a = toNumber(m[1]);
        const b = toNumber(m[3]);
        return a !== undefined && b !== undefined ? { min: a * UNIT_MONTHS[unitOf(m[2])], max: b * UNIT_MONTHS[unitOf(m[4])] } : undefined;
      },
    ],
    [
      new RegExp(`\\b${NUMBER}\\s*(?:to|-|or)\\s*${NUMBER}\\s*(day|week|month|year)s?\\b`, 'g'),
      (m) => {
        const a = toNumber(m[1]);
        const b = toNumber(m[2]);
        const u = UNIT_MONTHS[unitOf(m[3])];
        return a !== undefined && b !== undefined ? { min: a * u, max: b * u } : undefined;
      },
    ],
    [
      new RegExp(`\\b${NUMBER}\\s*(day|week|month|year)s?\\b`, 'g'),
      (m) => {
        const a = toNumber(m[1]);
        return a !== undefined ? { min: a * UNIT_MONTHS[unitOf(m[2])], max: a * UNIT_MONTHS[unitOf(m[2])] } : undefined;
      },
    ],
  ];
  // Blank out intervals first, so "every 4 to 8 weeks" can't be read again as "8 weeks".
  let text = s;
  for (const [re] of patterns) {
    text = text.replace(re, (match, ...rest) => {
      const at = rest.find((x) => typeof x === 'number') as number;
      const before = text.slice(Math.max(0, at - 12), at);
      return /\bevery\s*$|\bper\s*$|\bafter\s*$|\bwithin\s*$/.test(before) ? ' '.repeat(match.length) : match;
    });
  }
  for (const [re, read] of patterns) {
    for (const m of text.matchAll(re)) {
      const span = read(m as RegExpExecArray);
      if (span) return span;
    }
  }
  return undefined;
}

/** "5 to 15 years", "decades", "a lifetime", "6 to 18 months": a span the way people say it. */
export function describeSpan(span: Span, unit: 'years' | 'months'): string {
  if (unit === 'years') {
    if (span.min >= 25) return 'a lifetime';
    if (span.min >= 20) return 'decades';
    return span.min === span.max ? `${span.min} years` : `${span.min} to ${span.max} years`;
  }
  const yearsBoth = span.min >= 12 && span.min % 12 === 0 && span.max % 12 === 0;
  if (yearsBoth) return span.min === span.max ? `${span.min / 12} year${span.min === 12 ? '' : 's'}` : `${span.min / 12} to ${span.max / 12} years`;
  const r = (m: number) => Math.round(m);
  if (span.max < 1) return span.min === span.max ? `${r(span.min * 4.345)} weeks` : `${r(span.min * 4.345)} to ${r(span.max * 4.345)} weeks`;
  return span.min === span.max ? `${r(span.min)} months` : `${r(span.min)} to ${r(span.max)} months`;
}

/** How long something lasts, in years: "10 to 15 years", "15 years or more", "decades", "a lifetime". */
export function yearsIn(sentence: string): Span | undefined {
  const s = sentence.toLowerCase().replace(/[–—]/g, '-');
  const range = new RegExp(`\\b${NUMBER}\\s*(?:to|-)\\s*${NUMBER}\\s*years?\\b`).exec(s);
  if (range) {
    const a = toNumber(range[1]);
    const b = toNumber(range[2]);
    if (a !== undefined && b !== undefined) return { min: a, max: b };
  }
  const more = new RegExp(`\\b${NUMBER}\\s*years?\\s*or (?:more|longer)\\b`).exec(s);
  if (more) {
    const a = toNumber(more[1]);
    if (a !== undefined) return { min: a, max: a + 10 };
  }
  if (/\blifetime\b|\bfor life\b/.test(s)) return { min: 25, max: 50 };
  if (/\bdecades\b/.test(s)) return { min: 20, max: 40 };
  const several = /\bseveral years\b/.test(s);
  if (several) return { min: 3, max: 8 };
  return undefined;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "by June", "before next March", "in time for December 2027": the end of that month (YYYY-MM-DD), next time it comes round. */
export function monthTarget(text: string, now: Date): string | undefined {
  const m =
    /\b(?:by|before|in time for|until)\b[^.?!]{0,30}?\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(20\d\d))?/i.exec(text) ??
    // "I'm getting married next June, can I get braces done by then?"
    (/\b(?:by then|before then|in time|by that time|by the (?:wedding|big day|event))\b/i.test(text)
      ? /\b(?:next|this|in|on|for)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(20\d\d))?/i.exec(text)
      : null);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  let year = m[2] ? Number(m[2]) : now.getUTCFullYear();
  if (!m[2] && month <= now.getUTCMonth()) year++;
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.toISOString().slice(0, 10);
}

/** "between April 2027 and April 2028" for a span of months from now, in the clinic's time zone. */
export function finishWindow(now: Date, months: Span, timeZone: string): { from: string; to: string } {
  const label = (m: number) => {
    const d = new Date(now.getTime());
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + Math.round(m));
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone });
  };
  return { from: label(months.min), to: label(months.max) };
}

export type Attribute = 'cost' | 'longevity' | 'duration';

/** "Which lasts longer…", "is it faster…", "is it cheaper…": the attribute a comparison is about. */
export function comparedAttribute(text: string): { attribute: Attribute; wantHigh: boolean } | undefined {
  const t = text.toLowerCase();
  if (/\blasts? longer\b|\blonger[- ]lasting\b|\bmore durable\b|\blasts? the longest\b|\bmost durable\b|\bholds? up better\b|\boutlast\w*\b|\blongest[- ]lasting\b/.test(t)) {
    return { attribute: 'longevity', wantHigh: true };
  }
  if (/\b(?:faster|quicker|takes? less time|shorter|quickest|fastest|sooner|less time)\b/.test(t)) return { attribute: 'duration', wantHigh: false };
  if (/\b(?:cheaper|less expensive|more affordable|cheapest|most affordable|least expensive|costs? less|lower[- ]cost|best value|budget)\b/.test(t)) {
    return { attribute: 'cost', wantHigh: false };
  }
  if (/\b(?:more expensive|costs? more|pricier|most expensive)\b/.test(t)) return { attribute: 'cost', wantHigh: true };
  return undefined;
}

/** "the cheapest", "the fastest", "the longest-lasting": asking for the best of several options. */
export const SUPERLATIVE = /\b(?:cheapest|most affordable|least expensive|lowest[- ]cost|fastest|quickest|longest[- ]lasting|most durable|lasts? the longest|best value)\b/i;

/** Goals patients describe, and the treatments that achieve them. */
export const GOALS: { re: RegExp; goal: string; services: string[] }[] = [
  { re: /\breplac\w*\s+(?:a\s+|my\s+|the\s+|missing\s+|lost\s+)*(?:tooth|teeth)\b|\bmissing (?:tooth|teeth)\b|\bgap where (?:a|my) tooth\b|\blost (?:a|my) tooth\b/i, goal: 'replace a missing tooth', services: ['Dentures', 'Bridges', 'Dental implants'] },
  { re: /\bstraighten\w*|\bcrooked\b|\bstraight(?:er)? teeth\b|\bcrowded teeth\b/i, goal: 'straighten teeth', services: ['Clear aligners', 'Braces'] },
  { re: /\b(?:close|fix|get rid of)\s+(?:a\s+|the\s+|my\s+)?gaps?\b|\bgap between\b/i, goal: 'close a gap', services: ['Cosmetic bonding', 'Porcelain veneers', 'Clear aligners'] },
  { re: /\bwhit(?:er|en\w*)\b|\byellow teeth\b|\bstained teeth\b/i, goal: 'brighten your smile', services: ['Teeth whitening', 'Cosmetic bonding', 'Porcelain veneers'] },
  { re: /\b(?:fix|repair)\s+(?:a\s+|my\s+|the\s+)?(?:chipped|broken|cracked)\b|\bchipped (?:front )?tooth\b/i, goal: 'fix a chipped tooth', services: ['Cosmetic bonding', 'Porcelain veneers', 'Crowns'] },
];

/** "When would I be done?", "will I be finished by June?", "how long until I have straight teeth?". */
export const WHEN_DONE =
  /\bwhen (?:would|will|could|can|do|should) (?:i|we|my \w+|they) (?:be )?(?:done|finished|finish|complete|completed|have (?:straight|my new) teeth|get my (?:teeth|smile))\b|\b(?:will|would|could|can) (?:i|we|my \w+|they) be (?:done|finished|ready)\b|\bhow long (?:until|till|before) (?:i|it|they|we)(?:'m| am| is| are| will be| would be| have)? ?(?:done|finished|straight|complete)\b|\b(?:done|finished|ready) (?:by|before|in time for)\b|\bin time for\b|\b(?:can|could|will|would) (?:i|we|my \w+|they) (?:get|have)\b[^.?!]{0,40}\b(?:done|finished|straight(?:ened)?|fixed)\b[^.?!]{0,30}\b(?:by|before)\b/i;
