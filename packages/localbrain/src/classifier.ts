/**
 * Intent classifier: TF-IDF nearest-neighbour over labelled example phrases,
 * with character trigrams for typo tolerance and keyword boosts for intents
 * that are signalled by a specific word. Trains in milliseconds; the "model" is
 * just the examples, so improving it means adding examples (see `learn`).
 */
import { Vocabulary } from './fuzzy.ts';
import { stem, tokenize } from './text.ts';

export interface IntentDefinition {
  name: string;
  /** Example user messages for this intent. More and more varied is better. */
  examples: string[];
  /**
   * Words/phrases that on their own strongly signal the intent (matched after
   * spelling correction and stemming), e.g. ["appointment", "book in"].
   */
  keywords?: string[];
}

export interface IntentScore {
  intent: string;
  /** 0..1 similarity to the closest examples of this intent. */
  confidence: number;
}

type Vec = Map<string, number>;

const FILLER = new Set(['a', 'an', 'the', 'um', 'uh', 'er', 'erm', 'hmm']);

/** Words too generic to signal an intent on their own (used for containment only). */
const FUNCTION_WORDS = new Set(
  (
    'i me my mine we our us you your yours it its is are was were be been being am do does did doing have has had ' +
    'can could would will should shall may might must to of in on at for with from by about as into that this these ' +
    'those what which who whom when where why how there here and or but if so then than just also very really any some ' +
    'im ive id youre dont doesnt cant wont is isnt arent get got want like need would'
  ).split(' ')
);

/** Feature keys of the informative words, for the containment score. */
function contentKeys(tokens: string[]): Set<string> {
  return new Set(tokens.filter((t) => !FUNCTION_WORDS.has(t)).map((t) => 'w:' + stem(t)));
}

function rawFeatures(tokens: string[]): Vec {
  const f: Vec = new Map();
  const bump = (k: string, w: number) => f.set(k, (f.get(k) ?? 0) + w);
  const stems = tokens.map(stem);
  for (const s of stems) bump('w:' + s, 1);
  for (let i = 0; i + 1 < stems.length; i++) bump('b:' + stems[i] + '_' + stems[i + 1], 1);
  for (const t of tokens) {
    if (t.length < 4) continue;
    const p = `<${t}>`;
    for (let i = 0; i + 3 <= p.length; i++) bump('c:' + p.slice(i, i + 3), 0.2);
  }
  return f;
}

function norm(v: Vec): number {
  let s = 0;
  for (const x of v.values()) s += x * x;
  return Math.sqrt(s);
}

export class IntentClassifier {
  private defs: IntentDefinition[] = [];
  private examples: { intent: string; vec: Vec; words: Vec }[] = [];
  private idf = new Map<string, number>();
  private unseenIdf = 1;
  private keywords: { intent: string; stems: string[] }[] = [];
  private readonly vocab = new Vocabulary();

  constructor(intents: IntentDefinition[] = []) {
    if (intents.length) this.train(intents);
  }

  get intents(): string[] {
    return this.defs.map((d) => d.name);
  }

  /** (Re)build the model from intent definitions. */
  train(intents: IntentDefinition[]): void {
    this.defs = intents.map((d) => ({ name: d.name, examples: [...d.examples], keywords: [...(d.keywords ?? [])] }));
    const tokenised: { intent: string; tokens: string[] }[] = [];
    for (const d of this.defs) {
      for (const ex of d.examples) {
        const tokens = tokenize(ex).filter((t) => !FILLER.has(t));
        this.vocab.addAll(tokens);
        if (tokens.length) tokenised.push({ intent: d.name, tokens });
      }
      for (const k of d.keywords ?? []) this.vocab.addAll(tokenize(k));
    }

    const df = new Map<string, number>();
    const raws = tokenised.map((e) => rawFeatures(e.tokens));
    for (const r of raws) for (const k of r.keys()) df.set(k, (df.get(k) ?? 0) + 1);
    const n = raws.length;
    this.idf = new Map([...df].map(([k, d]) => [k, Math.log((n + 1) / (d + 1)) + 1]));
    this.unseenIdf = Math.log(n + 1) + 1;
    this.examples = raws.map((r, i) => {
      const content = contentKeys(tokenised[i].tokens);
      return {
        intent: tokenised[i].intent,
        vec: this.weigh(r),
        words: this.weigh(new Map([...r].filter(([k]) => content.has(k)))),
      };
    });
    this.keywords = this.defs.flatMap((d) =>
      (d.keywords ?? []).map((k) => ({ intent: d.name, stems: tokenize(k).map(stem) }))
    );
  }

  /** Add example phrases to an intent (creating it if needed) and retrain. */
  learn(intent: string, examples: string[]): void {
    const defs = this.defs.map((d) => ({ ...d, examples: [...d.examples] }));
    const target = defs.find((d) => d.name === intent);
    if (target) target.examples.push(...examples);
    else defs.push({ name: intent, examples: [...examples] });
    this.train(defs);
  }

  /** All intents ranked by confidence (highest first). */
  classify(text: string): IntentScore[] {
    const tokens = tokenize(text)
      .filter((t) => !FILLER.has(t))
      .map((t) => this.vocab.correct(t));
    if (!tokens.length || !this.examples.length) return [];
    const raw = rawFeatures(tokens);
    const q = this.weigh(raw);
    const qWords = contentKeys(tokens);

    const best = new Map<string, number>();
    for (const ex of this.examples) {
      let dot = 0;
      for (const [k, w] of q) {
        const e = ex.vec.get(k);
        if (e) dot += w * e;
      }
      // How much of the example the message contains: catches the example
      // phrase embedded in a longer message, which cosine under-rates.
      let contained = 0;
      for (const [k, w] of ex.words) if (qWords.has(k)) contained += w * w;
      const score = Math.max(dot, 0.8 * contained);
      if (score > (best.get(ex.intent) ?? 0)) best.set(ex.intent, score);
    }

    const stems = tokens.map(stem);
    for (const kw of this.keywords) {
      if (!kw.stems.length || !containsSeq(stems, kw.stems)) continue;
      best.set(kw.intent, Math.max(best.get(kw.intent) ?? 0, 0.62 + Math.min(0.2, 0.05 * kw.stems.length)));
    }

    return [...best]
      .map(([intent, confidence]) => ({ intent, confidence: Math.min(1, confidence) }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /** The top intent if it is confident enough (see `pickIntent`), otherwise undefined. */
  best(text: string, threshold = 0.4): IntentScore | undefined {
    return pickIntent(this.classify(text), threshold);
  }

  /** Serialisable model (the definitions themselves). */
  toJSON(): IntentDefinition[] {
    return this.defs.map((d) => ({ ...d, examples: [...d.examples], keywords: [...(d.keywords ?? [])] }));
  }

  static fromJSON(defs: IntentDefinition[]): IntentClassifier {
    return new IntentClassifier(defs);
  }

  private weigh(raw: Vec): Vec {
    const v: Vec = new Map();
    for (const [k, tf] of raw) v.set(k, (1 + Math.log(tf)) * (this.idf.get(k) ?? this.unseenIdf));
    const n = norm(v) || 1;
    for (const [k, w] of v) v.set(k, w / n);
    return v;
  }
}

/**
 * Accept the top intent when it clears `threshold`, or when it is slightly
 * below it but at least twice as likely as the runner-up (a clear winner).
 */
export function pickIntent(scores: IntentScore[], threshold = 0.4): IntentScore | undefined {
  const [top, second] = scores;
  if (!top) return undefined;
  if (top.confidence >= threshold) return top;
  if (top.confidence >= threshold * 0.7 && top.confidence >= 2 * (second?.confidence ?? 0)) return top;
  return undefined;
}

function containsSeq(haystack: string[], needle: string[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
