/**
 * The website chat (standalone page or embedded via /widget.js). Plain
 * TypeScript, no framework, so it loads fast on any clinic website.
 */
import './chat.css';

interface Reply {
  text: string;
  suggestions?: string[];
}

const params = new URLSearchParams(location.search);
const key = params.get('key') ?? '';
const embedded = params.get('embed') === '1';
const wantsBooking = params.get('book') === '1';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const root = $('chat');
const log = $('log');
const suggestionsEl = $('suggestions');
const form = $<HTMLFormElement>('composer');
const input = $<HTMLTextAreaElement>('input');
const send = $<HTMLButtonElement>('send');

if (embedded) {
  document.body.classList.add('embed');
  const close = $<HTMLButtonElement>('close');
  close.hidden = false;
  close.addEventListener('click', () => parent.postMessage({ type: 'leadflow:close' }, '*'));
}

// ---- persistent identity (per clinic) — survives page loads, never leaves this browser except to this clinic's chat
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`leadflow:${key}:${k}`);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`leadflow:${key}:${k}`, v);
    } catch {
      /* private mode: the chat still works for this page view */
    }
  },
};

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'v_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let visitorId = store.get('visitor') ?? '';
if (!/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) {
  visitorId = randomId();
  store.set('visitor', visitorId);
}
let conversationId = store.get('conversation') ?? undefined;
let busy = false;

// ---- rendering
function linkify(el: HTMLElement, text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  for (const part of parts) {
    if (/^https?:\/\//.test(part)) {
      const a = document.createElement('a');
      a.href = part;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = part.length > 48 ? part.slice(0, 45) + '…' : part;
      el.append(a);
    } else {
      el.append(document.createTextNode(part));
    }
  }
}

function addMessage(role: 'assistant' | 'visitor', text: string) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  linkify(el, text);
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

function showSuggestions(list: string[] = []) {
  // Chips take space from the log; keep the newest message in view.
  requestAnimationFrame(() => (log.scrollTop = log.scrollHeight));
  suggestionsEl.replaceChildren(
    ...list.slice(0, 4).map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s;
      b.addEventListener('click', () => void submit(s));
      return b;
    })
  );
}

function setBusy(on: boolean) {
  busy = on;
  send.disabled = on || !input.value.trim();
  document.querySelector('.typing')?.remove();
  if (on) {
    const t = document.createElement('div');
    t.className = 'typing';
    t.setAttribute('aria-label', 'Assistant is typing');
    t.innerHTML = '<i></i><i></i><i></i>';
    log.append(t);
    log.scrollTop = log.scrollHeight;
  }
}

function showError(message: string, retry?: () => void) {
  const el = document.createElement('div');
  el.className = 'msg error';
  el.textContent = message;
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Try again';
    b.addEventListener('click', () => {
      el.remove();
      retry();
    });
    el.append(b);
  }
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

// ---- networking
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong.');
  return data as T;
}

async function submit(text: string) {
  const message = text.trim();
  if (!message || busy) return;
  addMessage('visitor', message);
  showSuggestions();
  input.value = '';
  autosize();
  setBusy(true);
  try {
    const data = await request<{ conversationId: string; reply: Reply }>(`/chat/${encodeURIComponent(key)}`, {
      method: 'POST',
      body: JSON.stringify({ visitorId, conversationId, message, pageUrl: document.referrer || location.href }),
    });
    conversationId = data.conversationId;
    store.set('conversation', conversationId);
    setBusy(false);
    addMessage('assistant', data.reply.text);
    showSuggestions(data.reply.suggestions);
  } catch (err) {
    setBusy(false);
    log.lastElementChild?.classList.contains('visitor') && log.lastElementChild.remove();
    showError(err instanceof Error ? err.message : 'Could not send your message.', () => void submit(message));
  }
  input.focus();
}

function autosize() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  send.disabled = busy || !input.value.trim();
}

form.addEventListener('submit', (e) => {
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

// ---- start
async function start() {
  if (!key) {
    $('clinic-name').textContent = 'Chat unavailable';
    showError('This chat link is missing its clinic key.');
    return;
  }
  try {
    const config = await request<{ clinic: { name: string }; greeting: Reply }>(`/widget/${encodeURIComponent(key)}`);
    $('clinic-name').textContent = config.clinic.name;
    document.title = `Chat with ${config.clinic.name}`;
    let restored = false;
    if (conversationId) {
      const history = await request<{ messages: { role: 'assistant' | 'visitor'; body: string; suggestions?: string[] }[] }>(
        `/chat/${encodeURIComponent(key)}/${encodeURIComponent(conversationId)}?visitorId=${encodeURIComponent(visitorId)}`
      ).catch(() => ({ messages: [] }));
      if (history.messages.length) {
        restored = true;
        addMessage('assistant', config.greeting.text);
        for (const m of history.messages) addMessage(m.role, m.body);
        const last = history.messages[history.messages.length - 1];
        showSuggestions(last.role === 'assistant' ? last.suggestions : []);
      } else {
        conversationId = undefined;
      }
    }
    if (!restored) {
      addMessage('assistant', config.greeting.text);
      showSuggestions(config.greeting.suggestions);
    }
    input.disabled = false;
    root.setAttribute('aria-busy', 'false');
    if (wantsBooking && !restored) void submit("I'd like to book an appointment");
    else if (!embedded) input.focus();
  } catch (err) {
    $('clinic-name').textContent = 'Chat unavailable';
    showError(err instanceof Error ? err.message : 'Could not load the chat.', () => location.reload());
  }
}

void start();
