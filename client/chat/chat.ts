/**
 * The website chat page (standalone, or embedded by /widget.js). Talks to the
 * clinic's LeadFlow server; the window itself lives in view.ts.
 */
import './chat.css';
import { mountChat, type ChatReply, type ChatStart, type ChatTransport } from './view.ts';

const params = new URLSearchParams(location.search);
const key = params.get('key') ?? '';
const embedded = params.get('embed') === '1';
const color = params.get('color') ?? '';
if (/^#[0-9a-f]{3,8}$/i.test(color)) document.documentElement.style.setProperty('--lf-brand', color);
if (embedded) document.body.classList.add('lf-embedded');

// ---- identity that survives page loads (per clinic, only ever sent to this clinic's chat)
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(`leadflow:${key}:${k}`);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(`leadflow:${key}:${k}`);
      else localStorage.setItem(`leadflow:${key}:${k}`, v);
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/public${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong. Please try again.');
  return data as T;
}

const http: ChatTransport = {
  async start(): Promise<ChatStart> {
    if (!key) throw new Error('This chat link is missing its clinic key.');
    const config = await request<{ clinic: ChatStart['clinic']; greeting: ChatReply }>(`/widget/${encodeURIComponent(key)}`);
    document.title = `Chat with ${config.clinic.name}`;
    let history: ChatStart['history'] = [];
    if (conversationId) {
      const past = await request<{ messages: { role: 'assistant' | 'visitor'; body: string; suggestions?: string[]; ui?: ChatReply['ui'] }[] }>(
        `/chat/${encodeURIComponent(key)}/${encodeURIComponent(conversationId)}?visitorId=${encodeURIComponent(visitorId)}`
      ).catch(() => ({ messages: [] }));
      history = past.messages.map((m) => ({ role: m.role, text: m.body, suggestions: m.suggestions, ui: m.ui }));
      if (!history.length) conversationId = undefined;
    }
    return { clinic: config.clinic, greeting: config.greeting, history };
  },
  async send(message: string): Promise<ChatReply> {
    const data = await request<{ conversationId: string; reply: ChatReply }>(`/chat/${encodeURIComponent(key)}`, {
      method: 'POST',
      body: JSON.stringify({ visitorId, conversationId, message, pageUrl: document.referrer || location.href }),
    });
    conversationId = data.conversationId;
    store.set('conversation', conversationId);
    return data.reply;
  },
  reset() {
    conversationId = undefined;
    store.set('conversation', null);
  },
};

mountChat(document.getElementById('chat')!, http, {
  embedded,
  onClose: () => parent.postMessage({ type: 'leadflow:close' }, '*'),
  autoMessage: params.get('book') === '1' ? "I'd like to book an appointment" : undefined,
});
