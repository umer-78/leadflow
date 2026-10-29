/**
 * The AI receptionist. Runs entirely on localbrain (no external AI): it
 * understands the message, applies safety rules, answers from the clinic's
 * knowledge base (picking the sentence that answers *what* was asked),
 * follows the conversation ("what about veneers?"), answers several questions
 * in one message, quotes only clinic-set prices, captures contact details,
 * offers real open appointment times and books them, and hands off to staff.
 *
 * The engine is pure apart from the injected ClinicPort (slot search and
 * booking), so it is fully testable without a database — and it also runs in
 * the browser for the live demo.
 */
import {
  Assistant,
  Brain,
  EntityDictionary,
  IntentClassifier,
  Reader,
  STOPWORDS,
  SearchIndex,
  bareName,
  bareNumber,
  choose,
  expandShorthand,
  followUpSubject,
  formatPhone,
  joinList,
  pickIntent,
  sentenceKey,
  sentences,
  splitQuestions,
  stripPersonalDetails,
  terms,
  tokenize,
  type IntentScore,
  type PartOfDay,
  type ReadAnswer,
  type Reply,
  type SearchDocument,
  type SearchHit,
  type Skill,
  type SkillContext,
  type Understanding,
} from '../../packages/localbrain/src/index.ts';
import type { WeeklyHours } from '../db/schema.ts';
import { EQUIVALENTS, SYNONYMS } from '../knowledge/library.ts';
import {
  describeDay,
  describeHours,
  formatDate,
  formatSlot,
  formatTime,
  isOpenAt,
  nextOpening,
  utcToZoned,
  zonedToUtc,
} from '../scheduling.ts';
import { INTENTS, SOCIAL_INTENTS } from './intents.ts';
import { checkSafety, isDiagnosisRequest, isMedicationQuestion, type SafetyLevel, type SafetyMatch } from './safety.ts';

// ---------------------------------------------------------------- types

export interface ClinicProfile {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  timezone: string;
  hours: WeeklyHours;
  greeting: string | null;
  emergencyInstructions: string | null;
  /** Appointment length in minutes (default 30). */
  slotMinutes?: number;
}

export interface Article {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  service: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  caseValue: number | null;
  published: boolean;
}

export interface Slot {
  /** ISO instant (UTC). */
  startsAt: string;
  /** Clinic-local label, e.g. "Tue, Oct 20 at 9 AM". */
  label: string;
}

export interface Contact {
  name?: string;
  phone?: string;
  email?: string;
}

export interface SlotPreference {
  date?: string;
  partOfDay?: PartOfDay;
  time?: string;
  relation?: 'at' | 'after' | 'before';
  /** Only times after this instant (ISO). */
  after?: string;
}

/** What the engine needs from the outside world. */
export interface ClinicPort {
  findSlots(pref: SlotPreference): Promise<Slot[]>;
  reserve(slot: Slot, service: string, contact: Contact): Promise<{ ok: true; appointmentId: string } | { ok: false; reason: string }>;
}

/** Structured extras the chat window renders (buttons, cards, a form). Text alone always works too. */
export interface ReplyUi {
  /** Appointment times to pick from. */
  slots?: Slot[];
  card?:
    | { type: 'emergency' | 'urgent'; title: string }
    | { type: 'booked'; service: string; label: string; startsAt: string; minutes: number; clinic: string; address?: string };
  /** Ask for contact details with a small form instead of free text. */
  form?: { fields: ('name' | 'phone' | 'email')[]; submit: string };
  /** Link buttons: call, directions, email. */
  actions?: { label: string; href: string; kind: 'call' | 'map' | 'email' | 'link' }[];
  /** Knowledge articles the answer came from. */
  sources?: string[];
}

export interface ChatReply extends Reply {
  ui?: ReplyUi;
}

export interface ChatState {
  turn: number;
  visitorMessages: number;
  contact: Contact;
  /** Canonical service the visitor is interested in. */
  service?: string;
  /** Knowledge articles discussed, most recent last. */
  topics: string[];
  awaiting?: 'contact' | 'slot' | 'price_service';
  purpose?: 'booking' | 'callback' | 'urgent';
  offered?: Slot[];
  chosen?: Slot;
  bookingService?: string;
  /** What a "yes" from the visitor would mean right now (valid for a few turns). */
  pendingOffer?: 'booking' | 'callback' | 'topic';
  offerTurn?: number;
  suggestedTopic?: string;
  appointment?: { id: string; label: string; service: string };
  urgency?: SafetyLevel;
  optedOut?: boolean;
  signals: { price?: boolean; insurance?: boolean; financing?: boolean; booking?: boolean; preferredDate?: string };
  lastCtaTurn?: number;
  lastReminderTurn?: number;
  misses: number;
  contactAsks: number;
  /** Sentences already said (keys), so answers don't repeat themselves. */
  said?: string[];
  /** The last question answered, for follow-ups like "what about veneers?". */
  lastQuestion?: { text: string; subject?: string; subjectKind?: 'service' | 'day'; kind: string };
  /** A dentist the visitor asked for ("book me with Dr. Okafor"). */
  dentist?: string;
}

export function newChatState(): ChatState {
  return { turn: 0, visitorMessages: 0, contact: {}, topics: [], signals: {}, misses: 0, contactAsks: 0, said: [] };
}

export interface TurnEvents {
  escalate?: { level: 'ER' | 'URGENT' | 'HANDOFF'; reason: string };
  optOut?: boolean;
  appointmentId?: string;
}

export interface TurnMeta {
  intent?: string;
  confidence?: number;
  skill: string;
  sources: { slug: string; title: string }[];
  safety?: SafetyLevel;
  safetyReason?: string;
  unanswered?: boolean;
}

export interface TurnResult {
  reply: ChatReply;
  state: ChatState;
  meta: TurnMeta;
  events: TurnEvents;
}

/** Per-turn working state passed through the skills pipeline. */
interface Turn {
  chat: ChatState;
  port: ClinicPort;
  now: Date;
  events: TurnEvents;
  sources: Article[];
  captured: { name?: boolean; phone?: boolean; email?: boolean };
  safety?: SafetyMatch;
  kind?: string;
  unanswered?: boolean;
  askedContact?: boolean;
  offeredSlots?: boolean;
  /** Service to name in the booking prompt: a string, null for a generic prompt, undefined to use the visitor's interest. */
  ctaService?: string | null;
}

type Ctx = SkillContext<Turn, Article>;

// ---------------------------------------------------------------- language

/** Trained once and shared by every clinic. */
const classifier = new IntentClassifier(INTENTS);

const SEVERITY: Record<SafetyLevel, number> = { SOON: 1, URGENT: 2, ER: 3 };
const worst = (a: SafetyLevel | undefined, b: SafetyLevel): SafetyLevel => (!a || SEVERITY[b] > SEVERITY[a] ? b : a);

const firstName = (name?: string) => name?.split(' ')[0];
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** Brand names keep their capital when a sentence is joined mid-way ("As I mentioned, ..."). */
const PROPER = new Set(['Invisalign', 'CareCredit', 'Cherry', 'ClearCorrect', 'Lumineers', 'Zoom', 'Medicaid', 'Medicare', 'Delta', 'Dr']);
const lowerFirst = (s: string) => {
  const first = /^([A-Z][a-z']*)\b(\s+[A-Z])?/.exec(s);
  return first && !first[2] && !PROPER.has(first[1]) ? lower(s) : s;
};

/** Placeholder text like "[Which plans do you accept?]" means the clinic hasn't filled it in. */
const isUsable = (a: Article) => a.published && !/\[[^\]]{3,}\]/.test(a.summary);

/** Query words that don't change *what* is being asked about a topic. */
/** "I'd like veneers", "I think I need a filling": the patient wants the treatment, nothing more specific. */
const INTEREST =
  /^(?:(?:hi|hey|hello)[,!\s]+)?(?:(?:i (?:think|guess|believe)|i was told|my dentist (?:said|says|told me))(?: that)? )?(?:i(?:'m| am)? ?(?:want|would like|'d like|need|may need|might need|probably need|am interested in|interested in|looking (?:for|into)|thinking (?:about|of)|considering)|tell me (?:more )?about|info(?:rmation)? (?:on|about))\b/i;

const GENERIC_TERMS = new Set(
  ['tell', 'inform', 'info', 'explain', 'interest', 'offer', 'know', 'learn', 'detail', 'question', 'ask', 'procedur', 'treatment',
    'option', 'servic', 'look', 'consid', 'think', 'someth', 'anyth', 'thing', 'avail', 'provid', 'perform', 'dentist', 'dental',
    'clinic', 'practic', 'offic', 'get', 'need', 'want', 'more', 'much', 'guy', 'see', 'make', 'have', 'do', 'treat', 'help']
);

/** Stems that only say "money" (a policy must match something else to answer a price question). */
const COST_TERMS = new Set(
  ['cost', 'costs', 'price', 'fee', 'fees', 'much', 'charge', 'pay', 'expensive', 'afford', 'quote', 'cheap', 'money', 'pricing', 'how', 'free']
    .flatMap((w) => terms(w))
);

/** Title words too general to tie an article to a treatment ("Sensitive teeth" is not about whitening). */
/** Words in a service's name that many unrelated article titles share. */
const BROAD_NAME = new Set(['gum', 'dentistry'].flatMap((w) => terms(w)));

const GENERIC_TITLE = new Set(
  ['tooth', 'teeth', 'dental', 'treatment', 'care', 'option', 'visit', 'your', 'home', 'follow', 'after', 'up', 'check', 'surgery', 'and']
    .flatMap((w) => terms(w))
);

/** Elective treatments that dental insurance rarely covers. */
const COSMETIC = new Set(['Teeth whitening', 'Porcelain veneers', 'Cosmetic bonding']);

const ORDINALS: [RegExp, number][] = [
  [/^\s*(?:#|no\.?|number|option)?\s*(?:1|one)\s*[.)!]?\s*(?:please)?\s*$|\b(?:first|1st)\b|\boption (?:1|one)\b|\bnumber one\b/, 0],
  [/^\s*(?:#|no\.?|number|option)?\s*(?:2|two)\s*[.)!]?\s*(?:please)?\s*$|\b(?:second|2nd)\b|\boption (?:2|two)\b|\bnumber two\b/, 1],
  [/^\s*(?:#|no\.?|number|option)?\s*(?:3|three)\s*[.)!]?\s*(?:please)?\s*$|\b(?:third|3rd)\b|\boption (?:3|three)\b|\bnumber three\b/, 2],
];

/** "Do you do implants?", "can you fix crooked teeth?", "do u guys see kids". */
const CAPABILITY =
  /^(?:(?:hi|hello|hey|ok|so|and|also)[,!\s]+)?(?:do|does|can|could|will|would) (?:you|y'all|your (?:office|clinic|practice|team|dentists?))(?: guys| all| folks)? (?:do|offer|provide|have|make|see|treat|perform|fix|carry|work on|help with|deal with|specialize in|specialise in|handle)\b|^(?:is|are) (?:there|you) (?:able to|offering)\b/i;
const COMPARE =
  /\b(?:vs\.?|versus|compared? (?:to|with)|differences? between|better than|which is better|which one is better|should i (?:get|choose|go with|do)|or)\b/i;
const HOURS_Q =
  /\b(?:are|r) (?:you|u)(?: guys)? (?:open|closed)\b|\bwhat time do you (?:open|close)\b|\bwhen do you (?:open|close)\b|\bopen (?:on|this|next|today|tomorrow|tonight|now|late|right now|weekends?|saturdays?|sundays?)\b|\bclosed (?:on|today|tomorrow)\b|\bopening (?:hours|times)\b/i;
const TREATMENT_HOURS = /\bhours? (?:a|per) (?:day|night)\b|\bhow many hours\b/i;
const GREETING_ONLY =
  /^(?:hi+|hello+|hey+|hiya|howdy|yo|greetings|good (?:morning|afternoon|evening|day)|morning|afternoon|evening)(?:\s+(?:there|team|all|everyone|folks|guys))?[\s!.,]*$/i;
const WISH = /\b(want|wanna|like|need|can i|could i|may i|looking to|hoping to|book|come in|get in|schedule)\b/i;
const SYMPTOM =
  /\bmy\b[^.?!]{0,30}\b(?:hurts?|hurting|bleed\w*|sore|sensitive|swollen|loose|ache\w*|aching|throb\w*|crooked|yellow|stained|chipped|cracked)\b|\bi (?:grind|clench)\b/i;
const MORE_TIMES =
  /\b(?:later|earlier|another|other|different|else|more|next)\b[^.?!]*\b(?:time|times|day|days|slot|slots|option|options|ones?|openings?)\b|\banything (?:later|earlier|else)\b|\blater in the day\b|\b(?:later|earlier)\b\s*(?:please|on|that day)?\s*\??$|\bnone of (?:those|these|them)\b/i;
/** Words for who a question is about ("my child", "kids") rather than what. */
const PEOPLE = /^(?:my |our |the )?(?:kids?|child|children|childrens|son|daughter|toddler|baby|teen|teenager|little one)$/i;
const ANXIOUS = /\b(?:scared|terrified|petrified|afraid|frightened|nervous|anxious|anxiety|phobia|fear|panic\w*|dread\w*|freak(?:ed|ing)? out)\b/i;
const BOOKING_WORDS =
  /\b(?:book\w*|appointments?|appt|schedul\w*|slots?|availab\w*|openings?|come in|get in|fit me in|be seen|see (?:the|a) (?:dentist|doctor|hygienist)|visit|consult\w*|reserve)\b/i;
const AFTER_PROCEDURE =
  /\bafter (?:the |my |a |an |getting |having |i get |i have |i've had )?(?:\w+ )?(?:surgery|procedure|treatment|extraction|removal|operation|filling|crown|implants?|whitening|root canal|braces|bonding|veneers?|cleaning|visit|appointment|wisdom teeth)\b/i;
const DAY_WORD = /\b(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?s?\b|\b(?:today|tomorrow|tonight|weekends?)\b/i;

/** How to say "we offer X" naturally for the library's services. */
const OFFER_PHRASES: Record<string, string> = {
  "Children's check-up": "children's dentistry",
  'Check-up and cleaning': 'check-ups and cleanings',
  'Night guard': 'custom night guards',
  'Emergency visit': 'emergency appointments',
  'Tooth extraction': 'tooth extractions',
  Fillings: 'tooth-coloured fillings',
  'Sports mouthguard': 'custom sports mouthguards',
};

/** What an aspect is called in "I don't have details on ___". */
const ASPECT_PHRASES: Record<string, string> = {
  duration: 'how long it takes',
  longevity: 'how long it lasts',
  pain: 'how it feels',
  recovery: 'recovery',
  safety: 'safety',
  candidacy: 'who it suits',
  process: "what's involved",
  alternatives: 'the alternatives',
  aftercare: 'aftercare',
  eating: 'eating and drinking',
  frequency: 'how often it is needed',
  appearance: 'how it looks',
  cause: 'the causes',
  signs: 'the signs to look for',
  children: 'children',
  pregnancy: 'pregnancy',
  cost: 'cost',
};

const JOKES = [
  'Why did the king go to the dentist? To get his teeth crowned!',
  "What's a dentist's favourite time of day? Tooth-hurty (2:30)!",
  'What do dentists call their X-rays? Tooth pics!',
  'Why did the smartphone need to see the dentist? It had Bluetooth!',
];

// ---------------------------------------------------------------- engine

export class Receptionist {
  readonly index: SearchIndex<Article>;
  private readonly reader: Reader<Article>;
  private readonly bySlug: Map<string, Article>;
  private readonly byService: Map<string, Article[]>;
  private readonly services: { name: string; article: Article }[];
  private readonly dictionary: EntityDictionary;
  private readonly assistant: Assistant<Turn, Article>;

  constructor(
    readonly clinic: ClinicProfile,
    articles: Article[]
  ) {
    const usable = articles.filter(isUsable);
    this.index = new SearchIndex<Article>({ synonyms: SYNONYMS, equivalents: EQUIVALENTS });
    for (const a of usable) {
      this.index.add({ id: a.id, title: a.title, tags: a.tags, body: `${a.summary}\n${a.body}`, data: a });
    }
    this.reader = new Reader(this.index);
    this.bySlug = new Map(usable.map((a) => [a.slug, a]));

    // One entry per bookable service; synonyms come from every article offering it.
    this.byService = new Map<string, Article[]>();
    for (const a of usable) if (a.service) this.byService.set(a.service, [...(this.byService.get(a.service) ?? []), a]);
    this.services = [...this.byService].map(([name, list]) => ({
      name,
      article: list.find((a) => a.priceMin != null || a.priceMax != null) ?? list.find((a) => a.category === 'PROCEDURE') ?? list[0],
    }));
    this.dictionary = new EntityDictionary(
      [...this.byService].map(([name, list]) => ({ value: name, synonyms: list.flatMap((a) => [a.title, ...a.tags]) }))
    );

    const brain = new Brain<Article>({
      classifier,
      knowledge: this.index,
      dictionaries: { service: this.dictionary },
      timeZone: clinic.timezone,
      intentThreshold: 0.45,
    });
    this.assistant = new Assistant<Turn, Article>(brain, this.skills(), {
      context: (t) => ({ expectingName: t.chat.awaiting === 'contact', timeZone: clinic.timezone, now: t.now }),
    });
  }

  /** Typical case value of a service (for lead scoring), if known. */
  caseValueFor(service: string | null | undefined): number | null {
    if (!service) return null;
    return this.services.find((s) => s.name === service)?.article.caseValue ?? null;
  }

  /** The opening message shown when the chat widget opens. */
  greeting(): ChatReply {
    const text =
      this.clinic.greeting?.trim() ||
      `Hi! I'm the virtual assistant for ${this.clinic.name}. Ask me anything about treatments, costs, insurance or opening hours — or I can book you in. How can I help?`;
    return { text, suggestions: ['Book an appointment', ...this.topServices(2), 'Opening hours'] };
  }

  async respond(text: string, prev: ChatState, port: ClinicPort, now: Date = new Date()): Promise<TurnResult> {
    const chat: ChatState = structuredClone(prev);
    chat.said ??= [];
    chat.turn++;
    chat.visitorMessages++;
    if (chat.pendingOffer && (chat.offerTurn ?? 0) < chat.turn - 3) chat.pendingOffer = undefined;
    const turn: Turn = { chat, port, now, events: {}, sources: [], captured: {} };

    const parts: { reply: ChatReply; kind: string; skill: string; u: Understanding<Article> }[] = [];
    for (const part of this.split(text.slice(0, 1000))) {
      const question = this.resolveFollowUp(part, chat);
      turn.kind = undefined;
      const result = await this.assistant.reply(question, turn);
      const kind = turn.kind ?? result.skill;
      parts.push({ reply: result.reply as ChatReply, kind, skill: result.skill, u: result.understanding });
      this.remember(chat, result.understanding, kind);
      if (turn.safety || turn.events.optOut) break;
    }

    const last = parts[parts.length - 1];
    turn.kind = last.kind;
    const reply = this.finish(this.merge(parts.map((p) => p.reply)), last.skill, last.u, turn);
    const primary = this.primaryIntent(last.u);
    const seen = new Set<string>();
    return {
      reply,
      state: chat,
      events: turn.events,
      meta: {
        intent: primary?.intent,
        confidence: primary ? Math.round(primary.confidence * 100) / 100 : undefined,
        skill: parts.map((p) => p.kind).join('+'),
        sources: turn.sources.filter((a) => !seen.has(a.slug) && seen.add(a.slug)).map((a) => ({ slug: a.slug, title: a.title })),
        safety: turn.safety?.level,
        safetyReason: turn.safety?.reason,
        unanswered: turn.unanswered || undefined,
      },
    };
  }

  // ---------------------------------------------------------------- conversation

  /** Several questions in one message are answered one by one (booking last, so the times end the reply). */
  private split(message: string): string[] {
    if (checkSafety(message)) return [message];
    const parts = splitQuestions(message);
    if (parts.length < 2) return parts;
    const booking = (p: string) => pickIntent(classifier.classify(expandShorthand(p)), 0.45)?.intent === 'book';
    return [...parts.filter((p) => !booking(p)), ...parts.filter(booking)];
  }

  /** "what about veneers?" after "how long do implants last?" -> "how long do veneers last?". */
  private resolveFollowUp(text: string, chat: ChatState): string {
    const last = chat.lastQuestion;
    if (!last || chat.awaiting === 'contact') return text;
    const subject = followUpSubject(expandShorthand(text));
    if (!subject) return text;
    if (this.dictionary.find(subject).length) {
      if (last.subjectKind === 'service' && last.subject) return replacePhrase(last.text, last.subject, subject) ?? text;
      if (last.kind === 'price') return `how much is ${subject}?`;
      if (/\b(it|they|them|this|that)\b/i.test(last.text)) return last.text.replace(/\b(it|they|them|this|that)\b/i, subject);
      return text;
    }
    if (DAY_WORD.test(subject)) {
      if (last.subjectKind === 'day' && last.subject) return replacePhrase(last.text, last.subject, subject) ?? text;
      if (last.kind === 'hours') return `are you open on ${subject}?`;
    }
    return text;
  }

  /** Remember an answered question so an elliptical follow-up can reuse it. */
  private remember(chat: ChatState, u: Understanding<Article>, kind: string): void {
    const answers = ['knowledge', 'capability', 'compare', 'price', 'hours', 'insurance', 'financing', 'new_patient', 'location'];
    if (!answers.includes(kind)) return;
    const service = u.matches.service?.[0];
    const day = DAY_WORD.exec(u.text)?.[0];
    chat.lastQuestion = service
      ? { text: u.text, subject: service.text, subjectKind: 'service', kind }
      : day
        ? { text: u.text, subject: day, subjectKind: 'day', kind }
        : { text: u.text, kind };
  }

  /** One reply for a multi-question message; a sentence an earlier part already said isn't repeated. */
  private merge(replies: ChatReply[]): ChatReply {
    if (replies.length === 1) return replies[0];
    const said = new Set<string>();
    const fresh = (text: string) =>
      text
        .split('\n')
        .map((line) => {
          if (!line.trim() || /^\s*(?:\d+\.|[•*-])\s/.test(line)) return line;
          const all = sentences(line);
          const kept = all.filter((x) => !said.has(sentenceKey(x)));
          for (const x of all) said.add(sentenceKey(x));
          return kept.length === all.length ? line : kept.join(' ');
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    const ui: ReplyUi = {};
    for (const r of replies) {
      if (r.ui?.slots) ui.slots = r.ui.slots;
      if (r.ui?.card && !ui.card) ui.card = r.ui.card;
      if (r.ui?.form) ui.form = r.ui.form;
      if (r.ui?.actions) ui.actions = [...(ui.actions ?? []), ...r.ui.actions.filter((a) => !ui.actions?.some((b) => b.href === a.href))];
    }
    const withSuggestions = [...replies].reverse().find((r) => r.suggestions?.length);
    return {
      text: replies.map((r) => fresh(r.text)).filter(Boolean).join('\n\n'),
      suggestions: withSuggestions?.suggestions,
      ui: Object.keys(ui).length ? ui : undefined,
    };
  }

  // ---------------------------------------------------------------- pipeline

  private skills(): Skill<Turn, Article>[] {
    return [
      { name: 'capture', run: (c) => void this.capture(c) },
      { name: 'safety', run: (c) => this.safety(c) },
      { name: 'opt_out', run: (c) => this.optOut(c) },
      { name: 'medical_advice', run: (c) => this.medicalAdvice(c) },
      { name: 'awaiting', run: (c) => this.awaiting(c) },
      { name: 'volunteered', run: (c) => this.volunteered(c) },
      { name: 'introduce', run: (c) => this.introduce(c) },
      { name: 'intent', run: (c) => this.byIntent(c) },
      { name: 'knowledge', run: (c) => this.knowledge(c) },
      { name: 'fallback', run: (c) => this.fallback(c) },
    ];
  }

  /** Remember contact details, service interest and date preferences mentioned anywhere. */
  private capture({ u, state: t }: Ctx): void {
    const chat = t.chat;
    const c = chat.contact;
    const email = u.emails[0];
    if (email && email !== c.email) {
      c.email = email;
      t.captured.email = true;
    }
    const phone = u.phones[0];
    if (phone && phone !== c.phone) {
      c.phone = phone;
      t.captured.phone = true;
    }
    const explicit = /\b(my name|call me|name is|name's|name:)\b/i.test(u.text);
    const expecting = chat.awaiting === 'contact';
    let name = u.name;
    // A message that is only a name ("Sarah Connor") counts when we don't know it yet.
    if (!name && (expecting || !c.name)) {
      const intent = this.primaryIntent(u);
      const meaningful = intent && !SOCIAL_INTENTS.has(intent.intent) && intent.confidence >= 0.6;
      if (!meaningful && !u.values.service?.length) name = bareName(u.text, (w) => this.knownWord(w), expecting);
    }
    if (name && name !== c.name && (!c.name || explicit || expecting)) {
      c.name = name;
      t.captured.name = true;
    }
    const service = u.values.service?.[0];
    if (service) chat.service = service;
    if (u.date) chat.signals.preferredDate = u.date.date;
  }

  private safety(c: Ctx): ChatReply | undefined {
    const t = c.state;
    const s = checkSafety(c.text);
    if (!s) return undefined;
    t.safety = s;
    t.kind = `safety_${s.level.toLowerCase()}`;
    t.chat.urgency = worst(t.chat.urgency, s.level);
    const article = this.bySlug.get(s.topic);
    if (article) t.sources.push(article);
    const phone = this.phone();
    const call = phone ? [{ label: `Call ${phone}`, href: `tel:${this.clinic.phone}`, kind: 'call' as const }] : [];

    if (s.level === 'ER') {
      t.events.escalate = { level: 'ER', reason: s.reason };
      return {
        text: [
          'This could be a medical emergency. Please call 911 or go to the nearest emergency room right away.',
          s.advice ?? '',
          `Once you've been seen, ${this.clinic.name} can help with the dental cause${phone ? ` (call ${phone})` : ''}.`,
        ]
          .filter(Boolean)
          .join(' '),
        ui: { card: { type: 'emergency', title: 'Possible medical emergency' }, actions: [{ label: 'Call 911', href: 'tel:911', kind: 'call' }, ...call] },
      };
    }

    const bookingService = article?.service ?? 'Emergency visit';
    t.chat.bookingService = bookingService;
    if (s.level === 'SOON') {
      this.offer(t.chat, 'booking');
      return {
        text: `Sorry to hear that. ${s.advice ?? article?.summary ?? ''} It's best to have it checked soon. Would you like me to find the earliest available appointment?`,
        suggestions: ['Yes, find a time', 'No thanks'],
      };
    }

    // URGENT
    const parts = ["I'm sorry you're dealing with that — let's get you help quickly.", article?.summary ?? '', this.callLine(t.now)];
    const ui: ReplyUi = { card: { type: 'urgent', title: s.reason }, actions: call };
    if (this.reachable(t.chat.contact)) {
      t.events.escalate = { level: 'URGENT', reason: s.reason };
      parts.push(`I've flagged this as urgent for the team so they can reach you at ${this.reachLabel(t.chat.contact)} as soon as possible.`);
      this.offer(t.chat, 'booking');
      parts.push('Would you also like me to find the earliest available appointment?');
    } else {
      t.chat.awaiting = 'contact';
      t.chat.purpose = 'urgent';
      t.askedContact = true;
      parts.push("If you send your name and phone number, I'll flag this as urgent so the team can call you back right away.");
      ui.form = { fields: ['name', 'phone'], submit: 'Request an urgent call back' };
    }
    parts.push('If swelling spreads to your eye or neck, or you have trouble breathing or swallowing or a high fever, go to the emergency room or call 911.');
    return { text: parts.filter(Boolean).join(' '), ui };
  }

  private optOut(c: Ctx): ChatReply | undefined {
    const byIntent = c.u.intent?.intent === 'opt_out' && c.u.intent.confidence >= 0.55;
    const byPhrase = /\b(unsubscribe|opt out|stop (contacting|emailing|texting|messaging|sending)|do not contact|dont contact|remove me from)\b/i.test(
      c.text.replace(/['’]/g, '')
    );
    if (!byIntent && !byPhrase) return undefined;
    const t = c.state;
    t.kind = 'opt_out';
    t.chat.optedOut = true;
    t.chat.pendingOffer = undefined;
    t.chat.awaiting = undefined;
    t.events.optOut = true;
    const phone = this.phone();
    return {
      text: `Understood — you won't receive any more follow-up messages from ${this.clinic.name}. If you ever need us${phone ? `, just call ${phone}` : ''}. Take care!`,
    };
  }

  private medicalAdvice(c: Ctx): ChatReply | undefined {
    const t = c.state;
    if (isMedicationQuestion(c.text)) {
      t.kind = 'medication_question';
      this.offer(t.chat, 'booking');
      t.chat.bookingService = t.chat.service ?? 'Dental exam';
      // General facts are fine to share ("most people don't need antibiotics before treatment"); advice is not.
      const hit = this.strongHit(c.u.knowledge)?.doc.data;
      if (hit && hit.category === 'FAQ' && /\bantibiotic/i.test(`${hit.title} ${hit.tags.join(' ')}`)) {
        t.sources.push(hit);
        return {
          text: `I can't recommend medicines for you — your dentist and doctor decide that together. Some general information: ${hit.summary} Please tell the team about any heart conditions, joint replacements and medicines before treatment.`,
          suggestions: ['Book an appointment', 'Talk to the team'],
        };
      }
      return {
        text:
          "I can't recommend medicines or doses. Please follow the directions on the label, or ask a pharmacist or your doctor what's safe for you. " +
          'If you are in pain, the dentist can find and treat the cause. Would you like me to find the earliest available appointment?',
        suggestions: ['Yes, find a time', 'No thanks'],
      };
    }
    const asked = isDiagnosisRequest(c.text) || (c.u.intent?.intent === 'diagnosis' && c.u.intent.confidence >= 0.55);
    if (!asked) return undefined;
    t.kind = 'diagnosis_request';
    const hit = this.strongHit(c.u.knowledge);
    const parts = ["I can't diagnose problems over chat — that needs an exam by the dentist, who can take a proper look and X-rays if needed."];
    if (hit?.doc.data) {
      t.sources.push(hit.doc.data);
      parts.push(`Some general information that may help: ${hit.doc.data.summary}`);
    }
    parts.push('Would you like me to book you an exam?');
    this.offer(t.chat, 'booking');
    t.chat.bookingService = hit?.doc.data?.service ?? 'Dental exam';
    return { text: parts.join(' '), suggestions: ['Yes, book an exam', 'No thanks'] };
  }

  private async awaiting(c: Ctx): Promise<ChatReply | undefined> {
    const t = c.state;
    const chat = t.chat;
    if (!chat.awaiting) return undefined;
    const intent = this.primaryIntent(c.u)?.intent;

    if (chat.awaiting === 'contact') {
      if (t.captured.name || t.captured.phone || t.captured.email) return this.afterContact(c);
      if (intent === 'deny' || /\b(rather not|no thanks|not now|dont want to|do not want to)\b/i.test(c.text.replace(/'/g, ''))) {
        chat.awaiting = undefined;
        chat.purpose = undefined;
        t.kind = 'contact_declined';
        return { text: "No problem — you don't have to share anything. Is there anything else I can help with?" };
      }
      // A different time picked while we ask for details.
      const repick = chat.purpose === 'booking' ? this.pickSlot(c.text, c.u, chat.offered ?? []) : undefined;
      if (repick && repick.startsAt !== chat.chosen?.startsAt) {
        chat.chosen = repick;
        return this.afterSlotChosen(c);
      }
      if (this.isQuestion(c.u)) return undefined;
      chat.contactAsks++;
      if (chat.contactAsks > 2) {
        chat.awaiting = undefined;
        const phone = this.phone();
        return { text: `No worries.${phone ? ` You can always reach us at ${phone}.` : ''} Is there anything else I can help with?` };
      }
      t.askedContact = true;
      t.kind = 'contact_reprompt';
      return {
        text: "Sorry, I didn't catch that. Could you send your name and the best phone number or email to reach you?",
        ui: { form: { fields: this.missingContact(chat.contact), submit: 'Send' } },
      };
    }

    if (chat.awaiting === 'slot') {
      const pick = this.pickSlot(c.text, c.u, chat.offered ?? []);
      if (pick) {
        chat.chosen = pick;
        return this.afterSlotChosen(c);
      }
      if (MORE_TIMES.test(c.text)) return this.moreSlots(c);
      if (c.u.date || c.u.time) return this.offerSlots(c, this.preference(c.u));
      if (intent === 'deny') {
        chat.offered = [];
        chat.awaiting = undefined;
        t.kind = 'slots_declined';
        return { text: 'No problem. What day or time would suit you better? For example "Thursday afternoon" or "next Monday at 10am".' };
      }
      if (this.isQuestion(c.u)) return undefined;
      t.offeredSlots = true;
      const gotDetails = t.captured.name || t.captured.phone || t.captured.email;
      const first = firstName(chat.contact.name);
      return {
        text: gotDetails
          ? `Thanks${first ? `, ${first}` : ''} — I've noted your details. Which of those times works for you? Reply with the number, or tell me another day or time.`
          : 'Which of those times works for you? Reply with the number, or tell me another day or time.',
        suggestions: (chat.offered ?? []).map((s) => s.label),
        ui: { slots: chat.offered },
      };
    }

    // price_service: the visitor was asked which treatment they want a price for.
    chat.awaiting = undefined;
    const service = c.u.values.service?.[0];
    return service ? this.priceReply(c, service) : undefined;
  }

  /** Contact details shared without being asked: acknowledge and offer the next step. */
  private volunteered(c: Ctx): ChatReply | undefined {
    const t = c.state;
    if (!(t.captured.phone || t.captured.email) || t.chat.awaiting) return undefined;
    const rest = stripPersonalDetails(c.text, c.u.name ?? t.chat.contact.name).replace(
      /\b(my|name|is|number|phone|email|mail|it's|its|im|i'm|and|at|here|you can reach me|reach me|call me|on)\b/gi,
      ' '
    );
    if (rest.trim().split(/\s+/).filter((w) => w.length > 1).length > 2) return undefined;
    t.kind = 'contact_saved';
    this.offer(t.chat, 'booking');
    const first = firstName(t.chat.contact.name);
    return {
      text: `Thanks${first ? `, ${first}` : ''} — I've noted your details. Would you like me to find you an appointment, or is there something I can answer first?`,
      suggestions: ['Find an appointment', 'I have a question'],
    };
  }

  /** "Sarah Connor" on its own: say hello and carry on. */
  private introduce(c: Ctx): ChatReply | undefined {
    const t = c.state;
    if (!t.captured.name || t.captured.phone || t.captured.email || t.chat.awaiting) return undefined;
    const rest = stripPersonalDetails(c.text, t.chat.contact.name)
      .replace(/\b(hi|hello|hey|my name is|my name's|name is|i'm|im|i am|this is|it's|its|here|call me)\b/gi, ' ')
      .replace(/[^a-z]+/gi, ' ')
      .trim();
    if (rest) return undefined;
    t.kind = 'introduce';
    const first = firstName(t.chat.contact.name);
    return {
      text: `Nice to meet you, ${first}! How can I help you today?`,
      suggestions: ['Book an appointment', ...this.topServices(2)],
    };
  }

  private async byIntent(c: Ctx): Promise<ChatReply | undefined> {
    const t = c.state;
    const chat = t.chat;
    const text = c.text.trim();
    const service = c.u.values.service?.[0];

    // "Good morning!" is a greeting, not a question about morning headaches.
    if (GREETING_ONLY.test(text)) return this.greet(c);
    // "Are you open Sunday?" is about opening hours, not booking.
    if (HOURS_Q.test(text) && !TREATMENT_HOURS.test(text)) return this.hoursReply(c);

    const p = this.primaryIntent(c.u);
    // "I'd like to get my teeth cleaned next week": a wish plus a date means booking.
    const soon = /\b(?:as soon as possible|asap|soon|urgently|right away|this week|earliest)\b/i.test(text);
    if ((!p || SOCIAL_INTENTS.has(p.intent) || p.intent === 'procedure_info') && (c.u.date || c.u.time?.time || soon) && WISH.test(text) && !c.u.question) {
      return this.startBooking(c, service);
    }
    if (!p) return undefined;
    switch (p.intent) {
      case 'book': {
        // "Do wisdom teeth need to come out?" is not a booking request.
        if (!BOOKING_WORDS.test(text) && !c.u.date && !c.u.time && !(p.confidence >= 0.75 && !c.u.question)) return undefined;
        // Nor is "how long is a veneer appointment?" or "how much is a consultation?".
        const info = c.u.aspects.filter((a) => a !== 'children' && a !== 'candidacy');
        if (c.u.question && info.length && !/\b(?:book|schedule|available|availability|openings?|slots?|come in|get in|fit me in|be seen|earliest)\b/i.test(text)) return undefined;
        // "Do you have Saturday appointments?" is a question the clinic may have answered itself.
        const hit = this.strongHit(c.u.knowledge);
        const article = hit?.doc.data;
        const asking = /\?\s*$|^(do|does|are|is|can|could|will|what|when|how)\b/i.test(text);
        if (article && hit.coverage >= 0.8 && asking && (article.category === 'POLICY' || article.category === 'FAQ')) {
          const answer = this.answerArticle(c, article, text);
          this.offer(chat, 'booking');
          chat.bookingService = service ?? chat.service ?? 'Consultation';
          return { ...answer, text: `${answer.text} Would you like me to find you a time?`, suggestions: ['Yes, find a time', 'No thanks'] };
        }
        return this.startBooking(c, service);
      }
      case 'reschedule': {
        t.kind = 'reschedule';
        const phone = this.phone();
        this.offer(chat, 'callback');
        const policy = this.bySlug.get('cancellation-policy');
        if (policy) t.sources.push(policy);
        return {
          text: `${policy ? `${policy.summary} ` : ''}To change or cancel an existing appointment, please ${phone ? `call us at ${phone}` : 'contact the office'}${this.clinic.email ? ` or email ${this.clinic.email}` : ''}. Or I can have the team get in touch with you — would you like that?`,
          suggestions: ['Yes, contact me', 'No thanks'],
        };
      }
      case 'price': {
        // "How much toothpaste should a toddler use?" is not about money.
        if (!c.u.aspects.includes('cost') && this.strongHit(c.u.knowledge)) return undefined;
        if (!service) {
          const policy = this.policyAnswer(c);
          if (policy) return policy;
          // "What's the cheapest way to replace teeth?" — the articles compare costs.
          const general = this.costAnswer(c);
          if (general) return general;
        }
        return this.priceReply(c, service ?? chat.service);
      }
      case 'financing':
        chat.signals.financing = true;
        return this.policyReply(c, 'payment-and-financing', 'payment and financing', 'financing');
      case 'insurance': {
        chat.signals.insurance = true;
        let reply = this.policyReply(c, 'insurance', 'insurance', 'insurance');
        // "Does Medicare cover dental?": general insurance facts answer what the clinic's own policy doesn't.
        const general = this.generalFact(c, 'dental-insurance-basics', reply.text);
        if (general) reply = { ...reply, text: `${reply.text} ${general}` };
        // "Does insurance pay for whitening?" deserves a direct word on that treatment first.
        if (service && service !== 'Emergency visit' && /\b(cover|covers|covered|pay|pays|paid)\b/i.test(text)) {
          const lead = COSMETIC.has(service)
            ? `${service} is usually considered cosmetic, so most dental plans don't cover it.`
            : `Many plans cover part of the cost of ${lower(service)}, depending on your benefits.`;
          return { ...reply, text: `${lead} ${reply.text}` };
        }
        return reply;
      }
      case 'hours':
        return TREATMENT_HOURS.test(text) || (service && !/\b(open|close|closed|hours)\b/i.test(text)) ? undefined : this.hoursReply(c);
      case 'location':
        return this.locationReply(c);
      case 'human':
        return this.handoff(c);
      case 'about_bot':
        t.kind = 'about';
        return {
          text: `I'm ${this.clinic.name}'s virtual assistant — an automated helper, not a person. I can answer questions about treatments, costs, insurance and opening hours, and request appointments for you. I can't diagnose or give medical advice; for that you'll need an exam with the dentist. If you'd like to talk to a person, I can have the team contact you.`,
          suggestions: ['Book an appointment', 'Talk to the team'],
        };
      case 'new_patient':
        // "What happens at a checkup?" is about the treatment, not about joining the practice.
        if (service && !/\b(new|first|register|sign up|switch|join|never been)\b/i.test(text)) return undefined;
        if (c.u.aspects.includes('cost')) return this.newPatientFees(c);
        return this.newPatientReply(c);
      case 'services':
        return service ? undefined : this.servicesReply(c);
      case 'emergency':
        // "Do you see emergency patients?" is a question, not an emergency.
        if (CAPABILITY.test(text) || /^(?:what|how|when|is|are)\b/i.test(text)) {
          t.kind = 'emergency_info';
          this.offer(chat, 'booking');
          chat.bookingService = 'Emergency visit';
          const phone = this.phone();
          return {
            text: `Yes — ${this.clinic.name} sees emergency patients and keeps time for urgent visits.${phone ? ` If you're in pain now, call us at ${phone}.` : ''} Would you like me to find the earliest available appointment?`,
            suggestions: ['Yes, find a time', 'No thanks'],
          };
        }
        // Real emergencies are caught by the safety rules; only act on a clear signal here.
        return p.confidence >= 0.6 ? this.urgentBooking(c) : undefined;
      case 'contact_info':
        return this.contactInfo(c);
      case 'team':
        return this.policyTopic(c, 'meet-the-team', 'team', "I don't have details about our dentists on hand. You'll meet the team at your first visit");
      case 'walk_in':
        // "Do you do same day crowns?" is about crowns.
        if (service && !/\b(walk|appointments?|show up)\b/i.test(text)) return undefined;
        return this.policyTopic(c, 'appointments-and-walk-ins', 'walk_in', 'We see patients by appointment, so booking ahead is best');
      case 'greet':
        return this.strongHit(c.u.knowledge) || service ? undefined : this.greet(c);
      case 'smalltalk':
        if (this.strongHit(c.u.knowledge) || service) return undefined;
        t.kind = 'smalltalk';
        return {
          text: /\bname\b/i.test(text)
            ? `I'm the virtual assistant for ${this.clinic.name}. How can I help you today?`
            : "I'm doing well, thanks for asking! How can I help you today?",
          suggestions: ['Book an appointment', ...this.topServices(2)],
        };
      case 'joke':
        t.kind = 'joke';
        return { text: `${choose(JOKES, `${chat.turn}:${chat.visitorMessages}`)} Is there anything dental I can help you with today?` };
      case 'offtopic':
        if (this.strongHit(c.u.knowledge) || service) return undefined;
        t.kind = 'offtopic';
        return {
          text: `I'm ${this.clinic.name}'s virtual assistant, so I can only help with dental questions — treatments, prices, insurance, opening hours and appointments. What can I help you with?`,
          suggestions: ['Book an appointment', ...this.topServices(2)],
        };
      case 'complaint':
        t.kind = 'complaint';
        this.offer(chat, 'callback');
        return {
          text: "I'm sorry about that — I'm an automated assistant and I don't always get it right. Could you try asking another way, or would you like someone from the team to contact you?",
          suggestions: ['Talk to the team', 'Book an appointment'],
        };
      case 'compliment':
        t.kind = 'thanks';
        return { text: "Thank you — happy to help! Is there anything else you'd like to know?" };
      case 'thanks':
        t.kind = 'thanks';
        return {
          text: chat.appointment
            ? `You're welcome! We look forward to seeing you on ${chat.appointment.label}.`
            : "You're welcome! Is there anything else I can help with?",
        };
      case 'bye':
        t.kind = 'bye';
        return {
          text: `Thanks for chatting with ${this.clinic.name}!${chat.appointment ? ` See you on ${chat.appointment.label}.` : ''} Have a great day.`,
        };
      case 'affirm':
        if (this.isRealQuestion(c)) return undefined;
        return this.affirm(c);
      case 'deny':
        // "Is flossing really necessary?" is a question, not a "no".
        if (this.isRealQuestion(c)) return undefined;
        t.kind = 'deny';
        if (chat.pendingOffer) {
          chat.pendingOffer = undefined;
          return { text: 'No problem. Is there anything else you would like to know?' };
        }
        return { text: "Okay! Just let me know if there's anything I can help with." };
      default:
        return undefined; // procedure_info, diagnosis (low confidence) -> knowledge
    }
  }

  private knowledge(c: Ctx): ChatReply | undefined {
    const t = c.state;
    const chat = t.chat;
    const query = stripPersonalDetails(c.text, c.u.name ?? chat.contact.name);
    // "Can you fix gaps without braces?" — braces are ruled out, not asked about.
    const ruledOut = new Set((c.u.matches.service ?? []).filter((m) => negated(query, m.text)).map((m) => m.value));
    // "What age should my child get braces?" is about braces; "my child" only says who for.
    const qualifiers = new Set((c.u.matches.service ?? []).filter((m) => PEOPLE.test(m.text)).map((m) => m.value));
    const named = (c.u.values.service ?? []).filter((s) => !ruledOut.has(s));
    const services = named.some((s) => !qualifiers.has(s)) ? named.filter((s) => !qualifiers.has(s)) : named;
    if (services.length >= 2 && COMPARE.test(query)) return this.compare(c, services[0], services[1]);

    const remedy = c.u.aspects.includes('remedy');
    const capability = CAPABILITY.test(query) && services.length && !remedy ? services[0] : undefined;
    const context = services.length ? undefined : this.contextArticle(c);
    const prefer = new Map<string, number>();
    for (const s of services) {
      for (const a of this.byService.get(s) ?? []) prefer.set(a.id, a.category === 'PROCEDURE' || a.category === 'FAQ' || a.category === 'CONDITION' ? 0.9 : 0.5);
    }
    if (context) prefer.set(context.id, 1);
    // "I'm terrified of the dentist but need a cleaning": the fear comes first.
    const anxiety = ANXIOUS.test(query) ? this.bySlug.get('dental-anxiety-and-sedation') : undefined;
    if (anxiety) prefer.set(anxiety.id, 2);
    const strong = this.strongHit(c.u.knowledge);
    if (!prefer.size && !strong && !((c.u.knowledge[0]?.coverage ?? 0) >= 0.3)) return undefined;

    const topicWords = (c.u.matches.service ?? []).map((m) => m.text);
    const specific = this.isSpecific(query, topicWords);
    const aspects = c.u.aspects.length ? c.u.aspects : specific ? [] : ['definition'];
    // Named treatments narrow the search to their own articles ("will a crown look natural?" is not about implants).
    // "Is fluoride safe for kids?" is about fluoride: who it's for only steers the search, it doesn't limit it.
    const peopleOnly = services.length > 0 && services.every((s) => qualifiers.has(s)) && specific;
    const within = context && !anxiety ? [context.id] : services.length && !peopleOnly ? this.articlesAbout(c, services, ruledOut, anxiety) : undefined;
    // Questions about a group of people ("I'm pregnant, can I...") also read the article written for them.
    const groups: string[] = aspects.filter((a) => a === 'pregnancy' || a === 'children');
    const groupDocs = new Map<string, number>();
    if (within && groups.length && !context) {
      for (const doc of this.index.all()) {
        const about = this.reader.docAspects(doc).filter((a) => groups.includes(a));
        if (!about.length || within.includes(doc.id)) continue;
        within.push(doc.id);
        // Pregnancy changes what is safe, so its article speaks with authority; children's articles are background.
        groupDocs.set(doc.id, about.includes('pregnancy') ? 1 : 0.6);
      }
    }
    for (const id of within ?? []) {
      if (prefer.has(id)) continue;
      // An article about the condition named ("gaps between teeth") outranks the treatments it was tagged with;
      // articles only added for who is asking ("children") stay in the background.
      const category = this.index.get(id)?.data?.category;
      prefer.set(id, groupDocs.get(id) ?? (category === 'CONDITION' || category === 'FAQ' ? 1 : 0.6));
    }
    const excluded = new Set([...ruledOut].flatMap((s) => (this.byService.get(s) ?? []).map((a) => a.id)));
    // "I want a hollywood smile" asks about the treatment as a whole: the words just name it,
    // and "need" in "I need a filling" isn't something to look for in the answer.
    const interest = INTEREST.exec(query);
    const asked = interest ? query.slice(interest[0].length) : query;
    const request = {
      prefer,
      aspects,
      phrases: interest ? topicWords : undefined,
      exclude: new Set(chat.said),
      boost: (doc: SearchDocument<Article>, asked: string[]) => (excluded.has(doc.id) ? -3 : this.categoryBoost(doc, asked, query)),
      candidates: 5,
    };
    let answer = this.reader.answer(asked, { ...request, within });
    if (!answer) return undefined;
    // The treatment's own articles don't cover it, but a general one might ("I'm pregnant, can I get a filling?").
    if (within && !context && aspects.length && !answer.onAspect) {
      const wider = this.reader.answer(asked, request);
      const names = topicWords.flatMap((w) => terms(w));
      if (wider?.onAspect && wider.sentences.some((x) => terms(x.text).some((w) => names.includes(w)))) answer = wider;
    }
    if (!prefer.size && answer.confidence < 0.45) return undefined;
    // A specific question the articles don't cover ("do implants set off metal detectors?").
    let uncovered = c.u.question && specific && !c.u.aspects.length && answer.match < 0.25 && !capability && !anxiety;
    // "Should I stop my blood thinner before an extraction?": the extraction articles don't say, another article does.
    if (uncovered && within) {
      const wider = this.reader.answer(asked, { ...request, prefer: new Map() });
      if (wider && !within.includes(wider.doc.id) && wider.match >= 0.3) {
        answer = wider;
        uncovered = false;
      }
    }
    return this.answerFrom(c, answer, { capability, remedy, uncovered });
  }

  /** Articles about the treatments named in the message: their own, ones titled after them, ones tagged with the phrase used. */
  private articlesAbout(c: Ctx, services: string[], ruledOut: Set<string>, extra?: Article): string[] {
    const ids = new Set<string>();
    for (const s of services) for (const a of this.byService.get(s) ?? []) ids.add(a.id);
    const matches = (c.u.matches.service ?? []).filter((m) => !ruledOut.has(m.value));
    // A service's own name is matched by its distinctive words ("Gum contouring" isn't about every "gum" article).
    const keys = [...matches.map((m) => terms(m.text)), ...services.map((s) => terms(s).filter((x) => !GENERIC_TITLE.has(x) && !BROAD_NAME.has(x)))];
    for (const doc of this.index.all()) {
      const title = new Set(terms(doc.title ?? ''));
      const tags = (doc.tags ?? []).map((tag) => new Set(terms(tag)));
      for (const k of keys) {
        if (!k.length) continue;
        const titled = k.some((x) => title.has(x) && !GENERIC_TITLE.has(x));
        // A single word ("crown") appears in too many tags; a phrase ("missing tooth") is specific.
        const tagged = k.length >= 2 && tags.some((tag) => k.every((x) => tag.has(x)));
        if (titled || tagged) ids.add(doc.id);
      }
    }
    for (const s of ruledOut) for (const a of this.byService.get(s) ?? []) ids.delete(a.id);
    if (extra) ids.add(extra.id);
    return [...ids];
  }

  private fallback(c: Ctx): ChatReply {
    const t = c.state;
    const chat = t.chat;
    t.unanswered = true;
    t.kind = 'fallback';
    chat.misses++;
    const n = bareNumber(c.text);
    if (n !== undefined) {
      t.kind = 'clarify';
      return {
        text: `Sorry — I'm not sure what “${c.text.trim()}” refers to. Could you tell me a little more? For example, I can help with treatments, prices, insurance, opening hours or booking a visit.`,
        suggestions: ['Book an appointment', ...this.topServices(2)],
      };
    }
    if (CAPABILITY.test(c.text) && !c.u.knowledge.length) {
      this.offer(chat, 'callback');
      return {
        text: `I don't see that among the treatments listed for ${this.clinic.name}, so I'd rather not guess. I can ask the team to get back to you about it — would you like that?`,
        suggestions: ['Yes, ask the team', 'What services do you offer?'],
      };
    }
    const [first, second] = c.u.knowledge;
    if (first?.doc.data && first.coverage >= 0.34) {
      // Two close candidates: let the visitor choose.
      if (second?.doc.data && second.score >= first.score * 0.8 && second.doc.data.slug !== first.doc.data.slug) {
        return {
          text: `I want to make sure I answer the right thing — do you mean ${lower(first.doc.data.title)} or ${lower(second.doc.data.title)}?`,
          suggestions: [first.doc.data.title, second.doc.data.title],
        };
      }
      this.offer(chat, 'topic');
      chat.suggestedTopic = first.doc.data.slug;
      return { text: `I'm not completely sure I understood. Are you asking about ${lower(first.doc.data.title)}?`, suggestions: ['Yes', 'No'] };
    }
    this.offer(chat, 'callback');
    return {
      text:
        chat.misses > 1
          ? "Sorry, I still don't have a good answer for that. Would you like someone from the team to get back to you?"
          : "I'm not sure about that one, and I'd rather not guess. I can help with treatments, prices, insurance, opening hours or booking a visit — or I can have someone from the team get back to you. Would you like that?",
      suggestions: ['Talk to the team', 'Book an appointment', 'Opening hours'],
    };
  }

  // ---------------------------------------------------------------- answers

  /** Turn a reader answer into a reply: "Yes, we offer X." + the sentences that answer the question. */
  private answerFrom(
    c: Ctx,
    ans: ReadAnswer<Article>,
    opts: { capability?: string; remedy?: boolean; uncovered?: boolean } = {}
  ): ChatReply {
    const t = c.state;
    const chat = t.chat;
    const a = ans.doc.data!;
    t.kind = opts.capability ? 'capability' : 'knowledge';
    this.use(t, a);
    if (a.service && a.service !== 'Emergency visit') {
      t.ctaService = a.service;
      if (!c.u.values.service?.length) chat.service = a.service;
    } else {
      t.ctaService = null;
    }
    // "My gums bleed" describes a problem; "will whitening make my teeth sensitive?" asks about one.
    const symptom = SYMPTOM.test(c.text) && !/^(?:will|would|does|do|can|could|is|are|should|how|what)\b/i.test(c.text.trim());
    if (symptom && a.category !== 'PROCEDURE') t.ctaService = 'Dental exam';

    const parts: string[] = [];
    if (opts.capability) parts.push(`Yes, we offer ${OFFER_PHRASES[opts.capability] ?? lower(opts.capability)}.`);
    else if (symptom) parts.push('Sorry to hear that.');

    const offAspect = ans.aspects.length && !ans.onAspect && ans.match < 0.5 && !ans.aspects.includes('definition');
    const topic = lower(a.title);
    if (opts.uncovered) {
      t.unanswered = true;
      this.offer(chat, 'callback');
      return {
        text: `I don't have information about that for ${topic}, and I'd rather not guess. The team can answer it — would you like me to ask them to get back to you?`,
        suggestions: ['Yes, ask the team', 'No thanks'],
      };
    }
    if (offAspect) {
      const phrase = ASPECT_PHRASES[ans.aspects[0]] ?? 'that';
      parts.push(`I don't have specific details on ${phrase} for ${topic}.`);
      const general = this.generalAnswer(ans.aspects[0], ans.doc.id);
      if (general) parts.push(`In general, ${lowerFirst(general)}`);
      parts.push('The dentist can go over it with you at a consultation.');
      t.unanswered = true;
    } else {
      let body = ans.sentences.map((s) => s.text).join(' ');
      if (ans.repeated) body = `As I mentioned, ${lowerFirst(body)}`;
      // "Can you fix gaps?" -> "Yes — small gaps can often be closed with bonding."
      else if (opts.remedy && CAPABILITY.test(c.text) && ans.onAspect) body = `Yes — ${lowerFirst(body)}`;
      parts.push(body);
      for (const s of ans.sentences) chat.said = [...(chat.said ?? []).filter((k) => k !== s.key), s.key].slice(-40);
    }
    // "Do you do cleanings on Saturdays?" — answer the day too.
    const weekday = weekdayIn(c.text);
    if (opts.capability && (c.u.date || weekday !== undefined || /\bweekends?\b/i.test(c.text))) {
      const date = c.u.date?.date ?? nextWeekday(t.now, this.clinic.timezone, weekday ?? 6);
      const day = describeDay(this.clinic.hours, date);
      const name = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      parts.push(day === 'closed' ? `Please note we're closed on ${name}s.` : `On ${name}s we're ${day}.`);
    }
    return { text: parts.join(' ') };
  }

  /** A general fact for an aspect when the topic's article doesn't cover it (e.g. numbing for "does it hurt?"). */
  private generalAnswer(aspect: string, excludeId: string): string | undefined {
    const sources: Record<string, string> = { pain: 'dental-anxiety-and-sedation' };
    const a = this.bySlug.get(sources[aspect] ?? '');
    if (!a || a.id === excludeId) return undefined;
    return this.reader.answer(aspect === 'pain' ? 'numbing anaesthetic painful' : aspect, { within: [a.id], aspects: [aspect], max: 1 })?.sentences[0]?.text;
  }

  /** "Veneers or bonding?" — one line per option, preferring an article that compares them. */
  private compare(c: Ctx, a: string, b: string): ChatReply {
    const t = c.state;
    t.kind = 'compare';
    // Phrases that name each option: the service name without generic words, and its first tags.
    const keys = (service: string): string[][] => {
      const main = this.mainArticle(service);
      return [terms(service).filter((x) => !GENERIC_TITLE.has(x) && x !== 'treatment' && x !== 'remov'), ...(main?.tags.slice(0, 2) ?? []).map((tag) => terms(tag))].filter(
        (k) => k.length
      );
    };
    const ka = keys(a);
    const kb = keys(b);
    const mentions = (text: string, k: string[][]) => {
      const words = new Set(terms(text));
      return k.some((phrase) => phrase.every((x) => words.has(x)));
    };
    // An article (not about either service itself) that discusses both.
    // An article whose opening compares the options ("a missing tooth can be replaced with an implant, a bridge or a denture").
    const shared = this.index.all().find((d) => {
      const art = d.data!;
      if (art.service === a || art.service === b || art.category === 'POLICY') return false;
      if (!/\b(options|alternatives|choosing|choice|versus|vs|difference|compar)/i.test(art.title)) return false;
      return mentions(art.summary, ka) && mentions(art.summary, kb);
    });
    const line = (service: string, own: string[][], other: string[][]) => {
      const main = this.mainArticle(service);
      const fromShared = shared && this.reader.sentencesOf(shared).find((s) => mentions(s.text, own) && !mentions(s.text, other));
      if (fromShared) {
        t.sources.push(shared.data!);
        return fromShared.text;
      }
      if (!main) return '';
      this.use(t, main);
      const doc = this.index.get(main.id)!;
      const sents = this.reader.sentencesOf(doc);
      const vs = sents.find((s) => s.index > 0 && mentions(s.text, other));
      const lasting = sents.find((s) => s.aspects.includes('longevity') && s.index > 0);
      return [sents[0]?.text, vs?.text ?? lasting?.text].filter(Boolean).join(' ');
    };
    const price = (service: string) => {
      const range = this.priceRange(this.mainArticle(service));
      return range ? ` Typical cost here: ${range}.` : '';
    };
    t.ctaService = undefined;
    return {
      text: [
        "Here's how they compare:",
        `• ${a}: ${line(a, ka, kb)}${price(a)}`,
        `• ${b}: ${line(b, kb, ka)}${price(b)}`,
        'Which is best depends on your teeth and goals, so the dentist will recommend the right option at a consultation.',
      ].join('\n'),
    };
  }

  private answerArticle(c: Ctx, a: Article, query: string): ChatReply {
    const t = c.state;
    t.kind = 'knowledge';
    t.ctaService = a.service && a.service !== 'Emergency visit' ? a.service : null;
    this.use(t, a);
    if (a.service && !c.u.values.service?.length && a.service !== 'Emergency visit') t.chat.service = a.service;
    let text = a.summary;
    if (query && this.isSpecific(query, [])) {
      const ans = this.reader.answer(query, { within: [a.id], exclude: new Set(t.chat.said) });
      if (ans) text = ans.sentences.map((s) => s.text).join(' ');
    }
    return { text };
  }

  /** A price-shaped question the clinic answered in a policy ("is the consultation free?"). */
  private policyAnswer(c: Ctx): ChatReply | undefined {
    const hit = this.strongHit(c.u.knowledge);
    const a = hit?.doc.data;
    if (!a || hit.coverage < 0.6 || (a.category !== 'POLICY' && a.category !== 'FAQ')) return undefined;
    // "How much does it cost?" matching a "$50 fee" sentence is not an answer: it must share a real subject.
    if (!hit.matched.some((term) => !COST_TERMS.has(term))) return undefined;
    const ans = this.reader.answer(c.text, { within: [a.id], exclude: new Set(c.state.chat.said) });
    if (!ans) return undefined;
    c.state.kind = 'knowledge';
    c.state.sources.push(a);
    c.state.ctaService = undefined;
    return { text: ans.sentences.map((s) => s.text).join(' ') };
  }

  /** A question that happens to contain "yes"/"no"-like words but asks something the knowledge base covers. */
  private isRealQuestion(c: Ctx): boolean {
    return c.u.question && c.text.trim().split(/\s+/).length >= 4 && (c.u.knowledge[0]?.coverage ?? 0) >= 0.25;
  }

  /** Price questions without a treatment that the articles answer ("cheapest way to replace teeth"). */
  private costAnswer(c: Ctx): ChatReply | undefined {
    // It must be about something besides money ("how much does it cost?" needs a treatment first).
    if (!this.strongHit(c.u.knowledge) || !this.index.analyze(c.text).original.some((t) => !COST_TERMS.has(t))) return undefined;
    const ans = this.reader.answer(c.text, { aspects: ['cost'], exclude: new Set(c.state.chat.said), candidates: 4 });
    if (!ans || !ans.onAspect || ans.match < 0.3) return undefined;
    const subject = this.index.analyze(c.text).original.filter((t) => !COST_TERMS.has(t));
    if (!ans.sentences.some((x) => terms(x.text).some((t) => subject.includes(t)))) return undefined;
    return this.answerFrom(c, ans);
  }

  /** "What are your fees for a new patient exam?" */
  private newPatientFees(c: Ctx): ChatReply {
    const t = c.state;
    const parts: string[] = [];
    const policy = this.bySlug.get('new-patients');
    if (policy) {
      const line = this.reader.answer(c.text, { within: [policy.id], aspects: ['cost'], max: 1 });
      if (line?.onAspect) {
        parts.push(line.sentences[0].text);
        t.sources.push(policy);
      }
    }
    const exam = this.mainArticle('Check-up and cleaning');
    const range = this.priceRange(exam);
    if (exam && range) {
      parts.push(`A routine exam and cleaning is typically ${range}, and insurance often covers it.`);
      t.sources.push(exam);
    }
    t.kind = 'new_patient';
    t.ctaService = 'New patient exam';
    t.chat.signals.price = true;
    return parts.length ? { text: parts.join(' ') } : this.priceReply(c, undefined);
  }

  private contactInfo(c: Ctx): ChatReply {
    const t = c.state;
    t.kind = 'contact_info';
    const { phone, email, website, address } = this.clinic;
    const bits = [
      phone ? `call us at ${formatPhone(phone)}` : '',
      email ? `email ${email}` : '',
      website ? `visit ${website}` : '',
    ].filter(Boolean);
    const actions: NonNullable<ReplyUi['actions']> = [];
    if (phone) actions.push({ label: `Call ${formatPhone(phone)}`, href: `tel:${phone}`, kind: 'call' });
    if (email) actions.push({ label: 'Email us', href: `mailto:${email}`, kind: 'email' });
    if (!bits.length) return { text: 'You can reach the team right here — would you like someone to contact you?', suggestions: ['Talk to the team'] };
    return {
      text: `You can ${joinList(bits, 'or')}.${address ? ` We're at ${address}.` : ''} Or I can book you in right here.`,
      ui: { actions },
      suggestions: ['Book an appointment', 'Opening hours'],
    };
  }

  /** Answer from a clinic policy article if it's filled in, otherwise say so honestly and offer the team. */
  private policyTopic(c: Ctx, slug: string, kind: string, fallback: string): ChatReply {
    const t = c.state;
    t.kind = kind;
    const a = this.bySlug.get(slug);
    if (a) {
      const ans = this.reader.answer(c.text, { within: [a.id], exclude: new Set(t.chat.said) });
      if (ans) {
        t.sources.push(a);
        return { text: ans.sentences.map((s) => s.text).join(' ') };
      }
    }
    this.offer(t.chat, 'callback');
    return {
      text: `${fallback} — or I can ask someone from the team to get back to you. Would you like that?`,
      suggestions: ['Yes, ask the team', 'Book an appointment'],
    };
  }

  /** "How much to fix a chipped tooth?" — the cost depends on the repair, so list what each option costs. */
  private conditionPrice(c: Ctx): ChatReply | undefined {
    const match = c.u.matches.service?.[0];
    const service = match?.value;
    const list = service ? (this.byService.get(service) ?? []) : [];
    const key = match ? terms(match.text) : [];
    const article = list.find((a) => a.tags.some((tag) => key.every((k) => terms(tag).includes(k)))) ?? this.strongHit(c.u.knowledge)?.doc.data;
    if (!article || (article.category !== 'EMERGENCY' && article.category !== 'CONDITION')) return undefined;
    const options = this.dictionary
      .find(`${article.summary} ${article.body}`)
      .map((m) => this.mainArticle(m.value))
      .filter((a): a is Article => !!a && a.service !== 'Emergency visit' && !!this.priceRange(a));
    if (!options.length) return undefined;
    const t = c.state;
    t.kind = 'price';
    t.chat.signals.price = true;
    t.sources.push(article);
    const how = this.reader.answer(`${c.text} repair fix treatment`, { within: [article.id], aspects: ['remedy'], max: 1 })?.sentences[0]?.text;
    const costs = options.slice(0, 3).map((a) => `${lower(a.service!)} ${this.priceRange(a)}`);
    const exam = service === 'Emergency visit' ? this.priceRange(this.mainArticle('Emergency visit')) : undefined;
    t.ctaService = 'Dental exam';
    return {
      text: [
        "The cost depends on what's needed to fix it.",
        how ?? '',
        `Typical costs here: ${joinList(costs)}.`,
        exam ? `An emergency exam is ${exam}.` : '',
        'The dentist will confirm the right option and exact cost after an exam.',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  private priceRange(a: Article | undefined): string | undefined {
    if (!a) return undefined;
    const range =
      a.priceMin != null && a.priceMax != null
        ? a.priceMin === a.priceMax
          ? money(a.priceMin)
          : `${money(a.priceMin)}–${money(a.priceMax)}`
        : a.priceMin != null
          ? `from ${money(a.priceMin)}`
          : a.priceMax != null
            ? `up to ${money(a.priceMax)}`
            : undefined;
    return range && a.priceUnit ? `${range} ${a.priceUnit}` : range;
  }

  private priceReply(c: Ctx, service: string | undefined): ChatReply {
    const t = c.state;
    t.kind = 'price';
    t.chat.signals.price = true;
    if (!service) {
      t.chat.awaiting = 'price_service';
      const examples = this.topServices(4);
      return {
        text: `Happy to help with pricing. Which treatment are you asking about? For example ${joinList(examples.map(lower), 'or')}.`,
        suggestions: examples,
      };
    }
    const condition = service === 'Emergency visit' || !this.priceRange(this.mainArticle(service)) ? this.conditionPrice(c) : undefined;
    if (condition) return condition;
    t.chat.service = service;
    t.ctaService = service;
    const a = this.mainArticle(service);
    if (a) this.use(t, a);
    const range = this.priceRange(a);
    const parts = [
      range
        ? `At ${this.clinic.name}, the typical cost for ${lower(service)} is ${range}. Your exact cost depends on your exam and treatment plan${COSMETIC.has(service) ? '' : ', and insurance may cover part of it'}.`
        : `The cost of ${lower(service)} depends on your individual case, so ${this.clinic.name} gives you an exact quote after an exam rather than guessing.`,
    ];
    const financing = this.bySlug.get('payment-and-financing');
    if (financing) {
      const line = this.reader.answer('monthly payment plans financing', { within: [financing.id], max: 1 })?.sentences[0]?.text;
      if (line) parts.push(line);
    }
    return { text: parts.join(' ') };
  }

  /** A sentence from a general article that answers a word of the question the reply so far doesn't touch. */
  private generalFact(c: Ctx, slug: string, already: string): string | undefined {
    const a = this.bySlug.get(slug);
    if (!a) return undefined;
    const ans = this.reader.answer(c.text, { within: [a.id], max: 1, exclude: new Set(c.state.chat.said) });
    const sentence = ans?.sentences[0];
    if (!sentence || ans.match < 0.3) return undefined;
    const have = new Set(terms(already));
    const found = new Set(terms(sentence.text));
    if (!terms(c.text).some((t) => !have.has(t) && found.has(t))) return undefined;
    c.state.sources.push(a);
    return sentence.text;
  }

  private policyReply(c: Ctx, slug: string, topic: string, kind: string): ChatReply {
    const t = c.state;
    t.kind = kind;
    const a = this.bySlug.get(slug);
    if (a) {
      t.sources.push(a);
      const extra = this.index.passages(a.body, c.text, 2, a).filter((s) => !a.summary.includes(s));
      const relevant = extra.filter((s) => terms(s).some((x) => this.index.analyze(c.text).weights.has(x)));
      return { text: [a.summary, ...relevant].join(' ') };
    }
    this.offer(t.chat, 'callback');
    return {
      text: `I don't have ${this.clinic.name}'s ${topic} details on hand, and I don't want to guess. Would you like someone from the team to get back to you about it?`,
      suggestions: ['Yes, please', 'No thanks'],
    };
  }

  private hoursReply(c: Ctx): ChatReply {
    const t = c.state;
    t.kind = 'hours';
    const { hours, timezone } = this.clinic;
    const week = describeHours(hours);
    const yesNo = /^(?:so |and |hi |hey )?(?:are|r|is) (?:you|u|the (?:office|clinic|practice))(?: guys)? (?:open|closed)\b/i.test(c.text.trim());
    const asksClosed = /\bclosed\b/i.test(c.text);
    if (/\bweekends?\b/i.test(c.text) && !c.u.date) {
      const sat = describeDay(hours, nextWeekday(t.now, timezone, 6));
      const sun = describeDay(hours, nextWeekday(t.now, timezone, 0));
      const any = sat !== 'closed' || sun !== 'closed';
      return {
        text: `${yesNo ? (any ? 'Yes — ' : "No, we're closed at weekends. ") : ''}On Saturdays we're ${sat}, and on Sundays we're ${sun}.`,
      };
    }
    if (c.u.date && !/\b(now|right now|currently)\b/i.test(c.text)) {
      const day = describeDay(hours, c.u.date.date);
      const closed = day === 'closed';
      const lead = yesNo ? (closed !== asksClosed ? 'No — ' : 'Yes — ') : '';
      return {
        text: `${lead}${closed ? `we're closed on ${formatDate(c.u.date.date)}.` : `on ${formatDate(c.u.date.date)} we're open ${day.replace(/^open /, '')}.`}${closed ? ` Our regular hours are ${week}.` : ''}`.replace(/^./, (ch) => ch.toUpperCase()),
      };
    }
    if (/\b(now|right now|currently|today|tonight|still open)\b/i.test(c.text)) {
      const today = utcToZoned(t.now, timezone).date;
      if (isOpenAt(hours, t.now, timezone)) return { text: `Yes, we're open right now — today we're ${describeDay(hours, today)}.` };
      const next = nextOpening(hours, t.now, timezone);
      return { text: `We're closed right now.${next ? ` We next open ${formatSlot(next, timezone)}.` : ''} Our regular hours are ${week}.` };
    }
    return { text: `Our opening hours are: ${week}.` };
  }

  private locationReply(c: Ctx): ChatReply {
    const t = c.state;
    t.kind = 'location';
    const details = this.bySlug.get('location-and-parking');
    const actions: NonNullable<ReplyUi['actions']> = [];
    if (this.clinic.address) {
      actions.push({ label: 'Get directions', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.clinic.address)}`, kind: 'map' });
    }
    // A specific question ("is it wheelchair accessible?") gets the specific answer.
    if (details && /\b(wheelchair|accessib|bus|train|subway|transport|floor|stairs|elevator|lift|park\w*)\b/i.test(c.text)) {
      const ans = this.reader.answer(c.text, { within: [details.id], max: 2 });
      if (ans && ans.match >= 0.3) {
        t.sources.push(details);
        return { text: ans.sentences.map((s) => s.text).join(' '), ui: actions.length ? { actions } : undefined };
      }
    }
    const parts: string[] = [];
    if (this.clinic.address) parts.push(`We're at ${this.clinic.address}.`);
    if (details) {
      t.sources.push(details);
      parts.push(details.summary);
    }
    if (!parts.length) {
      this.offer(t.chat, 'callback');
      return { text: "I don't have the address details on hand. Would you like someone from the team to send them to you?" };
    }
    if (this.clinic.address) parts.push(`Directions: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.clinic.address)}`);
    return { text: parts.join(' '), ui: actions.length ? { actions } : undefined };
  }

  private servicesReply(c: Ctx): ChatReply {
    c.state.kind = 'services';
    const names = this.services.map((s) => s.name).filter((n) => n !== 'Emergency visit');
    if (!names.length) return { text: `${this.clinic.name} offers general, cosmetic and emergency dental care. What would you like to know more about?` };
    const groups: [string, string[]][] = [
      ['General care', ['Check-up and cleaning', 'Fillings', "Children's check-up", 'Gum disease treatment', 'Tooth extraction', 'Wisdom teeth removal', 'Night guard', 'Sports mouthguard', 'Sedation dentistry']],
      ['Cosmetic', ['Teeth whitening', 'Porcelain veneers', 'Cosmetic bonding']],
      ['Straightening', ['Clear aligners', 'Braces']],
      ['Restorative', ['Dental implants', 'Full-arch implants', 'Crowns', 'Inlays and onlays', 'Bridges', 'Dentures', 'Root canal treatment']],
    ];
    const known = new Set(groups.flatMap(([, list]) => list));
    const lines = groups
      .map(([label, list]) => [label, list.filter((n) => names.includes(n))] as const)
      .filter(([, list]) => list.length)
      .map(([label, list]) => `• ${label}: ${joinList(list.map(lower))}`);
    const other = names.filter((n) => !known.has(n));
    if (other.length) lines.push(`• Also: ${joinList(other.map(lower))}`);
    if (this.services.some((s) => s.name === 'Emergency visit')) lines.push('• Emergency visits for pain, swelling and broken teeth');
    return {
      text: `Here's what ${this.clinic.name} offers:\n${lines.join('\n')}\nWhich would you like to know more about?`,
      suggestions: this.topServices(4),
    };
  }

  private newPatientReply(c: Ctx): ChatReply {
    const t = c.state;
    t.kind = 'new_patient';
    t.chat.bookingService = 'New patient exam';
    const docs = ['new-patients', 'first-visit'].map((s) => this.bySlug.get(s)).filter((a): a is Article => !!a);
    // "How early should I arrive?" deserves that answer, not the whole welcome.
    if (docs.length && this.isSpecific(c.text, ['new', 'patient', 'first', 'visit', 'appointment'])) {
      const ans = this.reader.answer(c.text, { within: docs.map((d) => d.id), exclude: new Set(t.chat.said) });
      if (ans && ans.match >= 0.25) {
        t.sources.push(ans.doc.data!);
        return { text: ans.sentences.map((s) => s.text).join(' ') };
      }
    }
    const parts: string[] = [];
    const policy = this.bySlug.get('new-patients');
    if (policy) {
      t.sources.push(policy);
      parts.push(policy.summary);
    }
    const first = this.bySlug.get('first-visit');
    if (first) {
      t.sources.push(first);
      parts.push(first.summary, this.reader.answer('what to bring', { within: [first.id], max: 1 })?.sentences[0]?.text ?? '');
    }
    if (!parts.length) parts.push(`${this.clinic.name} would be happy to see you.`);
    return { text: parts.filter(Boolean).join(' ') };
  }

  private greet(c: Ctx): ChatReply {
    const t = c.state;
    t.kind = 'greet';
    const said = /\bgood (morning|afternoon|evening)\b/i.exec(c.text)?.[0];
    const hello = said ? `${said[0].toUpperCase()}${said.slice(1).toLowerCase()}!` : t.chat.turn <= 1 ? 'Hi there!' : 'Hi again!';
    return {
      text: `${hello} ${t.chat.turn <= 1 ? 'How can I help you today?' : 'What else can I help with?'}`,
      suggestions: ['Book an appointment', ...this.topServices(2)],
    };
  }

  private handoff(c: Ctx): ChatReply {
    const t = c.state;
    t.kind = 'handoff';
    const phone = this.phone();
    if (this.reachable(t.chat.contact)) {
      t.events.escalate = { level: 'HANDOFF', reason: 'Visitor asked to talk to a person' };
      t.chat.pendingOffer = undefined;
      return { text: `Of course. I've asked the team to contact you at ${this.reachLabel(t.chat.contact)}. ${this.whenTeamReplies(t.now)}${phone ? ` You can also call us at ${phone}.` : ''}` };
    }
    t.chat.awaiting = 'contact';
    t.chat.purpose = 'callback';
    t.askedContact = true;
    return {
      text: `Of course! What's your name and the best phone number to reach you? I'll pass it straight to the team.${phone ? ` You can also call us directly at ${phone}.` : ''}`,
      ui: { form: { fields: this.missingContact(t.chat.contact, ['name', 'phone']), submit: 'Request a call back' } },
    };
  }

  private affirm(c: Ctx): Promise<ChatReply> | ChatReply {
    const chat = c.state.chat;
    switch (chat.pendingOffer) {
      case 'booking':
        return this.startBooking(c, chat.bookingService);
      case 'callback':
        return this.handoff(c);
      case 'topic': {
        chat.pendingOffer = undefined;
        const a = chat.suggestedTopic ? this.bySlug.get(chat.suggestedTopic) : undefined;
        if (a) return this.answerArticle(c, a, '');
        break;
      }
    }
    c.state.kind = 'affirm';
    // A "yes" after talking about a treatment most likely means "let's go ahead".
    const interest = chat.service && chat.service !== 'Emergency visit' ? chat.service : undefined;
    if (interest && !chat.appointment) {
      this.offer(chat, 'booking');
      chat.bookingService = interest;
      return {
        text: `Great! Would you like me to find you a time for ${this.servicePhrase(interest)}?`,
        suggestions: ['Yes, find a time', 'I have another question'],
      };
    }
    return { text: 'Great! What would you like to know? I can help with treatments, prices, insurance, opening hours or booking a visit.' };
  }

  private async urgentBooking(c: Ctx): Promise<ChatReply> {
    const t = c.state;
    t.chat.urgency = worst(t.chat.urgency, 'URGENT');
    const slots = await this.startBooking(c, 'Emergency visit');
    t.kind = 'urgent_booking';
    return { ...slots, text: `Let's get you seen as soon as possible. ${this.callLine(t.now)}\n${slots.text}` };
  }

  // ---------------------------------------------------------------- booking

  private startBooking(c: Ctx, service: string | undefined): Promise<ChatReply> {
    const chat = c.state.chat;
    chat.signals.booking = true;
    const dentist = /\b(?:dr\.?|doctor)\s+([A-Z][a-z]+|[a-z]{3,})\b/i.exec(c.u.original)?.[1];
    if (dentist && !/^(appointment|visit)$/i.test(dentist)) chat.dentist = `Dr. ${dentist[0].toUpperCase()}${dentist.slice(1).toLowerCase()}`;
    chat.pendingOffer = undefined;
    chat.bookingService = service ?? chat.bookingService ?? chat.service ?? 'Consultation';
    return this.offerSlots(c, this.preference(c.u));
  }

  private async offerSlots(c: Ctx, pref: SlotPreference, lead?: string): Promise<ChatReply> {
    const t = c.state;
    const chat = t.chat;
    t.kind = 'offer_slots';
    const wanted = this.describePreference(pref);
    let slots = await t.port.findSlots(pref);
    let intro =
      lead ??
      (wanted
        ? `Here are the openings ${wanted}:`
        : `Here are the next available times for ${this.servicePhrase(chat.bookingService ?? 'Consultation')}:`);
    if (!slots.length && (wanted || pref.after)) {
      slots = await t.port.findSlots(pref.after ? { after: pref.after } : {});
      intro = wanted ? `I don't have anything open ${wanted}, but here are the next available times:` : 'Here are the next available times:';
    }
    if (!slots.length) {
      chat.offered = [];
      chat.awaiting = 'contact';
      chat.purpose = 'callback';
      t.askedContact = true;
      const phone = this.phone();
      return {
        text: `I couldn't find an open time online in the next few weeks. If you share your name and phone number, the team will call you to find a time that works${phone ? ` — or call us at ${phone}` : ''}.`,
        ui: { form: { fields: this.missingContact(t.chat.contact, ['name', 'phone']), submit: 'Request a call back' } },
      };
    }
    chat.offered = slots;
    chat.awaiting = 'slot';
    t.offeredSlots = true;
    const list = slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
    const note = chat.dentist && t.kind === 'offer_slots' ? ` I'll note that you'd like to see ${chat.dentist}.` : '';
    return {
      text: `${intro}\n${list}\nWhich one works best? You can also tell me another day or time.${note}`,
      suggestions: slots.map((s) => s.label),
      ui: { slots },
    };
  }

  /** "Anything later?", "another day?", "more options?" while choosing a time. */
  private moreSlots(c: Ctx): Promise<ChatReply> {
    const chat = c.state.chat;
    const offered = chat.offered ?? [];
    const text = c.text.toLowerCase();
    const tz = this.clinic.timezone;
    const first = offered[0];
    const last = offered[offered.length - 1];
    if (/\bearlier\b/.test(text) && first) {
      const z = utcToZoned(new Date(first.startsAt), tz);
      return this.offerSlots(c, { date: z.date, time: z.time, relation: 'before' }, 'Here are some earlier times:');
    }
    if (/\b(?:another|other|different|next) days?\b/.test(text) && last) {
      const z = utcToZoned(new Date(last.startsAt), tz);
      return this.offerSlots(c, { after: zonedToUtc(z.date, '23:59', tz).toISOString() }, 'Here are times on other days:');
    }
    if (/\blater\b/.test(text) && first) {
      const day = utcToZoned(new Date(first.startsAt), tz).date;
      const lastThatDay = [...offered].reverse().find((s) => utcToZoned(new Date(s.startsAt), tz).date === day) ?? first;
      return this.offerSlots(c, { date: day, after: lastThatDay.startsAt }, 'Here are some later times:');
    }
    return this.offerSlots(c, last ? { after: last.startsAt } : {}, 'Here are some more times:');
  }

  private pickSlot(text: string, u: Understanding<Article>, offered: Slot[]): Slot | undefined {
    if (!offered.length) return undefined;
    const t = text.toLowerCase().trim();
    const exact = offered.find((s) => s.label.toLowerCase() === t);
    if (exact) return exact;
    for (const [re, i] of ORDINALS) if (re.test(t) && offered[i]) return offered[i];
    if (/\b(last|latest) one\b|\bthe last\b/.test(t)) return offered[offered.length - 1];

    const local = offered.map((s) => ({ s, ...utcToZoned(new Date(s.startsAt), this.clinic.timezone) }));
    let pool = local;
    if (u.date) pool = pool.filter((x) => x.date === u.date!.date);
    if (u.time?.time) pool = pool.filter((x) => x.time === u.time!.time);
    else if (u.time?.partOfDay) {
      const h = (x: { time: string }) => Number(x.time.slice(0, 2));
      pool = pool.filter((x) => (u.time!.partOfDay === 'morning' ? h(x) < 12 : u.time!.partOfDay === 'afternoon' ? h(x) >= 12 && h(x) < 17 : h(x) >= 16));
    }
    if ((u.date || u.time) && pool.length >= 1 && pool.length < local.length) return pool[0].s;
    if ((u.date || u.time) && local.length === 1 && pool.length === 1) return pool[0].s;
    return undefined;
  }

  private afterSlotChosen(c: Ctx): Promise<ChatReply> | ChatReply {
    const t = c.state;
    const chat = t.chat;
    const ct = chat.contact;
    if (ct.name && this.reachable(ct)) return this.reserve(c);
    chat.awaiting = 'contact';
    chat.purpose = 'booking';
    t.askedContact = true;
    t.kind = 'ask_contact';
    const need = !ct.name && !this.reachable(ct)
      ? 'your full name and the best phone number or email'
      : !ct.name
        ? 'your full name'
        : 'the best phone number or email to confirm with';
    return {
      text: `${chat.chosen!.label} — great choice. To hold it for you, could I get ${need}?`,
      ui: { form: { fields: this.missingContact(ct), submit: 'Hold this time' } },
    };
  }

  private afterContact(c: Ctx): Promise<ChatReply> | ChatReply {
    const t = c.state;
    const chat = t.chat;
    const ct = chat.contact;
    const first = firstName(ct.name);
    if (!ct.name && this.reachable(ct)) {
      t.askedContact = true;
      t.kind = 'ask_name';
      return { text: 'Thanks! And what name should I put this under?', ui: { form: { fields: ['name'], submit: 'Send' } } };
    }
    if (ct.name && !this.reachable(ct)) {
      t.askedContact = true;
      t.kind = 'ask_phone';
      return { text: `Thanks, ${first}! What's the best phone number or email to reach you?`, ui: { form: { fields: ['phone', 'email'], submit: 'Send' } } };
    }
    chat.awaiting = undefined;
    chat.contactAsks = 0;
    const purpose = chat.purpose;
    chat.purpose = undefined;
    if (purpose === 'booking' && chat.chosen) return this.reserve(c);
    if (purpose === 'urgent') {
      t.kind = 'urgent_callback';
      t.events.escalate = { level: 'URGENT', reason: t.safety?.reason ?? 'Urgent dental problem — callback requested' };
      this.offer(chat, 'booking');
      chat.bookingService = chat.bookingService ?? 'Emergency visit';
      const phone = this.phone();
      return {
        text: `Thank you, ${first}. I've flagged this as urgent, and the team will contact you at ${this.reachLabel(ct)} as soon as possible.${phone && isOpenAt(this.clinic.hours, t.now, this.clinic.timezone) ? ` If you'd rather not wait, call us now at ${phone}.` : ''} Would you also like me to find the earliest available appointment?`,
        suggestions: ['Yes, find a time', 'No thanks'],
      };
    }
    if (purpose === 'callback') {
      t.kind = 'callback';
      t.events.escalate = { level: 'HANDOFF', reason: 'Visitor asked the team to get in touch' };
      return {
        text: `Thanks, ${first}! I've passed your details to the team, and someone will get back to you at ${this.reachLabel(ct)}. ${this.whenTeamReplies(t.now)} Is there anything else I can help with in the meantime?`,
      };
    }
    t.kind = 'contact_saved';
    return { text: `Thanks, ${first}! I've saved your details. Is there anything else I can help with?` };
  }

  private async reserve(c: Ctx): Promise<ChatReply> {
    const t = c.state;
    const chat = t.chat;
    const slot = chat.chosen!;
    const service = chat.bookingService ?? 'Consultation';
    const result = await t.port.reserve(slot, service, chat.contact);
    if (!result.ok) {
      chat.chosen = undefined;
      const again = await this.offerSlots(c, {});
      return { ...again, text: `Sorry — ${slot.label} was just taken. ${again.text}` };
    }
    t.kind = 'booked';
    chat.appointment = { id: result.appointmentId, label: slot.label, service };
    chat.awaiting = undefined;
    chat.purpose = undefined;
    chat.offered = [];
    chat.chosen = undefined;
    chat.pendingOffer = undefined;
    t.events.appointmentId = result.appointmentId;
    const first = firstName(chat.contact.name);
    const via = chat.contact.phone ? `by phone at ${formatPhone(chat.contact.phone)}` : `by email at ${chat.contact.email}`;
    return {
      text: `You're all set${first ? `, ${first}` : ''}! I've requested ${this.servicePhrase(service)} on ${slot.label}. The team will confirm ${via} shortly. Is there anything else I can help with?`,
      suggestions: ['What should I bring?', 'Where are you located?'],
      ui: {
        card: {
          type: 'booked',
          service,
          label: slot.label,
          startsAt: slot.startsAt,
          minutes: this.clinic.slotMinutes ?? 30,
          clinic: this.clinic.name,
          address: this.clinic.address ?? undefined,
        },
      },
    };
  }

  // ---------------------------------------------------------------- finishing

  private finish(reply: ChatReply, skill: string, u: Understanding<Article>, t: Turn): ChatReply {
    const chat = t.chat;
    let text = reply.text.trim();
    const suggestions = [...(reply.suggestions ?? [])];
    const ui: ReplyUi = { ...(reply.ui ?? {}) };

    const first = firstName(chat.contact.name);
    if (t.captured.name && first && !text.includes(first) && !t.safety) text = `Nice to meet you, ${first}! ${text}`;

    const remind = !['bye', 'thanks', 'opt_out'].includes(t.kind ?? '') && chat.turn - (chat.lastReminderTurn ?? -10) >= 2;
    if (remind && chat.awaiting === 'contact' && !t.askedContact && skill !== 'awaiting') {
      text += "\n\nWhen you're ready, just send your name and the best phone number or email.";
      chat.lastReminderTurn = chat.turn;
    } else if (remind && chat.awaiting === 'slot' && !t.offeredSlots && skill !== 'awaiting') {
      text += '\n\nWhenever you are ready, pick one of the times above or tell me another day.';
      chat.lastReminderTurn = chat.turn;
    }

    const ctaKinds = ['knowledge', 'capability', 'compare', 'price', 'insurance', 'financing', 'new_patient', 'services'];
    const ctaDue = chat.turn - (chat.lastCtaTurn ?? -10) >= 3;
    if (ctaKinds.includes(t.kind ?? '') && !chat.appointment && !chat.awaiting && !chat.pendingOffer && ctaDue && !t.safety && !chat.optedOut) {
      const interest = chat.service && chat.service !== 'Emergency visit' ? chat.service : undefined;
      const service = t.ctaService === undefined ? interest : (t.ctaService ?? undefined);
      text += service ? ` Would you like to book ${this.servicePhrase(service)}?` : ' Would you like to book a visit?';
      this.offer(chat, 'booking');
      chat.bookingService = service ?? (t.kind === 'new_patient' ? 'New patient exam' : 'Consultation');
      chat.lastCtaTurn = chat.turn;
      if (!suggestions.length) suggestions.push('Yes, book a consultation', 'I have another question');
    }

    const titles = [...new Set(t.sources.map((a) => a.title))];
    if (titles.length && !['greet', 'thanks', 'bye'].includes(t.kind ?? '')) ui.sources = titles.slice(0, 3);
    if (!u.text.trim()) text = 'Could you type your question? I can help with treatments, prices, insurance, hours or booking.';
    return {
      text: text.replace(/\n{3,}/g, '\n\n'),
      suggestions: suggestions.length ? suggestions.slice(0, 4) : undefined,
      data: reply.data,
      ui: Object.keys(ui).length ? ui : undefined,
    };
  }

  // ---------------------------------------------------------------- utilities

  /** Remember what a "yes" in the next few turns means. */
  private offer(chat: ChatState, kind: NonNullable<ChatState['pendingOffer']>): void {
    chat.pendingOffer = kind;
    chat.offerTurn = chat.turn;
  }

  /** Record that an article informed this reply (for sources and follow-up context). */
  private use(t: Turn, a: Article): void {
    t.sources.push(a);
    if (a.category !== 'POLICY') t.chat.topics = [...t.chat.topics.filter((s) => s !== a.slug), a.slug].slice(-10);
  }

  private mainArticle(service: string): Article | undefined {
    return this.services.find((s) => s.name === service)?.article;
  }

  /** Favour aftercare articles for recovery questions and treatment articles otherwise. */
  private categoryBoost(doc: SearchDocument<Article>, aspects: string[], query: string): number {
    const category = doc.data?.category;
    const after = AFTER_PROCEDURE.test(query) || aspects.some((a) => ['recovery', 'aftercare', 'eating'].includes(a));
    if (category === 'AFTERCARE') return after ? 0.35 : -0.35;
    if (category === 'EMERGENCY' && aspects.includes('remedy') && /\bif\b/i.test(query)) return 0.4;
    if (category === 'POLICY') return -0.1;
    return 0;
  }

  /** "a consultation for dental implants", "an emergency visit", "a check-up and cleaning". */
  private servicePhrase(service: string): string {
    if (service === 'Consultation') return 'a consultation';
    if (/\b(visit|exam|check-up|checkup|cleaning|consultation)\b/i.test(service)) return `${/^[aeiou]/i.test(service) ? 'an' : 'a'} ${lower(service)}`;
    return `a consultation for ${lower(service)}`;
  }

  /** The article a follow-up question ("does it hurt?") refers to, if any. */
  private contextArticle(c: Ctx): Article | undefined {
    const chat = c.state.chat;
    // While booking, "does it hurt?" is about the treatment being booked.
    const booking = chat.awaiting && chat.bookingService ? this.mainArticle(chat.bookingService) : undefined;
    const last = chat.topics.at(-1);
    const a = booking ?? (last ? this.bySlug.get(last) : undefined);
    if (!a) return undefined;
    const pronoun = /\b(it|its|they|them|their|that|this|those|these|process|procedure|treatment|recovery)\b/i.test(c.text);
    const top = c.u.knowledge[0];
    const short = c.text.trim().split(/\s+/).length <= 6 && !(top && top.coverage >= 0.8 && top.doc.data?.slug !== a.slug);
    return pronoun || short ? a : undefined;
  }

  private primaryIntent(u: Understanding<Article>): IntentScore | undefined {
    if (!u.intent) return undefined;
    if (!SOCIAL_INTENTS.has(u.intent.intent)) return u.intent;
    return u.intents.find((s) => !SOCIAL_INTENTS.has(s.intent) && s.confidence >= 0.45) ?? u.intent;
  }

  private strongHit(hits: SearchHit<Article>[]): SearchHit<Article> | undefined {
    const top = hits[0];
    if (!top) return undefined;
    if (top.coverage >= 0.5 || (top.coverage >= 0.3 && top.score >= 4)) return top;
    return undefined;
  }

  private isQuestion(u: Understanding<Article>): boolean {
    const p = this.primaryIntent(u);
    return (!!p && !SOCIAL_INTENTS.has(p.intent)) || !!this.strongHit(u.knowledge) || u.text.includes('?');
  }

  /** Does the query ask something beyond naming the topic ("how long", "does it hurt")? */
  private isSpecific(query: string, topicWords: string[]): boolean {
    const topic = new Set(terms(topicWords.join(' ')));
    return this.index.analyze(query).original.some((term) => !topic.has(term) && !GENERIC_TERMS.has(term));
  }

  /** A word the assistant knows (so it isn't mistaken for a name). */
  private knownWord(word: string): boolean {
    return STOPWORDS.has(word) || this.index.hasWord(word) || classifier.hasWord(word) || this.dictionary.hasWord(word);
  }

  /** Which contact fields to ask for, given what we already have. */
  private missingContact(c: Contact, want: ('name' | 'phone' | 'email')[] = ['name', 'phone', 'email']): ('name' | 'phone' | 'email')[] {
    const reachable = this.reachable(c);
    const missing = want.filter((f) => (f === 'name' ? !c.name : !reachable));
    return missing.length ? missing : want;
  }

  private preference(u: Understanding<Article>): SlotPreference {
    return { date: u.date?.date, partOfDay: u.time?.partOfDay, time: u.time?.time, relation: u.time?.relation };
  }

  private describePreference(p: SlotPreference): string {
    const parts: string[] = [];
    if (p.date) parts.push(`on ${formatDate(p.date)}`);
    if (p.time) parts.push(`${p.relation === 'after' ? 'after' : p.relation === 'before' ? 'before' : 'around'} ${formatTime(p.time)}`);
    else if (p.partOfDay) parts.push(`in the ${p.partOfDay}`);
    return parts.join(' ');
  }

  private topServices(n: number): string[] {
    const preferred = ['Teeth whitening', 'Dental implants', 'Clear aligners', 'Porcelain veneers', 'Check-up and cleaning', 'Crowns'];
    const names = this.services.map((s) => s.name);
    return [...preferred.filter((p) => names.includes(p)), ...names.filter((x) => !preferred.includes(x) && x !== 'Emergency visit')].slice(0, n);
  }

  private phone(): string | undefined {
    return this.clinic.phone ? formatPhone(this.clinic.phone) : undefined;
  }

  private reachable(c: Contact): boolean {
    return !!(c.phone || c.email);
  }

  private reachLabel(c: Contact): string {
    return c.phone ? formatPhone(c.phone) : (c.email ?? 'the details you shared');
  }

  private callLine(now: Date): string {
    const phone = this.phone();
    const { hours, timezone, emergencyInstructions } = this.clinic;
    const extra = emergencyInstructions ? ` ${emergencyInstructions.trim()}` : '';
    if (isOpenAt(hours, now, timezone)) {
      return phone ? `Please call us now at ${phone} so the team can fit you in.` : '';
    }
    const next = nextOpening(hours, now, timezone);
    return `We're closed right now${next ? ` and reopen ${formatSlot(next, timezone)}` : ''}.${extra}${phone ? ` You can call ${phone} when we open.` : ''}`;
  }

  private whenTeamReplies(now: Date): string {
    const { hours, timezone } = this.clinic;
    if (isOpenAt(hours, now, timezone)) return "We're open now, so it shouldn't be long.";
    const next = nextOpening(hours, now, timezone);
    return next ? `We're closed right now, so expect to hear from us after we open (${formatSlot(next, timezone)}).` : "They'll reach out as soon as they can.";
  }
}

// ---------------------------------------------------------------- helpers

/** Replace a phrase (as tokenised words) in `text`, keeping the rest as typed. */
function replacePhrase(text: string, phrase: string, replacement: string): string | undefined {
  const words = tokenize(phrase);
  if (!words.length) return undefined;
  const re = new RegExp(`\\b${words.map((w) => w.replace(/[^a-z0-9]/g, '')).join("[\\s'’-]+")}\\b`, 'i');
  return re.test(text) ? text.replace(re, replacement) : undefined;
}

/** "without braces", "not implants", "other than veneers": the phrase is ruled out. */
function negated(text: string, phrase: string): boolean {
  const words = tokenize(phrase);
  if (!words.length) return false;
  const re = new RegExp(`\\b(?:without|not|no|other than|instead of|besides|except|apart from|rather than)\\s+(?:\\w+\\s+){0,2}?${words.join("[\\s'’-]+")}`, 'i');
  return re.test(text);
}

/** A weekday named in the text ("on saturdays"), 0 = Sunday. */
function weekdayIn(text: string): number | undefined {
  const m = /\b(sun|mon|tue|wed|thu|fri|sat)(?:s|days?|nesdays?|rsdays?|urdays?|sdays?)?\b/i.exec(text);
  return m ? ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[1].toLowerCase()) : undefined;
}

/** The clinic-local date of the next given weekday (0 = Sunday), today included. */
function nextWeekday(now: Date, tz: string, weekday: number): string {
  const today = utcToZoned(now, tz).date;
  const d = new Date(`${today}T12:00:00Z`);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

