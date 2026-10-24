/**
 * Brain = understanding (intents, entities, sentiment, knowledge hits).
 * Assistant = an ordered pipeline of skills that turns understanding into a reply.
 *
 * The optional `refine` hook is the upgrade path: plug any generator in later
 * (a local model, a remote API, your own rules) to rewrite or replace drafts.
 * Nothing here calls out to the network.
 */
import { IntentClassifier, pickIntent, type IntentDefinition, type IntentScore } from './classifier.ts';
import { isQuestionLike } from './dialogue.ts';
import {
  EntityDictionary,
  extractDate,
  extractEmails,
  extractName,
  extractPhones,
  extractTime,
  stripPersonalDetails,
  todayIn,
  type CalendarDate,
  type DateMatch,
  type DictionaryMatch,
  type TimeMatch,
} from './entities.ts';
import { askedAspects, DEFAULT_ASPECTS, type AspectRule } from './reader.ts';
import { SearchIndex, type SearchHit } from './search.ts';
import { analyzeSentiment, analyzeUrgency, type Sentiment, type Urgency } from './sentiment.ts';
import { expandShorthand } from './shorthand.ts';

export interface Understanding<K = unknown> {
  /** The message as received. */
  original: string;
  /** The message with chat-speak expanded ("wat r ur hrs" -> "what are your hours"); everything below is read from this. */
  text: string;
  /** All intents, best first. */
  intents: IntentScore[];
  /** Best intent if it cleared the threshold. */
  intent?: IntentScore;
  emails: string[];
  phones: string[];
  name?: string;
  date?: DateMatch;
  time?: TimeMatch;
  /** Dictionary matches by dictionary name, e.g. { service: ["Dental implants"] }. */
  values: Record<string, string[]>;
  /** The same matches with where they occurred and the words used. */
  matches: Record<string, DictionaryMatch[]>;
  /** What the message asks about a topic: "duration", "pain", "cost"... (see reader.ts). */
  aspects: string[];
  /** Reads as a question or request rather than a statement. */
  question: boolean;
  sentiment: Sentiment;
  urgency: Urgency;
  /** Knowledge hits for the message (empty without a knowledge index). */
  knowledge: SearchHit<K>[];
}

export interface BrainOptions<K = unknown> {
  intents?: IntentDefinition[];
  /** A pre-trained classifier to share between brains (overrides `intents`). */
  classifier?: IntentClassifier;
  /** Minimum confidence for `intent` (default 0.4). */
  intentThreshold?: number;
  knowledge?: SearchIndex<K>;
  dictionaries?: Record<string, EntityDictionary>;
  /** IANA zone used to resolve "tomorrow" etc. (default UTC). */
  timeZone?: string;
  /** Read 03/04 as 3 April (default false). */
  dayFirst?: boolean;
  /** Question aspects (default DEFAULT_ASPECTS). */
  aspects?: AspectRule[];
  /** Extra chat-speak expansions, or false to leave messages as typed. */
  shorthand?: Record<string, string> | false;
}

export interface UnderstandContext {
  /** The assistant just asked for the user's name. */
  expectingName?: boolean;
  now?: Date;
  timeZone?: string;
}

export class Brain<K = unknown> {
  readonly classifier: IntentClassifier;
  knowledge?: SearchIndex<K>;
  readonly dictionaries: Record<string, EntityDictionary>;
  private readonly options: BrainOptions<K>;

  constructor(options: BrainOptions<K> = {}) {
    this.options = options;
    this.classifier = options.classifier ?? new IntentClassifier(options.intents ?? []);
    this.knowledge = options.knowledge;
    this.dictionaries = options.dictionaries ?? {};
  }

  today(ctx: UnderstandContext = {}): CalendarDate {
    return todayIn(ctx.timeZone ?? this.options.timeZone ?? 'UTC', ctx.now ?? new Date());
  }

  understand(original: string, ctx: UnderstandContext = {}): Understanding<K> {
    const text = this.options.shorthand === false ? original : expandShorthand(original, this.options.shorthand ?? {});
    const intents = this.classifier.classify(text, { isKnown: (w) => this.knowledge?.hasWord(w) ?? false });
    const threshold = this.options.intentThreshold ?? 0.4;
    const values: Record<string, string[]> = {};
    const matches: Record<string, DictionaryMatch[]> = {};
    for (const [key, dict] of Object.entries(this.dictionaries)) {
      const found = dict.find(text);
      if (!found.length) continue;
      matches[key] = found;
      values[key] = found.map((m) => m.value);
    }
    const name = extractName(text, { expectingName: ctx.expectingName });
    return {
      original,
      text,
      intents,
      intent: pickIntent(intents, threshold),
      emails: extractEmails(text),
      phones: extractPhones(text),
      name,
      date: extractDate(text, this.today(ctx), { dayFirst: this.options.dayFirst }),
      time: extractTime(text),
      values,
      matches,
      aspects: askedAspects(text, this.options.aspects ?? DEFAULT_ASPECTS),
      question: isQuestionLike(text),
      sentiment: analyzeSentiment(text),
      urgency: analyzeUrgency(text),
      knowledge: this.knowledge ? this.knowledge.search(stripPersonalDetails(text, name), { limit: 3 }) : [],
    };
  }
}

export interface Reply {
  text: string;
  /** Suggested quick replies for the UI. */
  suggestions?: string[];
  /** Anything the caller wants to carry along (actions taken, records created...). */
  data?: Record<string, unknown>;
}

export interface SkillContext<S, K = unknown> {
  /** The message after chat-speak expansion (`u.original` has it as typed). */
  text: string;
  u: Understanding<K>;
  state: S;
  brain: Brain<K>;
}

export interface Skill<S, K = unknown> {
  name: string;
  /** Return a reply to handle the turn, or undefined to let the next skill try. */
  run(ctx: SkillContext<S, K>): Reply | undefined | Promise<Reply | undefined>;
}

export type Refiner<S, K = unknown> = (
  draft: Reply,
  ctx: SkillContext<S, K> & { skill: string }
) => Reply | undefined | Promise<Reply | undefined>;

export interface AssistantOptions<S, K = unknown> {
  /** Upgrade hook: rewrite or replace a draft reply (errors fall back to the draft). */
  refine?: Refiner<S, K>;
  /** Per-turn understanding context derived from the state (e.g. expectingName). */
  context?: (state: S) => UnderstandContext;
  /** Reply when no skill handles the turn. */
  fallback?: string;
}

export interface Turn<K = unknown> {
  reply: Reply;
  skill: string;
  understanding: Understanding<K>;
}

export class Assistant<S, K = unknown> {
  constructor(
    readonly brain: Brain<K>,
    private readonly skills: Skill<S, K>[],
    private readonly options: AssistantOptions<S, K> = {}
  ) {}

  async reply(text: string, state: S): Promise<Turn<K>> {
    const u = this.brain.understand(text, this.options.context?.(state));
    const ctx: SkillContext<S, K> = { text: u.text, u, state, brain: this.brain };
    for (const skill of this.skills) {
      const draft = await skill.run(ctx);
      if (!draft) continue;
      let reply = draft;
      if (this.options.refine) {
        try {
          reply = (await this.options.refine(draft, { ...ctx, skill: skill.name })) ?? draft;
        } catch {
          reply = draft;
        }
      }
      return { reply, skill: skill.name, understanding: u };
    }
    return {
      reply: { text: this.options.fallback ?? "Sorry, I didn't quite catch that. Could you put it another way?" },
      skill: 'fallback',
      understanding: u,
    };
  }
}
