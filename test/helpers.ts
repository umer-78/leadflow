/** Shared test fixtures: the demo clinic's receptionist with an in-memory calendar. */
import { DEMO_CLINIC, demoArticles } from '../server/knowledge/demo.ts';
import { LIBRARY } from '../server/knowledge/library.ts';
import { Receptionist, newChatState, type Article, type ChatState, type ClinicPort, type TurnResult } from '../server/receptionist/engine.ts';
import { findSlots, formatSlot } from '../server/scheduling.ts';

export function toArticles(list: ReturnType<typeof demoArticles> | typeof LIBRARY): Article[] {
  return list.map((a, i) => ({
    id: `a${i}`,
    slug: a.slug,
    category: a.category,
    title: a.title,
    summary: a.summary,
    body: a.body,
    tags: a.tags,
    service: a.service ?? null,
    priceMin: 'priceMin' in a ? (a.priceMin ?? null) : null,
    priceMax: 'priceMax' in a ? (a.priceMax ?? null) : null,
    priceUnit: a.priceUnit ?? null,
    caseValue: a.caseValue ?? null,
    published: a.published ?? true,
  }));
}

/** Friday 16 Oct 2026, 10:00 in New York (clinic open 08:00-15:00). */
export const NOW = new Date('2026-10-16T14:00:00Z');

export function demoClinic(articles: Article[] = toArticles(demoArticles())) {
  const receptionist = new Receptionist({ ...DEMO_CLINIC, greeting: null }, articles);
  const busy: { start: Date; end: Date }[] = [];
  const bookings: { startsAt: string; service: string; contact: unknown }[] = [];
  const port: ClinicPort = {
    async findSlots(pref) {
      return findSlots({ now: NOW, tz: DEMO_CLINIC.timezone, hours: DEMO_CLINIC.hours, slotMinutes: 30, minNoticeHours: 2, busy, ...pref }).map((d) => ({
        startsAt: d.toISOString(),
        label: formatSlot(d, DEMO_CLINIC.timezone),
      }));
    },
    async reserve(slot, service, contact) {
      const start = new Date(slot.startsAt);
      if (busy.some((b) => b.start.getTime() === start.getTime())) return { ok: false, reason: 'taken' };
      busy.push({ start, end: new Date(start.getTime() + 30 * 60_000) });
      bookings.push({ startsAt: slot.startsAt, service, contact });
      return { ok: true, appointmentId: `apt-${bookings.length}` };
    },
  };

  /** Run a scripted conversation; returns every turn. */
  async function chat(messages: string[], state: ChatState = newChatState()): Promise<TurnResult[]> {
    const turns: TurnResult[] = [];
    for (const m of messages) {
      const t = await receptionist.respond(m, state, port, NOW);
      turns.push(t);
      state = t.state;
    }
    return turns;
  }
  return { receptionist, port, busy, bookings, chat };
}
