/**
 * Brain = understanding (intents, entities, sentiment, knowledge hits).
 * Assistant = an ordered pipeline of skills that turns understanding into a reply.
 *
 * The optional `refine` hook is the upgrade path: plug any generator in later
 * (a local model, a remote API, your own rules) to rewrite or replace drafts.
 * Nothing here calls out to the network.
 */
import { IntentClassifier, pickIntent, type IntentDefinition, type IntentScore } from './classifier.ts';
import {
  EntityDictionary,
  extractDate,
  extractEmails,
  extractName,
  extractPhones,
  extractTime,
  todayIn,
  type CalendarDate,
  type DateMatch,
  type TimeMatch,
} from './entities.ts';
import { SearchIndex, type SearchHit } from './search.ts';
import { analyzeSentiment, analyzeUrgency, type Sentiment, type Urgency } from './sentiment.ts';

export interface Understanding {
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
  sentiment: Sentiment;
  urgency: Urgency;
  /** Knowledge hits for the message (empty without a knowledge index). */
  knowledge: SearchHit[];
}

export interface BrainOptions {
  intents?: IntentDefinition[];
  /** A pre-trained classifier to share between brains (overrides `intents`). */
  classifier?: IntentClassifier;
  /** Minimum confidence for `intent` (default 0.4). */
  intentThreshold?: number;
  knowledge?: SearchIndex<any>;
  dictionaries?: Record<string, EntityDictionary>;
  /** IANA zone used to resolve "tomorrow" etc. (default UTC). */
  timeZone?: string;
  /** Read 03/04 as 3 April (default false). */
  dayFirst?: boolean;
}

export interface UnderstandContext {
  /** The assistant just asked for the user's name. */
  expectingName?: boolean;
  now?: Date;
  timeZone?: string;
}

export class Brain {
  readonly classifier: IntentClassifier;
  knowledge?: SearchIndex<any>;
  readonly dictionaries: Record<string, EntityDictionary>;
  private readonly options: BrainOptions;

  constructor(options: BrainOptions = {}) {
    this.options = options;
    this.classifier = options.classifier ?? new IntentClassifier(options.intents ?? []);
    this.knowledge = options.knowledge;
    this.dictionaries = options.dictionaries ?? {};
  }

  today(ctx: UnderstandContext = {}): CalendarDate {
    return todayIn(ctx.timeZone ?? this.options.timeZone ?? 'UTC', ctx.now ?? new Date());
  }

  understand(text: string, ctx: UnderstandContext = {}): Understanding {
    const intents = this.classifier.classify(text);
    const threshold = this.options.intentThreshold ?? 0.4;
    const values: Record<string, string[]> = {};
    for (const [key, dict] of Object.entries(this.dictionaries)) {
      const found = dict.find(text).map((m) => m.value);
      if (found.length) values[key] = found;
    }
    return {
      text,
      intents,
      intent: pickIntent(intents, threshold),
      emails: extractEmails(text),
      phones: extractPhones(text),
      name: extractName(text, { expectingName: ctx.expectingName }),
      date: extractDate(text, this.today(ctx), { dayFirst: this.options.dayFirst }),
      time: extractTime(text),
      values,
      sentiment: analyzeSentiment(text),
      urgency: analyzeUrgency(text),
      knowledge: this.knowledge ? this.knowledge.search(text, { limit: 3 }) : [],
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

export interface SkillContext<S> {
  text: string;
  u: Understanding;
  state: S;
  brain: Brain;
}

export interface Skill<S> {
  name: string;
  /** Return a reply to handle the turn, or undefined to let the next skill try. */
  run(ctx: SkillContext<S>): Reply | undefined | Promise<Reply | undefined>;
}

export type Refiner<S> = (
  draft: Reply,
  ctx: SkillContext<S> & { skill: string }
) => Reply | undefined | Promise<Reply | undefined>;

export interface AssistantOptions<S> {
  /** Upgrade hook: rewrite or replace a draft reply (errors fall back to the draft). */
  refine?: Refiner<S>;
  /** Per-turn understanding context derived from the state (e.g. expectingName). */
  context?: (state: S) => UnderstandContext;
  /** Reply when no skill handles the turn. */
  fallback?: string;
}

export interface Turn {
  reply: Reply;
  skill: string;
  understanding: Understanding;
}

export class Assistant<S> {
  constructor(
    readonly brain: Brain,
    private readonly skills: Skill<S>[],
    private readonly options: AssistantOptions<S> = {}
  ) {}

  async reply(text: string, state: S): Promise<Turn> {
    const u = this.brain.understand(text, this.options.context?.(state));
    const ctx: SkillContext<S> = { text, u, state, brain: this.brain };
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
