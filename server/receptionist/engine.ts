/**
 * The AI receptionist. Runs entirely on localbrain (no external AI): it
 * understands the message, applies safety rules, answers from the clinic's
 * knowledge base, quotes only clinic-set prices, captures contact details,
 * offers real open appointment times and books them, and hands off to staff.
 *
 * The engine is pure apart from the injected ClinicPort (slot search and
 * booking), so it is fully testable without a database.
 */
import {
  Assistant,
  Brain,
  EntityDictionary,
  IntentClassifier,
  SearchIndex,
  formatPhone,
  joinList,
  stripPersonalDetails,
  terms,
  type IntentScore,
  type PartOfDay,
  type Reply,
  type SearchHit,
  type Skill,
  type SkillContext,
  type Understanding,
} from '../../packages/localbrain/src/index.ts';
import type { WeeklyHours } from '../db/schema.ts';
import { SYNONYMS } from '../knowledge/library.ts';
import {
  describeDay,
  describeHours,
  formatDate,
  formatSlot,
  formatTime,
  isOpenAt,
  nextOpening,
  utcToZoned,
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
}

/** What the engine needs from the outside world. */
export interface ClinicPort {
  findSlots(pref: SlotPreference): Promise<Slot[]>;
  reserve(slot: Slot, service: string, contact: Contact): Promise<{ ok: true; appointmentId: string } | { ok: false; reason: string }>;
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
  /** What a "yes" from the visitor would mean right now (valid for one turn). */
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
}

export function newChatState(): ChatState {
  return { turn: 0, visitorMessages: 0, contact: {}, topics: [], signals: {}, misses: 0, contactAsks: 0 };
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
  reply: Reply;
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

// ---------------------------------------------------------------- helpers

/** Trained once and shared by every clinic. */
const classifier = new IntentClassifier(INTENTS);

const SEVERITY: Record<SafetyLevel, number> = { SOON: 1, URGENT: 2, ER: 3 };
const worst = (a: SafetyLevel | undefined, b: SafetyLevel): SafetyLevel => (!a || SEVERITY[b] > SEVERITY[a] ? b : a);

const firstName = (name?: string) => name?.split(' ')[0];
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Placeholder text like "[Which plans do you accept?]" means the clinic hasn't filled it in. */
const isUsable = (a: Article) => a.published && !/\[[^\]]{3,}\]/.test(a.summary);

/** Query words that don't change *what* is being asked about a topic. */
const GENERIC_TERMS = new Set(
  ['tell', 'inform', 'info', 'explain', 'interest', 'offer', 'know', 'learn', 'detail', 'question', 'ask', 'procedur', 'treatment',
    'option', 'servic', 'look', 'consid', 'think', 'someth', 'anyth', 'thing', 'avail', 'provid', 'perform', 'dentist', 'dental',
    'clinic', 'practic', 'offic', 'get', 'need', 'want', 'more', 'much'].map((s) => s)
);

/** Elective treatments that dental insurance rarely covers. */
const COSMETIC = new Set(['Teeth whitening', 'Porcelain veneers', 'Cosmetic bonding']);

const ORDINALS: [RegExp, number][] = [
  [/^\s*(?:#|no\.?|number|option)?\s*(?:1|one)\s*[.)!]?\s*(?:please)?\s*$|\b(?:first|1st)\b|\boption (?:1|one)\b|\bnumber one\b/, 0],
  [/^\s*(?:#|no\.?|number|option)?\s*(?:2|two)\s*[.)!]?\s*(?:please)?\s*$|\b(?:second|2nd)\b|\boption (?:2|two)\b|\bnumber two\b/, 1],
  [/^\s*(?:#|no\.?|number|option)?\s*(?:3|three)\s*[.)!]?\s*(?:please)?\s*$|\b(?:third|3rd)\b|\boption (?:3|three)\b|\bnumber three\b/, 2],
];

// ---------------------------------------------------------------- engine

export class Receptionist {
  readonly index: SearchIndex<Article>;
  private readonly bySlug: Map<string, Article>;
  private readonly services: { name: string; article: Article }[];
  private readonly assistant: Assistant<Turn, Article>;

  constructor(
    readonly clinic: ClinicProfile,
    articles: Article[]
  ) {
    const usable = articles.filter(isUsable);
    this.index = new SearchIndex<Article>({ synonyms: SYNONYMS });
    for (const a of usable) {
      this.index.add({ id: a.id, title: a.title, tags: a.tags, body: `${a.summary}\n${a.body}`, data: a });
    }
    this.bySlug = new Map(usable.map((a) => [a.slug, a]));

    // One entry per bookable service; synonyms come from every article offering it.
    const byService = new Map<string, Article[]>();
    for (const a of usable) if (a.service) byService.set(a.service, [...(byService.get(a.service) ?? []), a]);
    this.services = [...byService].map(([name, list]) => ({
      name,
      article: list.find((a) => a.priceMin != null || a.priceMax != null) ?? list.find((a) => a.category === 'PROCEDURE') ?? list[0],
    }));
    const dictionary = new EntityDictionary(
      [...byService].map(([name, list]) => ({ value: name, synonyms: list.flatMap((a) => [a.title, ...a.tags]) }))
    );

    const brain = new Brain<Article>({
      classifier,
      knowledge: this.index,
      dictionaries: { service: dictionary },
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
  greeting(): Reply {
    const text =
      this.clinic.greeting?.trim() ||
      `Hi! I'm the virtual assistant for ${this.clinic.name}. I can answer questions about treatments, costs and insurance, or book you in. How can I help?`;
    return { text, suggestions: ['Book an appointment', ...this.topServices(2), 'Opening hours'] };
  }

  async respond(text: string, prev: ChatState, port: ClinicPort, now: Date = new Date()): Promise<TurnResult> {
    const chat: ChatState = structuredClone(prev);
    chat.turn++;
    chat.visitorMessages++;
    if (chat.pendingOffer && (chat.offerTurn ?? 0) < chat.turn - 1) chat.pendingOffer = undefined;
    const turn: Turn = { chat, port, now, events: {}, sources: [], captured: {} };
    const result = await this.assistant.reply(text.slice(0, 1000), turn);
    const reply = this.finish(result.reply, result.skill, result.understanding, turn);
    const primary = this.primaryIntent(result.understanding);
    const seen = new Set<string>();
    return {
      reply,
      state: chat,
      events: turn.events,
      meta: {
        intent: primary?.intent,
        confidence: primary ? Math.round(primary.confidence * 100) / 100 : undefined,
        skill: turn.kind ?? result.skill,
        sources: turn.sources.filter((a) => !seen.has(a.slug) && seen.add(a.slug)).map((a) => ({ slug: a.slug, title: a.title })),
        safety: turn.safety?.level,
        safetyReason: turn.safety?.reason,
        unanswered: turn.unanswered || undefined,
      },
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
      { name: 'intent', run: (c) => this.byIntent(c) },
      { name: 'knowledge', run: (c) => this.knowledge(c) },
      { name: 'fallback', run: (c) => this.fallback(c) },
    ];
  }

  /** Remember contact details, service interest and date preferences mentioned anywhere. */
  private capture({ u, state: t }: Ctx): void {
    const c = t.chat.contact;
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
    const explicit = /\b(my name|call me|name is|name's)\b/i.test(u.text);
    if (u.name && u.name !== c.name && (!c.name || explicit || t.chat.awaiting === 'contact')) {
      c.name = u.name;
      t.captured.name = true;
    }
    const service = u.values.service?.[0];
    if (service) t.chat.service = service;
    if (u.date) t.chat.signals.preferredDate = u.date.date;
  }

  private safety(c: Ctx): Reply | undefined {
    const t = c.state;
    const s = checkSafety(c.text);
    if (!s) return undefined;
    t.safety = s;
    t.kind = `safety_${s.level.toLowerCase()}`;
    t.chat.urgency = worst(t.chat.urgency, s.level);
    const article = this.bySlug.get(s.topic);
    if (article) t.sources.push(article);
    const phone = this.phone();

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
      };
    }

    const bookingService = this.serviceFor(article) ?? 'Emergency visit';
    t.chat.bookingService = bookingService;
    if (s.level === 'SOON') {
      this.offer(t.chat, 'booking');
      t.kind = 'safety_soon';
      return {
        text: `Sorry to hear that. ${article?.summary ?? ''} It's best to have it checked soon. Would you like me to find the earliest available appointment?`,
        suggestions: ['Yes, find a time', 'No thanks'],
      };
    }

    // URGENT
    const parts = ["I'm sorry you're dealing with that — let's get you help quickly.", article?.summary ?? '', this.callLine(t.now)];
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
    }
    parts.push('If swelling spreads to your eye or neck, or you have trouble breathing or swallowing or a high fever, go to the emergency room or call 911.');
    return { text: parts.filter(Boolean).join(' ') };
  }

  private optOut(c: Ctx): Reply | undefined {
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

  private medicalAdvice(c: Ctx): Reply | undefined {
    const t = c.state;
    if (isMedicationQuestion(c.text)) {
      t.kind = 'medication_question';
      this.offer(t.chat, 'booking');
      t.chat.bookingService = t.chat.service ?? 'Dental exam';
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
    t.chat.bookingService = this.serviceFor(hit?.doc.data) ?? 'Dental exam';
    return { text: parts.join(' '), suggestions: ['Yes, book an exam', 'No thanks'] };
  }

  private async awaiting(c: Ctx): Promise<Reply | undefined> {
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
      if (this.isQuestion(c.u)) return undefined;
      chat.contactAsks++;
      if (chat.contactAsks > 2) {
        chat.awaiting = undefined;
        const phone = this.phone();
        return { text: `No worries.${phone ? ` You can always reach us at ${phone}.` : ''} Is there anything else I can help with?` };
      }
      t.askedContact = true;
      t.kind = 'contact_reprompt';
      return { text: "Sorry, I didn't catch that. Could you send your name and the best phone number or email to reach you?" };
    }

    if (chat.awaiting === 'slot') {
      const pick = this.pickSlot(c.text, c.u, chat.offered ?? []);
      if (pick) {
        chat.chosen = pick;
        return this.afterSlotChosen(c);
      }
      if (c.u.date || c.u.time) return this.offerSlots(c, this.preference(c.u));
      if (intent === 'deny') {
        chat.offered = [];
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
      };
    }

    // price_service: the visitor was asked which treatment they want a price for.
    chat.awaiting = undefined;
    const service = c.u.values.service?.[0];
    return service ? this.priceReply(c, service) : undefined;
  }

  /** Contact details shared without being asked: acknowledge and offer the next step. */
  private volunteered(c: Ctx): Reply | undefined {
    const t = c.state;
    if (!(t.captured.phone || t.captured.email) || t.chat.awaiting) return undefined;
    const rest = stripPersonalDetails(c.text, c.u.name).replace(/\b(my|name|is|number|phone|email|mail|it's|its|im|i'm|and|at|here|you can reach me|reach me|call me|on)\b/gi, ' ');
    if (rest.trim().split(/\s+/).filter((w) => w.length > 1).length > 2) return undefined;
    t.kind = 'contact_saved';
    this.offer(t.chat, 'booking');
    const first = firstName(t.chat.contact.name);
    return {
      text: `Thanks${first ? `, ${first}` : ''} — I've noted your details. Would you like me to find you an appointment, or is there something I can answer first?`,
      suggestions: ['Find an appointment', 'I have a question'],
    };
  }

  private async byIntent(c: Ctx): Promise<Reply | undefined> {
    const p = this.primaryIntent(c.u);
    // "I'd like to get my teeth cleaned next week": a wish plus a date means booking.
    if ((!p || SOCIAL_INTENTS.has(p.intent) || p.intent === 'procedure_info') && (c.u.date || c.u.time?.time) &&
        /\b(want|wanna|like|need|can i|could i|may i|looking to|hoping to|book|come in|get in)\b/i.test(c.text)) {
      return this.startBooking(c, c.u.values.service?.[0]);
    }
    if (!p) return undefined;
    const t = c.state;
    const chat = t.chat;
    switch (p.intent) {
      case 'book':
        return this.startBooking(c, c.u.values.service?.[0]);
      case 'reschedule': {
        t.kind = 'reschedule';
        const phone = this.phone();
        this.offer(chat, 'callback');
        return {
          text: `To change or cancel an existing appointment, please ${phone ? `call us at ${phone}` : 'contact the office'}${this.clinic.email ? ` or email ${this.clinic.email}` : ''}. Or I can have the team get in touch with you — would you like that?`,
          suggestions: ['Yes, contact me', 'No thanks'],
        };
      }
      case 'price':
        return this.priceReply(c, c.u.values.service?.[0] ?? chat.service);
      case 'financing':
        chat.signals.financing = true;
        return this.policyReply(c, 'payment-and-financing', 'payment and financing', 'financing');
      case 'insurance':
        chat.signals.insurance = true;
        return this.policyReply(c, 'insurance', 'insurance', 'insurance');
      case 'hours':
        return this.hoursReply(c);
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
        return this.newPatientReply(c);
      case 'services':
        return this.servicesReply(c);
      case 'emergency':
        // Real emergencies are caught by the safety rules; only act on a clear signal here.
        return p.confidence >= 0.6 ? this.urgentBooking(c) : undefined;
      case 'greet':
        if (this.strongHit(c.u.knowledge)) return undefined;
        t.kind = 'greet';
        return {
          text: chat.turn <= 1 ? 'Hi there! How can I help you today?' : 'Hi again! What else can I help with?',
          suggestions: ['Book an appointment', ...this.topServices(2)],
        };
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
        return this.affirm(c);
      case 'deny':
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

  private knowledge(c: Ctx): Reply | undefined {
    const query = stripPersonalDetails(c.text, c.u.name);
    const context = this.contextArticle(c);
    if (context) {
      const passages = this.index.passages(`${context.summary}\n${context.body}`, query, 2, context, { fallback: false, minRatio: 0.6 });
      if (passages.length) {
        c.state.kind = 'knowledge';
        this.use(c.state, context);
        return { text: passages.join(' ') };
      }
    }
    const hit = this.strongHit(c.u.knowledge);
    return hit?.doc.data ? this.answerArticle(c, hit.doc.data, query) : undefined;
  }

  private fallback(c: Ctx): Reply {
    const t = c.state;
    const chat = t.chat;
    t.unanswered = true;
    t.kind = 'fallback';
    chat.misses++;
    const weak = c.u.knowledge[0];
    if (weak?.doc.data && weak.coverage >= 0.2) {
      this.offer(chat, 'topic');
      chat.suggestedTopic = weak.doc.data.slug;
      return { text: `I'm not completely sure I understood. Are you asking about ${lower(weak.doc.data.title)}?`, suggestions: ['Yes', 'No'] };
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

  // ---------------------------------------------------------------- replies

  private answerArticle(c: Ctx, a: Article, query: string): Reply {
    const t = c.state;
    t.kind = 'knowledge';
    t.ctaService = a.service && a.service !== 'Emergency visit' ? a.service : null;
    this.use(t, a);
    if (a.service && !c.u.values.service?.length && a.service !== 'Emergency visit') t.chat.service = a.service;
    let text = a.summary;
    if (query && this.isSpecific(query, a)) {
      text = this.index.passages(`${a.summary}\n${a.body}`, query, 2, a, { minRatio: 0.6 }).join(' ');
    }
    return { text };
  }

  private priceReply(c: Ctx, service: string | undefined): Reply {
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
    t.chat.service = service;
    t.ctaService = service;
    const a = this.services.find((s) => s.name === service)?.article;
    if (a) this.use(t, a);
    const range =
      a?.priceMin != null && a?.priceMax != null
        ? `${money(a.priceMin)}–${money(a.priceMax)}`
        : a?.priceMin != null
          ? `from ${money(a.priceMin)}`
          : a?.priceMax != null
            ? `up to ${money(a.priceMax)}`
            : undefined;
    const parts = [
      range
        ? `At ${this.clinic.name}, the typical cost for ${lower(service)} is ${range}${a?.priceUnit ? ` ${a.priceUnit}` : ''}. Your exact cost depends on your exam and treatment plan${COSMETIC.has(service) ? '' : ', and insurance may cover part of it'}.`
        : `The cost of ${lower(service)} depends on your individual case, so ${this.clinic.name} gives you an exact quote after an exam rather than guessing.`,
    ];
    const financing = this.bySlug.get('payment-and-financing');
    if (financing) {
      const line = this.index.passages(`${financing.summary}\n${financing.body}`, 'payment plan financing monthly', 1, financing)[0];
      if (line) parts.push(line);
    }
    return { text: parts.join(' ') };
  }

  private policyReply(c: Ctx, slug: string, topic: string, kind: string): Reply {
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

  private hoursReply(c: Ctx): Reply {
    const t = c.state;
    t.kind = 'hours';
    const { hours, timezone } = this.clinic;
    const week = describeHours(hours);
    if (c.u.date && !/\b(now|right now|currently)\b/i.test(c.text)) {
      const day = describeDay(hours, c.u.date.date);
      return { text: `On ${formatDate(c.u.date.date)} we're ${day}.${day === 'closed' ? ` Our regular hours are ${week}.` : ''}` };
    }
    if (/\b(now|right now|currently|today|tonight|still open)\b/i.test(c.text)) {
      const today = utcToZoned(t.now, timezone).date;
      if (isOpenAt(hours, t.now, timezone)) return { text: `Yes, we're open right now — today we're ${describeDay(hours, today)}.` };
      const next = nextOpening(hours, t.now, timezone);
      return { text: `We're closed right now.${next ? ` We next open ${formatSlot(next, timezone)}.` : ''} Our regular hours are ${week}.` };
    }
    return { text: `Our opening hours are: ${week}.` };
  }

  private locationReply(c: Ctx): Reply {
    const t = c.state;
    t.kind = 'location';
    const parts: string[] = [];
    if (this.clinic.address) parts.push(`We're at ${this.clinic.address}.`);
    const details = this.bySlug.get('location-and-parking');
    if (details) {
      t.sources.push(details);
      parts.push(details.summary);
    }
    if (!parts.length) {
      this.offer(t.chat, 'callback');
      return { text: "I don't have the address details on hand. Would you like someone from the team to send them to you?" };
    }
    if (this.clinic.address) parts.push(`Directions: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.clinic.address)}`);
    return { text: parts.join(' ') };
  }

  private servicesReply(c: Ctx): Reply {
    c.state.kind = 'services';
    const names = this.services.map((s) => s.name).filter((n) => n !== 'Emergency visit');
    if (!names.length) return { text: `${this.clinic.name} offers general, cosmetic and emergency dental care. What would you like to know more about?` };
    const groups: [string, string[]][] = [
      ['General care', ['Check-up and cleaning', 'Fillings', "Children's check-up", 'Gum disease treatment', 'Tooth extraction', 'Wisdom teeth removal', 'Night guard', 'Sedation dentistry']],
      ['Cosmetic', ['Teeth whitening', 'Porcelain veneers', 'Cosmetic bonding']],
      ['Straightening', ['Clear aligners', 'Braces']],
      ['Restorative', ['Dental implants', 'Full-arch implants', 'Crowns', 'Bridges', 'Dentures', 'Root canal treatment']],
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

  private newPatientReply(c: Ctx): Reply {
    const t = c.state;
    t.kind = 'new_patient';
    const parts: string[] = [];
    const policy = this.bySlug.get('new-patients');
    if (policy) {
      t.sources.push(policy);
      parts.push(policy.summary);
    }
    const first = this.bySlug.get('first-visit');
    if (first) {
      t.sources.push(first);
      parts.push(first.summary, this.index.passages(first.body, 'what to bring', 1, first)[0] ?? '');
    }
    if (!parts.length) parts.push(`${this.clinic.name} would be happy to see you.`);
    t.chat.bookingService = 'New patient exam';
    return { text: parts.filter(Boolean).join(' ') };
  }

  private handoff(c: Ctx): Reply {
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
    };
  }

  private affirm(c: Ctx): Promise<Reply> | Reply {
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
    return { text: 'Great! What would you like to know? I can help with treatments, prices, insurance, opening hours or booking a visit.' };
  }

  private async urgentBooking(c: Ctx): Promise<Reply> {
    const t = c.state;
    t.chat.urgency = worst(t.chat.urgency, 'URGENT');
    const slots = await this.startBooking(c, 'Emergency visit');
    t.kind = 'urgent_booking';
    return { ...slots, text: `Let's get you seen as soon as possible. ${this.callLine(t.now)}\n${slots.text}` };
  }

  // ---------------------------------------------------------------- booking

  private startBooking(c: Ctx, service: string | undefined): Promise<Reply> {
    const chat = c.state.chat;
    chat.signals.booking = true;
    chat.pendingOffer = undefined;
    chat.bookingService = service ?? chat.bookingService ?? chat.service ?? 'Consultation';
    return this.offerSlots(c, this.preference(c.u));
  }

  private async offerSlots(c: Ctx, pref: SlotPreference): Promise<Reply> {
    const t = c.state;
    const chat = t.chat;
    t.kind = 'offer_slots';
    const wanted = this.describePreference(pref);
    let slots = await t.port.findSlots(pref);
    let lead = wanted
      ? `Here are the openings ${wanted}:`
      : `Here are the next available times for ${this.servicePhrase(chat.bookingService ?? 'Consultation')}:`;
    if (!slots.length && wanted) {
      slots = await t.port.findSlots({});
      lead = `I don't have anything open ${wanted}, but here are the next available times:`;
    }
    if (!slots.length) {
      chat.offered = [];
      chat.awaiting = 'contact';
      chat.purpose = 'callback';
      t.askedContact = true;
      const phone = this.phone();
      return {
        text: `I couldn't find an open time online in the next few weeks. If you share your name and phone number, the team will call you to find a time that works${phone ? ` — or call us at ${phone}` : ''}.`,
      };
    }
    chat.offered = slots;
    chat.awaiting = 'slot';
    t.offeredSlots = true;
    const list = slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
    return {
      text: `${lead}\n${list}\nWhich one works best? You can also tell me another day or time.`,
      suggestions: slots.map((s) => s.label),
    };
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

  private afterSlotChosen(c: Ctx): Promise<Reply> | Reply {
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
    return { text: `${chat.chosen!.label} — great choice. To hold it for you, could I get ${need}?` };
  }

  private afterContact(c: Ctx): Promise<Reply> | Reply {
    const t = c.state;
    const chat = t.chat;
    const ct = chat.contact;
    const first = firstName(ct.name);
    if (!ct.name && this.reachable(ct)) {
      t.askedContact = true;
      t.kind = 'ask_name';
      return { text: 'Thanks! And what name should I put this under?' };
    }
    if (ct.name && !this.reachable(ct)) {
      t.askedContact = true;
      t.kind = 'ask_phone';
      return { text: `Thanks, ${first}! What's the best phone number or email to reach you?` };
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

  private async reserve(c: Ctx): Promise<Reply> {
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
    };
  }

  // ---------------------------------------------------------------- finishing

  private finish(reply: Reply, skill: string, u: Understanding<Article>, t: Turn): Reply {
    const chat = t.chat;
    let text = reply.text.trim();
    const suggestions = [...(reply.suggestions ?? [])];

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

    const ctaKinds = ['knowledge', 'price', 'insurance', 'financing', 'new_patient', 'services'];
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

    if (!u.text.trim()) text = 'Could you type your question? I can help with treatments, prices, insurance, hours or booking.';
    return { text: text.replace(/\n{3,}/g, '\n\n'), suggestions: suggestions.length ? suggestions.slice(0, 4) : undefined, data: reply.data };
  }

  // ---------------------------------------------------------------- utilities

  /** Remember what a "yes" on the next turn means. */
  private offer(chat: ChatState, kind: NonNullable<ChatState['pendingOffer']>): void {
    chat.pendingOffer = kind;
    chat.offerTurn = chat.turn;
  }

  /** Record that an article informed this reply (for sources and follow-up context). */
  private use(t: Turn, a: Article): void {
    t.sources.push(a);
    if (a.category !== 'POLICY') t.chat.topics = [...t.chat.topics.filter((s) => s !== a.slug), a.slug].slice(-10);
  }

  /** "a consultation for dental implants", "an emergency visit", "a check-up and cleaning". */
  private servicePhrase(service: string): string {
    if (service === 'Consultation') return 'a consultation';
    if (/\b(visit|exam|check-up|checkup|cleaning|consultation)\b/i.test(service)) return `${/^[aeiou]/i.test(service) ? 'an' : 'a'} ${lower(service)}`;
    return `a consultation for ${lower(service)}`;
  }

  /** The article a follow-up question ("does it hurt?") refers to, if any. */
  private contextArticle(c: Ctx): Article | undefined {
    if (c.u.values.service?.length) return undefined;
    const last = c.state.chat.topics.at(-1);
    const a = last ? this.bySlug.get(last) : undefined;
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
  private isSpecific(query: string, a: Article): boolean {
    const topic = new Set(terms(`${a.title} ${a.tags.join(' ')}`));
    return this.index.analyze(query).original.some((term) => !topic.has(term) && !GENERIC_TERMS.has(term));
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

  private serviceFor(a: Article | undefined): string | undefined {
    return a?.service ?? undefined;
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
