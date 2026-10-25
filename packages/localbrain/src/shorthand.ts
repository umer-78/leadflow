/**
 * Chat-speak clean-up, applied before understanding: "wat r ur hrs" becomes
 * "what are your hours" and "sooo" becomes "so". Words that aren't rewritten
 * keep their case, so names stay capitalised; emails and links are untouched.
 */
import { STOPWORDS } from './text.ts';

/** Texting abbreviations -> plain English. Extend with `expandShorthand(text, extra)`. */
export const SHORTHAND: Readonly<Record<string, string>> = {
  u: 'you', ya: 'you', yu: 'you', r: 'are', ur: 'your', yr: 'your', urs: 'yours',
  pls: 'please', plz: 'please', plss: 'please', pleez: 'please',
  thx: 'thanks', thnx: 'thanks', thanx: 'thanks', tnx: 'thanks', ty: 'thank you', tysm: 'thank you so much',
  wat: 'what', wut: 'what', wht: 'what', wats: "what's", whats: "what's", wen: 'when', whn: 'when',
  wer: 'where', wher: 'where', hw: 'how',
  mch: 'much', abt: 'about', bout: 'about', thru: 'through', tho: 'though', b4: 'before',
  cuz: 'because', coz: 'because', cos: 'because', bc: 'because',
  tmrw: 'tomorrow', tmr: 'tomorrow', tmrow: 'tomorrow', tmmrw: 'tomorrow', tomoro: 'tomorrow', tomorow: 'tomorrow',
  tommorow: 'tomorrow', tommorrow: 'tomorrow', '2moro': 'tomorrow', '2morrow': 'tomorrow', '2mrw': 'tomorrow',
  '2day': 'today', tdy: 'today', tonite: 'tonight', '2nite': 'tonight', rn: 'right now',
  appt: 'appointment', appts: 'appointments', apt: 'appointment', apts: 'appointments', apmt: 'appointment',
  hrs: 'hours', hr: 'hour', mins: 'minutes', wk: 'week', wks: 'weeks', yrs: 'years',
  wanna: 'want to', gonna: 'going to', gotta: 'got to', kinda: 'kind of', lemme: 'let me', gimme: 'give me',
  idk: "I don't know", dunno: "don't know", k: 'ok', kk: 'ok', okk: 'ok', okey: 'okay', ofc: 'of course',
  cn: 'can', cud: 'could', shud: 'should', wud: 'would', dnt: "don't", dont: "don't", cant: "can't",
  doesnt: "doesn't", didnt: "didn't", isnt: "isn't", wont: "won't", im: "I'm", ive: "I've",
  ppl: 'people', msg: 'message', num: 'number', nbr: 'number', 'w/': 'with', 'w/o': 'without',
  gud: 'good', gr8: 'great', l8r: 'later', l8: 'late', luv: 'love', smth: 'something', sth: 'something',
  xray: 'x-ray', xrays: 'x-rays', btw: 'by the way', asap: 'as soon as possible', bf: 'boyfriend', gf: 'girlfriend', fyi: 'for your information',
};

/** Words an elongation ("sooo", "pleeease") most likely stands for. */
const COMMON = new Set(
  'so no yes yeah hi hey ok okay please thanks bad good great much really very now help sore pain hurt hurts ' +
    'omg wow lol cool nice sure soon well love need want what why ugh'.split(' ')
);

function known(word: string): boolean {
  return COMMON.has(word) || STOPWORDS.has(word);
}

/** "sooo" -> "so", "goooood" -> "good", "pleeease" -> "please". */
export function collapseElongation(word: string): string {
  if (!/([a-z])\1\1/i.test(word)) return word;
  const one = word.replace(/([a-z])\1{2,}/gi, '$1');
  const two = word.replace(/([a-z])\1{2,}/gi, '$1$1');
  const lower = (s: string) => s.toLowerCase();
  if (known(lower(one))) return one;
  if (known(lower(two))) return two;
  // A stretched last letter ("hurtsss") is decoration; inside a word keep a pair ("goood").
  return /([a-z])\1{2,}$/i.test(word) ? one : two;
}

const TOKEN = /(^|[\s,.;:!?()"[\]])([A-Za-z0-9/_']+?)(?=$|[\s,.;:!?()"[\]])/g;

/**
 * Expand texting shorthand and collapse elongated words. Capitalised words in
 * the middle of a sentence are left alone ("I'm Ty" keeps the name).
 */
export function expandShorthand(text: string, extra: Record<string, string> = {}): string {
  return text.replace(TOKEN, (match, before: string, word: string, offset: number) => {
    const lower = word.toLowerCase();
    const mapped = extra[lower] ?? SHORTHAND[lower];
    const prefix = text.slice(0, offset + before.length).trimEnd();
    const sentenceStart = prefix === '' || /[.!?]$/.test(prefix);
    if (mapped && (word === lower || word === word.toUpperCase() || sentenceStart)) {
      const out = sentenceStart && /^[A-Z]/.test(word) ? mapped[0].toUpperCase() + mapped.slice(1) : mapped;
      return before + out;
    }
    const collapsed = collapseElongation(word);
    return collapsed === word ? match : before + collapsed;
  });
}
