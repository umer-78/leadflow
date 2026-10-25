/**
 * The live demo on the marketing site. This is the real receptionist engine,
 * the demo clinic's knowledge base, the slot finder and the lead scorer,
 * bundled to run entirely in the visitor's browser: no server, no AI service.
 * A side panel shows what the assistant understood and the lead it creates.
 */
import '../chat/chat.css';
import './demo.css';
import { mountChat, type ChatReply, type ChatTransport } from '../chat/view.ts';
import { DEMO_CLINIC, demoArticles } from '../../server/knowledge/demo.ts';
import { Receptionist, newChatState, type Article, type ChatState, type ClinicPort, type TurnResult } from '../../server/receptionist/engine.ts';
import { scoreLead } from '../../server/receptionist/scoring.ts';
import { findSlots, formatSlot } from '../../server/scheduling.ts';
import { formatPhone } from '../../packages/localbrain/src/index.ts';

const clinic = { ...DEMO_CLINIC, greeting: null };
const articles: Article[] = demoArticles().map((a, i) => ({
  id: `a${i}`,
  slug: a.slug,
  category: a.category,
  title: a.title,
  summary: a.summary,
  body: a.body,
  tags: a.tags,
  service: a.service ?? null,
  priceMin: a.priceMin,
  priceMax: a.priceMax,
  priceUnit: a.priceUnit ?? null,
  caseValue: a.caseValue ?? null,
  published: a.published ?? true,
}));
const receptionist = new Receptionist(clinic, articles);

let state: ChatState = newChatState();
let busy: { start: Date; end: Date }[] = [];
let appointments: { label: string; service: string }[] = [];
let alerts: string[] = [];
let lastTurn: TurnResult | undefined;

const port: ClinicPort = {
  async findSlots(pref) {
    return findSlots({ now: new Date(), tz: clinic.timezone, hours: clinic.hours, slotMinutes: clinic.slotMinutes, minNoticeHours: clinic.minNoticeHours, busy, ...pref }).map(
      (d) => ({ startsAt: d.toISOString(), label: formatSlot(d, clinic.timezone) })
    );
  },
  async reserve(slot, service) {
    const start = new Date(slot.startsAt);
    if (busy.some((b) => b.start.getTime() === start.getTime())) return { ok: false, reason: 'taken' };
    busy.push({ start, end: new Date(start.getTime() + clinic.slotMinutes * 60_000) });
    appointments.push({ label: slot.label, service });
    return { ok: true, appointmentId: `demo-${appointments.length}` };
  },
};

const transport: ChatTransport = {
  async start() {
    return {
      clinic: { name: 'Brightside Dental (demo)', phone: formatPhone(clinic.phone), phoneHref: `tel:${clinic.phone}`, address: clinic.address },
      greeting: receptionist.greeting(),
      history: [],
    };
  },
  async send(message: string): Promise<ChatReply> {
    const turn = await receptionist.respond(message, state, port, new Date());
    state = turn.state;
    lastTurn = turn;
    if (turn.events.escalate) alerts.push(`${turn.events.escalate.level === 'ER' ? 'Emergency' : turn.events.escalate.level === 'URGENT' ? 'Urgent' : 'Call back'}: ${turn.events.escalate.reason}`);
    renderPanel();
    return turn.reply;
  },
  reset() {
    state = newChatState();
    busy = [];
    appointments = [];
    alerts = [];
    lastTurn = undefined;
    renderPanel();
  },
};

// ---------------------------------------------------------------- side panel

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderPanel(): void {
  const panel = document.getElementById('lf-demo-panel');
  if (!panel) return;
  const c = state.contact;
  const caseValue = receptionist.caseValueFor(state.service);
  const preferred = state.signals.preferredDate ? new Date(`${state.signals.preferredDate}T12:00:00Z`) : undefined;
  const score = scoreLead({
    service: state.service,
    caseValue,
    hasName: !!c.name,
    hasPhone: !!c.phone,
    hasEmail: !!c.email,
    appointmentRequested: appointments.length > 0,
    askedToBook: !!state.signals.booking,
    urgent: state.urgency === 'URGENT' || state.urgency === 'ER',
    wantsSoon: !!preferred && preferred.getTime() - Date.now() < 14 * 86_400_000,
    buyingSignals: [state.signals.price, state.signals.insurance, state.signals.financing].filter(Boolean).length,
    visitorMessages: state.visitorMessages,
    optedOut: !!state.optedOut,
  });
  const tier = score.tier.toLowerCase();
  const reachable = !!(c.phone || c.email);
  const stopped = state.optedOut ? 'Stopped: the patient opted out' : appointments.length ? 'Stopped: the patient booked' : '';
  const steps = [
    ['Day 0', 'Thanks + answers about their treatment'],
    ['Day 1', 'A gentle reminder with an easy way to book'],
    ['Day 3', 'The most common question, answered'],
    ['Day 7', 'A final, no-pressure check-in'],
  ];
  const meta = lastTurn?.meta;
  const understood = meta
    ? `<dl class="lfd-dl">
        <dt>Handled as</dt><dd>${esc(meta.skill.replace(/_/g, ' '))}</dd>
        ${meta.intent ? `<dt>Intent</dt><dd>${esc(meta.intent.replace(/_/g, ' '))} <span class="lfd-muted">(${Math.round((meta.confidence ?? 0) * 100)}%)</span></dd>` : ''}
        ${meta.safety ? `<dt>Safety</dt><dd class="lfd-alert">${esc(meta.safety)} — ${esc(meta.safetyReason ?? '')}</dd>` : ''}
        ${meta.sources.length ? `<dt>Answered from</dt><dd>${meta.sources.map((s) => esc(s.title)).join(', ')}</dd>` : ''}
        ${meta.unanswered ? `<dt>Learning</dt><dd>Listed for the clinic to teach an answer</dd>` : ''}
      </dl>`
    : '<p class="lfd-muted">Send a message to see how it was understood.</p>';

  panel.innerHTML = `
    <h3>The lead it creates</h3>
    <div class="lfd-score lfd-${tier}">
      <span class="lfd-tag">${esc(score.tier)} intent</span>
      <b>${score.score}<span>/100</span></b>
    </div>
    ${score.estimatedValue ? `<p class="lfd-value">Estimated value <b>$${score.estimatedValue.toLocaleString('en-US')}</b></p>` : ''}
    <ul class="lfd-reasons">${score.reasons.length ? score.reasons.map((r) => `<li>${esc(r)}</li>`).join('') : '<li class="lfd-muted">No signals yet</li>'}</ul>
    <h3>Details captured</h3>
    <dl class="lfd-dl">
      <dt>Name</dt><dd>${c.name ? esc(c.name) : '<span class="lfd-muted">—</span>'}</dd>
      <dt>Phone</dt><dd>${c.phone ? esc(formatPhone(c.phone)) : '<span class="lfd-muted">—</span>'}</dd>
      <dt>Email</dt><dd>${c.email ? esc(c.email) : '<span class="lfd-muted">—</span>'}</dd>
      <dt>Interested in</dt><dd>${state.service ? esc(state.service) : '<span class="lfd-muted">—</span>'}</dd>
      <dt>Appointment</dt><dd>${appointments.length ? appointments.map((a) => `${esc(a.service)}, ${esc(a.label)}`).join('<br>') : '<span class="lfd-muted">—</span>'}</dd>
    </dl>
    <h3>What the AI understood</h3>
    ${understood}
    <h3>Follow-up emails</h3>
    <ol class="lfd-steps ${stopped || !reachable ? 'lfd-off' : ''}">${steps.map(([d, t]) => `<li><b>${d}</b><span>${t}</span></li>`).join('')}</ol>
    <p class="lfd-muted lfd-small">${stopped || (reachable ? 'Scheduled. Each one is skipped the moment the patient replies, books or opts out.' : 'Starts once the patient shares an email or phone number.')}</p>
    ${alerts.length ? `<h3>Team alerts</h3><ul class="lfd-alerts">${alerts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
  `;
}

function start(): void {
  const root = document.getElementById('lf-demo-chat');
  if (!root) return;
  mountChat(root, transport, { instant: false });
  renderPanel();
  document.querySelectorAll<HTMLButtonElement>('[data-lf-example]').forEach((b) =>
    b.addEventListener('click', () => {
      const input = root.querySelector('textarea');
      if (!input) return;
      input.value = b.dataset.lfExample ?? '';
      input.dispatchEvent(new Event('input'));
      root.querySelector('form')?.requestSubmit();
    })
  );
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
