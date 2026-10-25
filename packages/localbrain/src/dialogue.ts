/**
 * Conversation helpers: split a message into separate questions, resolve
 * elliptical follow-ups ("what about veneers?") and spot bare numbers.
 */

const QUESTION_WORDS =
  "(?:do|does|did|can|could|will|would|is|are|am|was|were|what|what's|whats|when|where|how|why|which|who|whom|should|shall|may|might|have|has|any|anything)";
const REQUEST_WORDS = "(?:i(?:'d| would) like|i want|i need|i'm looking|im looking|book|schedule|please|tell me|give me|show me)";
const LEAD_FILLER = /^(?:(?:and|also|plus|so|oh|ok|okay|then|btw|by the way|and also|one more thing)[,:]?\s+)+/i;
const QUESTION_START = new RegExp(`^${QUESTION_WORDS}\\b`, 'i');
const REQUEST_START = new RegExp(`^${REQUEST_WORDS}\\b`, 'i');

/** Does this read as a question or a request (rather than a statement like "I'm Maria")? */
export function isQuestionLike(text: string): boolean {
  const t = text.trim().replace(LEAD_FILLER, '');
  return /\?\s*$/.test(t) || QUESTION_START.test(t) || REQUEST_START.test(t);
}

/**
 * "How much are veneers and do you offer payment plans?" -> two questions.
 * Splits at sentence ends and at "and/also/plus" before a new question, but
 * only when every piece is itself a question or request; otherwise the
 * message is returned whole ("I'm Maria. How much are veneers?").
 */
export function splitQuestions(text: string, max = 3): string[] {
  const whole = text.trim();
  const joiner = new RegExp(`(?:,\\s*|\\s+)(?:and|also|plus|&)\\s+(?=${QUESTION_WORDS}\\b)`, 'i');
  const pieces = whole
    .split(/(?<=[?!.])\s+(?=\S)/)
    .flatMap((s) => s.split(joiner))
    .map((p) => p.replace(LEAD_FILLER, '').trim())
    .filter((p) => /[a-z]/i.test(p));
  if (pieces.length < 2 || !pieces.every(isQuestionLike)) return [whole];
  if (pieces.length <= max) return pieces;
  return [...pieces.slice(0, max - 1), pieces.slice(max - 1).join(' ')];
}

const FOLLOW_UP: RegExp[] = [
  /^(?:(?:and|ok|okay|so|hmm|then)\s+)?(?:what|how)\s+(?:about|bout)\s+(.+)$/i,
  /^(?:what of|and for|and with|and on|and the|and)\s+(.+)$/i,
  /^(?:also|same|is that the same|is it the same|what|and what)\s+for\s+(.+)$/i,
  /^(.+?)\s+(?:too|as well)$/i,
];

/**
 * The new subject of an elliptical follow-up — "what about veneers?",
 * "and for kids?", "how about Saturday", "veneers too?" — or undefined when
 * the message is a full question of its own.
 */
export function followUpSubject(text: string): string | undefined {
  const t = text.trim().replace(/[?.!]+$/, '').trim();
  for (const re of FOLLOW_UP) {
    const m = re.exec(t);
    if (!m) continue;
    const subject = m[1].replace(/^(?:the|a|an|for|with|on)\s+/i, '').trim();
    if (!subject || subject.split(/\s+/).length > 5) return undefined;
    if (QUESTION_START.test(subject) || REQUEST_START.test(subject)) return undefined;
    return subject;
  }
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5, '6th': 6,
};

/** A message that is only a choice number: "2", "#2", "option two", "the first one". */
export function bareNumber(text: string): number | undefined {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[.!?)]+$/, '')
    .replace(/^(?:ok(?:ay)?,?\s+)?(?:the\s+)?/, '')
    .replace(/^(?:#|no\.?\s*|number\s+|option\s+|choice\s+)/, '')
    .replace(/\s+(?:one|option|please|pls|thanks)$/, '')
    .trim();
  if (/^\d{1,2}$/.test(t)) return Number(t);
  return NUMBER_WORDS[t];
}
