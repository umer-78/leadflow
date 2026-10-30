/**
 * Long messages that mix a story with several asks — "I've had pain on my left
 * side for a week… I'm nervous about dentists and I don't have insurance. How
 * much would it cost to get it checked and can you see me this week?" — are
 * turned into separate questions, so every part gets an answer: the symptom
 * first (safety rules see it), then the questions, then the reassurance.
 */
import { isQuestionLike, splitQuestions } from '../../packages/localbrain/src/index.ts';

const SYMPTOM =
  /\b(?:pain|painful|hurts?|hurting|ache|aching|throb\w*|sore|swollen|swelling|bleed\w*|broke|broken|chipped|cracked|loose|abscess|infect\w*|sensitive|puffy|pus)\b/i;
const ANXIOUS = /\b(?:scared|terrified|petrified|nervous|anxious|anxiety|afraid|fear|phobia|panic\w*|dread\w*)\b/i;
const UNINSURED = /\b(?:no|don'?t have(?: any)?|do not have(?: any)?|without(?: any)?)\s+(?:dental\s+)?insurance\b|\buninsured\b/i;
const CHILD = /\bmy (?:son|daughter|kid|child|children|boy|girl|toddler|little one)\b|\b(?:she|he)(?:'s| is) (?:\d+|pretty|really|very|so)\b/i;
const COST = /\b(?:how much|cost|costs|price|afford|expensive|fees?)\b/i;
/** "How much would it cost to get it checked?" is the price of an exam. */
const EXAM = /\b(?:checked|check(?:ed)? out|look(?:ed)? at|examin\w*|seen|exam|visit|appointment|consultation|assessed)\b/i;

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter((s) => /[a-z]/i.test(s));

/** A part that describes a problem (it goes first, so the safety rules see it). */
export const isSymptom = (part: string) => SYMPTOM.test(part) && !isQuestionLike(part);

/** The separate questions in a long message, or undefined when it is short or asks one thing. */
export function decompose(text: string): string[] | undefined {
  const words = text.trim().split(/\s+/).length;
  const sentences = sentencesOf(text);
  if (words < 25 || sentences.length < 2) return undefined;
  const asks = sentences.flatMap((s) => (isQuestionLike(s) ? splitQuestions(s, 4) : [])).filter(isQuestionLike);
  const story = sentences.filter((s) => !isQuestionLike(s));
  const parts: string[] = [];
  const symptom = story.filter((s) => SYMPTOM.test(s));
  if (symptom.length) parts.push(symptom.join(' '));
  const uninsured = UNINSURED.test(text);
  for (const ask of asks) {
    if (COST.test(ask) && EXAM.test(ask) && !/\b(?:implant|veneer|crown|whiten|brace|aligner|filling|root canal|extraction|denture|bridge)/i.test(ask)) {
      parts.push(uninsured ? 'How much does an exam cost without insurance?' : 'How much does an exam cost?');
    } else parts.push(ask);
  }
  if (uninsured && !asks.some((a) => COST.test(a))) parts.push("I don't have dental insurance");
  if (ANXIOUS.test(text) && !asks.some((a) => ANXIOUS.test(a))) {
    parts.push(CHILD.test(text) ? 'My child is nervous about the dentist.' : "I'm nervous about going to the dentist.");
  }
  const distinct = [...new Set(parts)];
  return distinct.length >= 2 ? distinct : undefined;
}
