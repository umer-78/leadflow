/**
 * Optional Claude answering mode. With ANTHROPIC_API_KEY set (and the clinic's
 * switch on), open questions — about treatments, comparisons, follow-ups, and
 * questions the built-in engine couldn't answer — are answered by Claude from
 * the clinic's own settings and knowledge base.
 *
 * Everything with consequences stays deterministic and runs first: emergencies
 * and safety advice, booking, quoted prices, opening hours, contact details
 * and opt-outs never go to Claude. When Claude is slow, declines or fails, the
 * built-in answer is used. Patients' names, emails and phone numbers are
 * removed from what is sent.
 */
import Anthropic from '@anthropic-ai/sdk';
import { formatPhone, stripPersonalDetails } from '../packages/localbrain/src/index.ts';
import type { Organization } from './db/schema.ts';
import type { PatientProfile } from './receptionist/profile.ts';
import type { Article, ChatReply, ChatState, TurnResult } from './receptionist/engine.ts';
import { describeHours, utcToZoned } from './scheduling.ts';

export interface ClaudeConfig {
  apiKey: string | undefined;
  model: string;
  effort: 'low' | 'medium' | 'high';
  timeoutMs: number;
  /** Claude-written answers per clinic per 24 hours; after that the built-in engine answers. */
  dailyLimit: number;
}

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

/** Per million tokens: [input, output, cache read, cache write (5-minute)], for the cost estimate in the AI Center. */
export const CLAUDE_PRICES: Record<string, [number, number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
};

/** Models that take the server-side refusal fallback in its "default" form. */
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

/** Turns Claude may write: open questions. Prices, hours, policies, booking, safety and opt-outs stay built-in. */
const CLAUDE_KINDS = new Set(['knowledge', 'capability', 'compare', 'fallback', 'clarify', 'complaint']);

export interface ClaudeUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ClaudeAnswer {
  text: string;
  /** False when the clinic's information doesn't contain the answer. */
  answered: boolean;
  model: string;
  usage: ClaudeUsage;
  ms: number;
}

export interface ClaudePrompt {
  /** Stable per clinic (cached): instructions, clinic facts, the knowledge base's topics. */
  system: string;
  /** This turn: articles, conversation so far, the built-in draft and the question. */
  user: string;
}

export interface Answerer {
  readonly model: string;
  /** Undefined when Claude can't be used for this turn (timeout, error, refusal): use the built-in answer. */
  answer(prompt: ClaudePrompt): Promise<ClaudeAnswer | undefined>;
}

/** Whether a turn may be written by Claude. */
export function eligible(result: TurnResult): boolean {
  const kinds = result.meta.skill.split('+');
  if (!kinds.every((k) => CLAUDE_KINDS.has(k))) return false;
  if (result.meta.safety || result.events.escalate || result.events.optOut) return false;
  const ui = result.reply.ui;
  if (ui?.slots?.length || ui?.card || ui?.form) return false;
  if (result.state.awaiting) return false;
  return true;
}

const PROFILE_LINES: [keyof PatientProfile, (p: PatientProfile) => string][] = [
  ['pregnant', () => 'The patient said they are pregnant.'],
  ['breastfeeding', () => 'The patient said they are breastfeeding.'],
  ['child', (p) => (p.childAge !== undefined ? `The patient is asking for their child, aged ${p.childAge || 'under 1'}.` : 'The patient is asking for their child.')],
  ['anxious', () => 'The patient feels nervous about dental visits.'],
  ['diabetic', () => 'The patient has diabetes.'],
  ['smoker', () => 'The patient smokes.'],
  ['uninsured', () => "The patient doesn't have dental insurance."],
  ['bloodThinner', () => 'The patient takes a blood thinner.'],
  ['coveragePercent', (p) => `The patient's insurance covers about ${p.coveragePercent}%.`],
];

export function profileLines(profile: PatientProfile | undefined): string[] {
  return PROFILE_LINES.filter(([key]) => profile?.[key]).map(([, line]) => line(profile!));
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function priceOf(a: Article): string | undefined {
  if (a.priceMin == null && a.priceMax == null) return undefined;
  const lo = a.priceMin ?? a.priceMax!;
  const hi = a.priceMax ?? a.priceMin!;
  const range = lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
  return a.priceUnit ? `${range} ${a.priceUnit}` : range;
}

/**
 * The cached part of the prompt. It only changes when the clinic's settings or
 * knowledge change, so repeat turns read it from the prompt cache.
 */
export function systemPrompt(
  org: Pick<Organization, 'name' | 'phone' | 'address' | 'hours' | 'timezone' | 'emergencyInstructions'>,
  catalog: Article[]
): string {
  const priced = catalog.filter((a) => a.service && priceOf(a));
  const unpriced = [...new Set(catalog.filter((a) => a.service && !priceOf(a)).map((a) => a.service!))];
  const facts = [
    `Clinic: ${org.name}`,
    `Phone: ${org.phone ? formatPhone(org.phone) : 'not listed'}`,
    `Address: ${org.address ?? 'not listed'}`,
    `Opening hours (${org.timezone}): ${describeHours(org.hours)}`,
    `Out-of-hours emergencies: ${org.emergencyInstructions ?? 'not set'}`,
    priced.length ? `Treatments with the typical prices the clinic quotes:\n${priced.map((a) => `- ${a.service}: ${priceOf(a)}`).join('\n')}` : '',
    unpriced.length ? `Treatments offered where the team gives a quote: ${unpriced.join(', ')}` : '',
  ].filter(Boolean);
  const topics = catalog.map((a) => `- ${a.title}: ${a.summary}`).join('\n');
  return `You are the virtual front-desk assistant for ${org.name}, a dental practice, chatting with patients and visitors on the clinic's website.

How to answer:
- Answer the patient's latest message using only the clinic facts, the knowledge base and the articles provided. When they don't contain the answer, say you don't have that information, offer to have the team get back to them, and set "answered" to false. Never guess prices, policies, insurance details, opening hours or clinical facts.
- Be warm, clear and brief: usually two to four sentences in plain language. No headings or markdown links; use a short list only when listing options.
- You don't diagnose and you don't recommend medicines or doses. For symptoms, say what a dentist would want to check and suggest a visit.
- Quote prices only as listed below: they are typical ranges, and the exact cost depends on the exam.
- The chat system handles booking, emergencies and contact details itself: don't offer specific appointment times, don't ask for personal details, and don't promise anything on the clinic's behalf.
- Take into account what the patient has told you about themselves when it matters for the answer.
- A draft from the clinic's built-in assistant is included. Use it when it answers the question well; correct or replace it when it doesn't.
- Reply in the language the patient writes in.

Clinic facts:
${facts.join('\n')}

Knowledge base topics (title: summary):
${topics}`;
}

export interface TurnInput {
  articles: Article[];
  history: { role: string; body: string }[];
  profile: PatientProfile | undefined;
  /** The built-in answer without its booking question. */
  draft: string;
  draftAnswered: boolean;
  question: string;
  now: Date;
  timezone: string;
  /** The patient's name, removed from what is sent. */
  name?: string;
}

const clean = (text: string, name?: string) => stripPersonalDetails(text, name).slice(0, 1500);

export function turnPrompt(input: TurnInput): string {
  const parts: string[] = [];
  if (input.articles.length) {
    parts.push(
      `<articles>\n${input.articles.map((a) => `<article title="${a.title.replace(/"/g, "'")}">\n${a.summary}\n${a.body}\n</article>`).join('\n')}\n</articles>`
    );
  }
  const profile = profileLines(input.profile);
  if (profile.length) parts.push(`<patient>\n${profile.join('\n')}\n</patient>`);
  const history = input.history.slice(-6).map((m) => `${m.role === 'visitor' ? 'Patient' : 'Assistant'}: ${clean(m.body, input.name)}`);
  if (history.length) parts.push(`<conversation>\n${history.join('\n')}\n</conversation>`);
  parts.push(
    input.draftAnswered
      ? `<draft_answer>\n${input.draft}\n</draft_answer>`
      : `<draft_answer note="The built-in assistant didn't find an answer.">\n${input.draft}\n</draft_answer>`
  );
  const today = new Date(`${utcToZoned(input.now, input.timezone).date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  parts.push(`Today at the clinic: ${today}.`);
  parts.push(`Patient's latest message:\n${clean(input.question, input.name)}`);
  return parts.join('\n\n');
}

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'The message to show the patient.' },
    answered: { type: 'boolean', description: "False when the clinic's information doesn't contain the answer." },
  },
  required: ['reply', 'answered'],
  additionalProperties: false,
} as const;

export function createClaudeAnswerer(config: ClaudeConfig & { apiKey: string }, options: { fetch?: typeof fetch } = {}): Answerer {
  // No retries: a patient is waiting, and the built-in answer is ready the moment Claude can't help.
  const client = new Anthropic({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 0, fetch: options.fetch });
  const fallback = FALLBACK_MODELS.has(config.model);
  return {
    model: config.model,
    async answer(prompt) {
      const started = Date.now();
      try {
        const response = await client.beta.messages.create({
          model: config.model,
          max_tokens: 4000,
          // A refusal is re-run on Anthropic's recommended fallback model instead of returned.
          ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          // Thinking stays adaptive; chat answers need little of it.
          output_config: { effort: config.effort, format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
          system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: prompt.user }],
        });
        if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return undefined;
        const text = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { text: string }).text)
          .join('');
        const parsed = JSON.parse(text) as { reply?: unknown; answered?: unknown };
        if (typeof parsed.reply !== 'string' || typeof parsed.answered !== 'boolean' || !parsed.reply.trim()) return undefined;
        return {
          text: parsed.reply.trim().slice(0, 1500),
          answered: parsed.answered,
          model: response.model,
          usage: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            cacheRead: response.usage.cache_read_input_tokens ?? 0,
            cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
          },
          ms: Date.now() - started,
        };
      } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) console.error('[claude] the API key was rejected; answering with the built-in engine');
        else if (err instanceof Anthropic.RateLimitError) console.warn('[claude] rate limited; answering with the built-in engine');
        else if (err instanceof Anthropic.APIConnectionTimeoutError) console.warn(`[claude] no answer within ${config.timeoutMs} ms; answering with the built-in engine`);
        else if (err instanceof Anthropic.APIError) console.warn(`[claude] API error ${err.status}; answering with the built-in engine`);
        else if (err instanceof SyntaxError) console.warn('[claude] unreadable answer; answering with the built-in engine');
        else console.warn('[claude] failed:', err instanceof Error ? err.message : err);
        return undefined;
      }
    },
  };
}

/** The visitor-facing reply and state after Claude's answer replaces the built-in one. */
export function withClaudeAnswer(result: TurnResult, answer: ClaudeAnswer): { reply: ChatReply; state: ChatState } {
  const state: ChatState = structuredClone(result.state);
  const reply: ChatReply = { ...result.reply };
  if (answer.answered) {
    // The built-in engine offered a callback because it had no answer; Claude answered, so "yes" shouldn't start one.
    if (state.pendingOffer === 'callback' && state.offerTurn === state.turn) state.pendingOffer = undefined;
    const keepButtons = result.reply.cta && !/\bteam\b/i.test((result.reply.suggestions ?? []).join(' '));
    reply.text = result.reply.cta ? `${answer.text} ${result.reply.cta}` : answer.text;
    reply.suggestions = keepButtons ? result.reply.suggestions : undefined;
  } else {
    // Better an honest "I don't know" than the built-in engine's closest guess.
    state.pendingOffer = 'callback';
    state.offerTurn = state.turn;
    reply.text = answer.text;
    reply.suggestions = ['Yes, ask the team', 'No thanks'];
    if (reply.ui) reply.ui = { ...reply.ui, sources: undefined };
  }
  delete reply.cta;
  return { reply, state };
}

/** The built-in answer without the booking question appended to it. */
export function draftOf(reply: ChatReply): string {
  return reply.cta && reply.text.endsWith(reply.cta) ? reply.text.slice(0, -reply.cta.length).trim() : reply.text;
}

/** Estimated cost in US dollars, when the model's prices are known. */
export function claudeCost(model: string, usage: ClaudeUsage): number | undefined {
  const p = CLAUDE_PRICES[model];
  if (!p) return undefined;
  return (usage.input * p[0] + usage.output * p[1] + usage.cacheRead * p[2] + usage.cacheWrite * p[3]) / 1_000_000;
}
