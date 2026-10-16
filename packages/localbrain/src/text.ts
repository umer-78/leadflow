/**
 * Text normalisation, tokenisation, stop words and stemming.
 * Pure functions, no dependencies, safe in Node and the browser.
 */

/** Lower-case, strip accents, unify quotes/dashes and collapse whitespace. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split normalised text into word tokens. Apostrophes are dropped ("don't" -> "dont"). */
export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/'/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    'a about above after again against all am an and any are as at be because been before being below ' +
    'between both but by can could did do does doing down during each few for from further had has have ' +
    'having he her here hers herself him himself his how i if in into is it its itself just me more most my ' +
    'myself no nor not now of off on once only or other our ours ourselves out over own same she should so ' +
    'some such than that the their theirs them themselves then there these they this those through to too ' +
    'under until up very was we were what when where which while who whom why will with would you your ' +
    'yours yourself yourselves im ive id youre dont doesnt didnt cant wont isnt arent wasnt also get got ' +
    'please hi hello hey thanks thank want wanted like would know tell let us interested wondering looking info ' +
    'information question questions asking considering thinking curious u ur r ya pls plz thx'
  ).split(' ')
);

// ---------------------------------------------------------------------------
// Porter stemmer (M.F. Porter, 1980). Maps inflected forms to a common stem:
// "implants" -> "implant", "whitening" -> "whiten", "aligners" -> "align".
// ---------------------------------------------------------------------------

const step2list: Record<string, string> = {
  ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize', bli: 'ble',
  alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize', ation: 'ate',
  ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous', aliti: 'al',
  iviti: 'ive', biliti: 'ble', logi: 'log',
};
const step3list: Record<string, string> = {
  icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '',
};
const c = '[^aeiou]';
const v = '[aeiouy]';
const C = c + '[^aeiouy]*';
const V = v + '[aeiou]*';
const mgr0 = new RegExp('^(' + C + ')?' + V + C);
const meq1 = new RegExp('^(' + C + ')?' + V + C + '(' + V + ')?$');
const mgr1 = new RegExp('^(' + C + ')?' + V + C + V + C);
const sV = new RegExp('^(' + C + ')?' + v);
const cvc = new RegExp('^' + C + v + '[^aeiouwxy]$');

const stemCache = new Map<string, string>();

export function stem(word: string): string {
  if (word.length < 3 || /\d/.test(word)) return word;
  const cached = stemCache.get(word);
  if (cached !== undefined) return cached;

  let w = word;
  const firstY = w[0] === 'y';
  if (firstY) w = 'Y' + w.slice(1);
  let m: RegExpExecArray | null;

  // Step 1a
  if ((m = /^(.+?)(ss|i)es$/.exec(w))) w = m[1] + m[2];
  else if ((m = /^(.+?)([^s])s$/.exec(w))) w = m[1] + m[2];

  // Step 1b
  if ((m = /^(.+?)eed$/.exec(w))) {
    if (mgr0.test(m[1])) w = w.slice(0, -1);
  } else if ((m = /^(.+?)(ed|ing)$/.exec(w))) {
    const s = m[1];
    if (sV.test(s)) {
      w = s;
      if (/(at|bl|iz)$/.test(w)) w += 'e';
      else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1);
      else if (cvc.test(w)) w += 'e';
    }
  }

  // Step 1c
  if ((m = /^(.+?)y$/.exec(w)) && sV.test(m[1])) w = m[1] + 'i';

  // Step 2
  if (
    (m = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/.exec(w)) &&
    mgr0.test(m[1])
  ) {
    w = m[1] + step2list[m[2]];
  }

  // Step 3
  if ((m = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/.exec(w)) && mgr0.test(m[1])) {
    w = m[1] + step3list[m[2]];
  }

  // Step 4
  if ((m = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/.exec(w))) {
    if (mgr1.test(m[1])) w = m[1];
  } else if ((m = /^(.+?)(s|t)(ion)$/.exec(w))) {
    const s = m[1] + m[2];
    if (mgr1.test(s)) w = s;
  }

  // Step 5
  if ((m = /^(.+?)e$/.exec(w))) {
    const s = m[1];
    if (mgr1.test(s) || (meq1.test(s) && !cvc.test(s))) w = s;
  }
  if (/ll$/.test(w) && mgr1.test(w)) w = w.slice(0, -1);

  if (firstY) w = 'y' + w.slice(1);
  if (stemCache.size > 50_000) stemCache.clear();
  stemCache.set(word, w);
  return w;
}

export interface TermOptions {
  /** Drop common function words (default true). */
  removeStopwords?: boolean;
  /** Apply the Porter stemmer (default true). */
  stem?: boolean;
}

/** Tokens -> search terms (stop words removed, stemmed). */
export function terms(text: string, options: TermOptions = {}): string[] {
  const { removeStopwords = true, stem: doStem = true } = options;
  const out: string[] = [];
  for (const t of tokenize(text)) {
    if (removeStopwords && STOPWORDS.has(t)) continue;
    out.push(doStem ? stem(t) : t);
  }
  return out;
}

/** Split prose into sentences (also treats list items / line breaks as boundaries). */
export function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/))
    .map((s) => s.replace(/^[-*•\d.)\s]+(?=[A-Za-z])/, '').trim())
    .filter((s) => s.length > 1);
}

/** Title-case a person's name ("mary-jane o'neil" -> "Mary-Jane O'Neil"). */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Stable 32-bit FNV-1a hash, used for deterministic choices. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
