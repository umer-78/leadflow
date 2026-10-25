/**
 * The patient chat window: messages with light formatting, appointment-time
 * buttons, an inline contact form, emergency and booking cards, quick replies
 * and call/directions buttons. Plain DOM, no framework, so it loads fast on any
 * clinic website. It talks to the assistant through a ChatTransport: HTTP for
 * the real widget, or the in-browser engine for the live demo.
 */

export interface Slot {
  startsAt: string;
  label: string;
}

export interface ReplyUi {
  slots?: Slot[];
  card?:
    | { type: 'emergency' | 'urgent'; title: string }
    | { type: 'booked'; service: string; label: string; startsAt: string; minutes: number; clinic: string; address?: string };
  form?: { fields: ('name' | 'phone' | 'email')[]; submit: string };
  actions?: { label: string; href: string; kind: 'call' | 'map' | 'email' | 'link' }[];
  sources?: string[];
}

export interface ChatReply {
  text: string;
  suggestions?: string[];
  ui?: ReplyUi;
}

export interface ChatClinic {
  name: string;
  phone?: string | null;
  phoneHref?: string | null;
  address?: string | null;
}

export interface ChatStart {
  clinic: ChatClinic;
  greeting: ChatReply;
  /** Earlier messages of a conversation being resumed, oldest first. */
  history: (ChatReply & { role: 'assistant' | 'visitor' })[];
}

export interface ChatTransport {
  start(): Promise<ChatStart>;
  send(message: string): Promise<ChatReply>;
  /** Forget the current conversation (the next message starts a new one). */
  reset(): void;
}

export interface ChatOptions {
  /** Running inside the website widget's iframe (shows a close button). */
  embedded?: boolean;
  onClose?: () => void;
  /** Send this message as soon as the chat is ready (e.g. "I'd like to book"). */
  autoMessage?: string;
  /** Called after every exchange (the demo uses it to update its lead panel). */
  onExchange?: (message: string, reply: ChatReply) => void;
  /** Skip the natural typing pause (tests, reduced motion). */
  instant?: boolean;
}

// ---------------------------------------------------------------- small helpers

type Attrs = Record<string, string | boolean | undefined>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | false | null | undefined)[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== false && c !== null && c !== undefined) el.append(c);
  return el;
}

const ICONS = {
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m22 4-10 10-3-3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  tooth:
    '<path d="M12 5.5c-1.5-1.3-3.4-2-5-1.5C4.6 4.7 4 7.4 4.6 9.6c.4 1.6 1 3 1.3 4.6.3 1.9.5 4.8 2 5.6 1.4.7 1.9-1.7 2.3-3 .3-1 .9-1.6 1.8-1.6s1.5.6 1.8 1.6c.4 1.3.9 3.7 2.3 3 1.5-.8 1.7-3.7 2-5.6.3-1.6.9-3 1.3-4.6.6-2.2 0-4.9-2.4-5.6-1.6-.5-3.5.2-5 1.5z"/>',
};

function icon(name: keyof typeof ICONS, size = 18): SVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return wrap.firstElementChild as SVGElement;
}

/** Plain text with links, phone numbers, emails and **bold** turned into elements. */
function inline(text: string): Node[] {
  const out: Node[] = [];
  const re = /(\*\*[^*]+\*\*)|(https?:\/\/[^\s)]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?:\+?1[\s.-]?)?\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(document.createTextNode(text.slice(last, m.index)));
    const [all, bold, url, mail, phone] = m;
    if (bold) out.push(h('strong', {}, bold.slice(2, -2)));
    else if (url) {
      const label = /google\.com\/maps/.test(url) ? 'Open in Maps' : url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) + (url.length > 52 ? '…' : '');
      out.push(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label));
    } else if (mail) out.push(h('a', { href: `mailto:${mail}` }, mail));
    else if (phone) out.push(h('a', { href: `tel:${phone.replace(/[^\d+]/g, '')}` }, phone));
    last = m.index! + all.length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}

/** Paragraphs, bullet lists and numbered lists from the assistant's plain text. */
function formatText(text: string, hideNumbered: boolean): HTMLElement {
  const box = h('div', { class: 'lf-text' });
  // Times shown as buttons: "Here are the openings on Monday:\n1. …\nWhich one works best?" reads as one sentence pair.
  if (hideNumbered) text = text.replace(/(:?)\n(?:\d+\.\s[^\n]*(?:\n|$))+/g, (_m, colon: string) => (colon ? '. ' : ' '));
  let list: HTMLElement | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^[•\-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered && hideNumbered) continue;
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol';
      if (!list || list.tagName.toLowerCase() !== tag) {
        list = h(tag);
        box.append(list);
      }
      list.append(h('li', {}, ...inline((bullet ?? numbered)![1])));
      continue;
    }
    list = null;
    if (line) box.append(h('p', {}, ...inline(line)));
  }
  return box;
}

const timeOf = (d = new Date()) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** An .ics file for "Add to calendar" (works with Apple, Google and Outlook calendars). */
function calendarFile(card: Extract<NonNullable<ReplyUi['card']>, { type: 'booked' }>): string {
  const start = new Date(card.startsAt);
  const end = new Date(start.getTime() + card.minutes * 60_000);
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LeadFlow//Website chat//EN',
    'BEGIN:VEVENT',
    `UID:${icsDate(start)}-${Math.random().toString(36).slice(2)}@leadflow`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(`${card.service} — ${card.clinic}`)}`,
    card.address ? `LOCATION:${esc(card.address)}` : '',
    'DESCRIPTION:Requested through the website chat. The clinic will confirm this time with you.',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Fri, Oct 16 at 2 PM" -> ["Fri, Oct 16", "2 PM"]. */
function splitLabel(label: string): [string, string] {
  const i = label.lastIndexOf(' at ');
  return i > 0 ? [label.slice(0, i), label.slice(i + 4)] : [label, label];
}

// ---------------------------------------------------------------- the chat window

export function mountChat(root: HTMLElement, transport: ChatTransport, options: ChatOptions = {}): void {
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const instant = options.instant || reduceMotion;

  const name = h('strong', {}, 'Loading…');
  const status = h('span', { class: 'lf-status' }, h('i', { class: 'lf-dot', 'aria-hidden': 'true' }), 'Virtual assistant · replies instantly');
  const callLink = h('a', { class: 'lf-icon-btn', 'aria-label': 'Call the clinic', title: 'Call', hidden: true }, icon('phone'));
  const restart = h('button', { class: 'lf-icon-btn', type: 'button', 'aria-label': 'Start a new conversation', title: 'Start over' }, icon('restart'));
  const close = h('button', { class: 'lf-icon-btn', type: 'button', 'aria-label': 'Close chat', title: 'Close', hidden: !options.embedded }, icon('close', 20));
  const header = h(
    'header',
    { class: 'lf-header' },
    h('div', { class: 'lf-avatar', 'aria-hidden': 'true' }, icon('tooth', 20)),
    h('div', { class: 'lf-title' }, name, status),
    callLink,
    restart,
    close
  );
  const log = h('main', { class: 'lf-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const chips = h('div', { class: 'lf-chips', role: 'group', 'aria-label': 'Suggested replies' });
  const input = h('textarea', { rows: '1', maxlength: '1000', placeholder: 'Type your message…', autocomplete: 'off', 'aria-label': 'Your message', disabled: true }) as HTMLTextAreaElement;
  const sendBtn = h('button', { type: 'submit', class: 'lf-send', 'aria-label': 'Send message', disabled: true }, icon('send'));
  const composer = h('form', { class: 'lf-composer' }, input, sendBtn);
  const footer = h('footer', { class: 'lf-footer' }, 'Automated assistant, not medical advice. In an emergency call 911.');
  const chat = h('div', { class: 'lf-chat', 'aria-busy': 'true' }, header, log, chips, composer, footer);
  root.replaceChildren(chat);

  let busy = false;
  let clinic: ChatClinic = { name: '' };
  let greeting: ChatReply | undefined;
  /** Interactive parts (time buttons, forms) of the newest assistant message only. */
  let liveParts: HTMLElement[] = [];

  const scroll = () => requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));

  function retireLiveParts() {
    for (const el of liveParts) {
      el.classList.add('lf-retired');
      el.querySelectorAll('button, input').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    }
    liveParts = [];
  }

  function setChips(list: string[] = []) {
    chips.replaceChildren(
      ...list.slice(0, 4).map((s) => {
        const b = h('button', { type: 'button' }, s);
        b.addEventListener('click', () => void submit(s));
        return b;
      })
    );
    scroll();
  }

  function addVisitor(text: string) {
    log.append(h('div', { class: 'lf-row lf-visitor' }, h('div', { class: 'lf-bubble', title: timeOf() }, text)));
    scroll();
  }

  function card(ui: ReplyUi): HTMLElement | null {
    const c = ui.card;
    if (!c) return null;
    if (c.type === 'booked') {
      const add = h('button', { type: 'button', class: 'lf-btn' }, icon('calendar', 16), 'Add to calendar');
      add.addEventListener('click', () => download('appointment.ics', calendarFile(c), 'text/calendar'));
      const directions = c.address
        ? h('a', { class: 'lf-btn', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`, target: '_blank', rel: 'noopener noreferrer' }, icon('pin', 16), 'Directions')
        : null;
      return h(
        'div',
        { class: 'lf-card lf-card-ok' },
        h('div', { class: 'lf-card-title' }, icon('check', 18), 'Appointment requested'),
        h('dl', {}, h('dt', {}, 'Treatment'), h('dd', {}, c.service), h('dt', {}, 'When'), h('dd', {}, c.label), c.address ? h('dt', {}, 'Where') : null, c.address ? h('dd', {}, c.address) : null),
        h('p', { class: 'lf-card-note' }, 'The clinic will confirm this time with you.'),
        h('div', { class: 'lf-card-actions' }, add, directions)
      );
    }
    return h(
      'div',
      { class: `lf-card ${c.type === 'emergency' ? 'lf-card-danger' : 'lf-card-warn'}`, role: 'alert' },
      h('div', { class: 'lf-card-title' }, icon('alert', 18), c.title)
    );
  }

  function slotPicker(slots: Slot[]): HTMLElement {
    const days = new Map<string, Slot[]>();
    for (const s of slots) {
      const [day] = splitLabel(s.label);
      days.set(day, [...(days.get(day) ?? []), s]);
    }
    const box = h('div', { class: 'lf-slots', role: 'group', 'aria-label': 'Available appointment times' });
    for (const [day, list] of days) {
      const times = h('div', { class: 'lf-slot-times' });
      for (const s of list) {
        const b = h('button', { type: 'button', class: 'lf-slot', 'aria-label': s.label }, splitLabel(s.label)[1]);
        b.addEventListener('click', () => void submit(s.label));
        times.append(b);
      }
      box.append(h('div', { class: 'lf-slot-day' }, h('span', {}, day), times));
    }
    const other = h('button', { type: 'button', class: 'lf-link-btn' }, 'Show other times');
    other.addEventListener('click', () => void submit('Do you have any other times?'));
    box.append(other);
    return box;
  }

  function contactForm(form: NonNullable<ReplyUi['form']>): HTMLElement {
    const fields = new Set(form.fields);
    const either = fields.has('phone') && fields.has('email');
    const nameIn = h('input', { name: 'name', autocomplete: 'name', placeholder: 'Full name', 'aria-label': 'Full name' }) as HTMLInputElement;
    const phoneIn = h('input', { name: 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: either ? 'Phone' : 'Phone number', 'aria-label': 'Phone number' }) as HTMLInputElement;
    const emailIn = h('input', { name: 'email', type: 'email', autocomplete: 'email', placeholder: either ? 'or email' : 'Email', 'aria-label': 'Email address' }) as HTMLInputElement;
    const error = h('p', { class: 'lf-form-error', role: 'alert', hidden: true });
    const submitBtn = h('button', { type: 'submit', class: 'lf-btn lf-btn-primary' }, form.submit);
    const el = h(
      'form',
      { class: 'lf-form', novalidate: true },
      fields.has('name') ? nameIn : null,
      fields.has('phone') ? phoneIn : null,
      fields.has('email') ? emailIn : null,
      error,
      submitBtn,
      h('p', { class: 'lf-form-note' }, 'Only shared with the clinic, to arrange your visit.')
    );
    el.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameV = nameIn.value.trim();
      const phoneV = phoneIn.value.trim();
      const emailV = emailIn.value.trim();
      const problems: string[] = [];
      if (fields.has('name') && nameV.length < 2) problems.push('your name');
      const phoneOk = phoneV.replace(/\D/g, '').length >= 7;
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailV);
      if (phoneV && !phoneOk) problems.push('a valid phone number');
      if (emailV && !emailOk) problems.push('a valid email');
      if ((fields.has('phone') || fields.has('email')) && !phoneOk && !emailOk && !problems.length) problems.push(either ? 'a phone number or email' : fields.has('phone') ? 'a phone number' : 'an email');
      if (problems.length) {
        error.textContent = `Please add ${problems.join(' and ')}.`;
        error.hidden = false;
        return;
      }
      const parts = [
        nameV ? `My name is ${nameV}` : '',
        phoneOk ? `my phone number is ${phoneV}` : '',
        emailOk ? `my email is ${emailV}` : '',
      ].filter(Boolean);
      void submit(parts.join(', ').replace(/^m/, 'M'));
    });
    return el;
  }

  function actions(list: NonNullable<ReplyUi['actions']>): HTMLElement {
    return h(
      'div',
      { class: 'lf-actions' },
      ...list.map((a) =>
        h(
          'a',
          { class: `lf-btn ${a.kind === 'call' ? 'lf-btn-primary' : ''}`, href: a.href, target: a.kind === 'map' || a.kind === 'link' ? '_blank' : undefined, rel: 'noopener noreferrer' },
          icon(a.kind === 'call' ? 'phone' : a.kind === 'map' ? 'pin' : a.kind === 'email' ? 'mail' : 'link', 16),
          a.label
        )
      )
    );
  }

  function addAssistant(reply: ChatReply, live: boolean) {
    const ui = reply.ui ?? {};
    const bubble = h('div', { class: 'lf-bubble', title: timeOf() });
    const cardEl = card(ui);
    if (cardEl && ui.card?.type !== 'booked') bubble.append(cardEl);
    bubble.append(formatText(reply.text, !!ui.slots?.length));
    if (cardEl && ui.card?.type === 'booked') bubble.append(cardEl);
    if (ui.sources?.length) bubble.append(h('p', { class: 'lf-sources' }, `From: ${ui.sources.join(' · ')}`));
    const row = h('div', { class: 'lf-row lf-assistant' }, bubble);
    if (ui.actions?.length) row.append(actions(ui.actions));
    if (live && ui.slots?.length) {
      const picker = slotPicker(ui.slots);
      row.append(picker);
      liveParts.push(picker);
    }
    if (live && ui.form) {
      const form = contactForm(ui.form);
      row.append(form);
      liveParts.push(form);
    }
    log.append(row);
    scroll();
  }

  function setTyping(on: boolean) {
    log.querySelector('.lf-typing')?.remove();
    if (on) {
      log.append(h('div', { class: 'lf-row lf-assistant lf-typing', 'aria-label': 'Assistant is typing' }, h('div', { class: 'lf-bubble' }, h('i'), h('i'), h('i'))));
      scroll();
    }
  }

  function setBusy(on: boolean) {
    busy = on;
    chat.toggleAttribute('data-busy', on);
    sendBtn.disabled = on || !input.value.trim();
  }

  function showError(message: string, retry?: () => void) {
    const el = h('div', { class: 'lf-error', role: 'alert' }, message);
    if (retry) {
      const b = h('button', { type: 'button' }, 'Try again');
      b.addEventListener('click', () => {
        el.remove();
        retry();
      });
      el.append(b);
    }
    log.append(el);
    scroll();
  }

  async function submit(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    retireLiveParts();
    addVisitor(message);
    setChips();
    input.value = '';
    autosize();
    setBusy(true);
    setTyping(true);
    const started = Date.now();
    try {
      const reply = await transport.send(message);
      // A short, natural pause: replies shouldn't appear before the typing dots do.
      const pause = instant ? 0 : Math.min(1400, 350 + reply.text.length * 6) - (Date.now() - started);
      if (pause > 0) await new Promise((r) => setTimeout(r, pause));
      setTyping(false);
      addAssistant(reply, true);
      // Times already appear as buttons; don't repeat them as chips.
      setChips(reply.ui?.slots?.length ? [] : reply.suggestions);
      options.onExchange?.(message, reply);
    } catch (err) {
      setTyping(false);
      log.querySelector('.lf-row.lf-visitor:last-of-type')?.remove();
      showError(err instanceof Error ? err.message : 'Could not send your message.', () => void submit(message));
    } finally {
      setBusy(false);
      if (!options.embedded || document.activeElement === input) input.focus();
    }
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    sendBtn.disabled = busy || !input.value.trim();
  }

  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit(input.value);
  });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(input.value);
    }
  });
  close.addEventListener('click', () => options.onClose?.());
  restart.addEventListener('click', () => {
    if (busy) return;
    transport.reset();
    liveParts = [];
    log.replaceChildren();
    if (greeting) {
      addAssistant(greeting, true);
      setChips(greeting.suggestions);
    }
    input.focus();
  });

  void (async () => {
    try {
      const startData = await transport.start();
      clinic = startData.clinic;
      greeting = startData.greeting;
      name.textContent = clinic.name;
      if (clinic.phoneHref) {
        callLink.setAttribute('href', clinic.phoneHref);
        callLink.setAttribute('title', `Call ${clinic.phone ?? ''}`.trim());
        callLink.hidden = false;
      }
      addAssistant(startData.greeting, !startData.history.length);
      startData.history.forEach((m, i) => {
        if (m.role === 'visitor') addVisitor(m.text);
        else addAssistant(m, i === startData.history.length - 1);
      });
      const last = startData.history[startData.history.length - 1];
      setChips(last ? (last.role === 'assistant' ? last.suggestions : []) : startData.greeting.suggestions);
      input.disabled = false;
      chat.setAttribute('aria-busy', 'false');
      if (options.autoMessage && !startData.history.length) void submit(options.autoMessage);
      else if (!options.embedded) input.focus();
    } catch (err) {
      name.textContent = 'Chat unavailable';
      chat.setAttribute('aria-busy', 'false');
      showError(err instanceof Error ? err.message : 'Could not load the chat.', () => location.reload());
    }
  })();
}
