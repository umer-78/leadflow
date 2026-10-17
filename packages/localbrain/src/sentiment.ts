/**
 * Lexicon-based sentiment and urgency scoring with negation handling.
 */
import { tokenize } from './text.ts';

const LEXICON: Record<string, number> = {
  // positive
  great: 2, good: 1.5, nice: 1.5, love: 2.5, loved: 2.5, happy: 2, glad: 2, excellent: 3, perfect: 3,
  awesome: 3, amazing: 3, wonderful: 3, fantastic: 3, helpful: 2, thanks: 1.5, thank: 1.5, appreciate: 2,
  appreciated: 2, pleased: 2, excited: 2, best: 2, brilliant: 3, cool: 1, fine: 0.5, sure: 0.5, easy: 1,
  comfortable: 1.5, confident: 1.5, recommend: 2, beautiful: 2, friendly: 2, kind: 1.5, quick: 1, fast: 1,
  // negative
  bad: -2, terrible: -3, awful: -3, horrible: -3, worst: -3, hate: -3, angry: -3, upset: -2, annoyed: -2,
  frustrated: -2.5, frustrating: -2.5, disappointed: -2.5, unhappy: -2, sad: -2, worried: -2, worry: -1.5,
  scared: -2, afraid: -2, anxious: -2, anxiety: -2, nervous: -1.5, terrified: -3, embarrassed: -2,
  ashamed: -2, pain: -2, painful: -2.5, hurt: -2, hurts: -2, hurting: -2, ache: -1.5, aching: -2, sore: -1.5,
  broken: -2, cracked: -1.5, bleeding: -2, swollen: -2, swelling: -2, unbearable: -3, excruciating: -3,
  expensive: -1.5, rude: -3, slow: -1, waiting: -1, waited: -1.5, ignored: -2.5, wrong: -1.5, problem: -1.5,
  issue: -1, sick: -2, ugly: -2, yellow: -0.5, stained: -1, crooked: -1, missing: -1, unacceptable: -3,
  ridiculous: -2.5, scam: -3, never: -0.5,
};

const NEGATORS = new Set(['not', 'no', 'never', 'dont', 'doesnt', 'didnt', 'isnt', 'wasnt', 'cant', 'cannot', 'wont', 'aint', 'without', 'hardly']);
const INTENSIFIERS: Record<string, number> = { very: 1.5, really: 1.4, so: 1.3, extremely: 1.8, super: 1.5, incredibly: 1.7, too: 1.2, totally: 1.4, absolutely: 1.6 };

export interface Sentiment {
  /** -1 (very negative) .. 1 (very positive) */
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  /** Lexicon words that contributed. */
  words: string[];
}

export function analyzeSentiment(text: string): Sentiment {
  const tokens = tokenize(text);
  let sum = 0;
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const base = LEXICON[tokens[i]];
    if (base === undefined) continue;
    let v = base;
    const prev = tokens[i - 1];
    if (prev && INTENSIFIERS[prev]) v *= INTENSIFIERS[prev];
    for (let j = Math.max(0, i - 3); j < i; j++) {
      if (NEGATORS.has(tokens[j])) {
        v *= -0.6;
        break;
      }
    }
    sum += v;
    words.push(tokens[i]);
  }
  if (/!{2,}/.test(text)) sum *= 1.2;
  const score = Math.max(-1, Math.min(1, sum / 5));
  return { score, label: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral', words };
}

const URGENT_PHRASES: [RegExp, number][] = [
  [/\b(emergency|urgent|urgently|asap|a\.s\.a\.p)\b/, 0.6],
  [/\b(right away|right now|immediately|as soon as possible|straight away)\b/, 0.5],
  [/\b(today|tonight|this (?:morning|afternoon|evening))\b/, 0.3],
  [/\b(unbearable|excruciating|severe|agony|killing me|worst pain)\b/, 0.6],
  [/\b(can'?t sleep|cannot sleep|kept me up|up all night)\b/, 0.4],
  [/!{2,}/, 0.15],
];

export interface Urgency {
  /** 0 (none) .. 1 (very urgent) */
  score: number;
  signals: string[];
}

export function analyzeUrgency(text: string): Urgency {
  const t = text.toLowerCase();
  let score = 0;
  const signals: string[] = [];
  for (const [re, w] of URGENT_PHRASES) {
    const m = re.exec(t);
    if (m) {
      score += w;
      signals.push(m[0]);
    }
  }
  return { score: Math.min(1, score), signals };
}
