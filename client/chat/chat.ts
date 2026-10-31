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

// Every failure reaches the patient as a sentence they can act on: the server's
// own message when it sent one, otherwise a plain explanation. A raw
// "Failed to fetch" or "Cannot read properties of undefined" never shows.
async function request<T>(path: string, init?: RequestInit, valid?: (data: unknown) => boolean): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/public${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  } catch {
    throw new Error(navigator.onLine === false ? 'You seem to be offline. Check your connection and try again.' : 'Could not reach the assistant. Please try again in a moment.');
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : '';
    throw new Error(message || (res.status === 429 ? 'Lots of messages at once. Please wait a moment and try again.' : 'Something went wrong. Please try again.'));
  }
  if (data === null || (valid && !valid(data))) throw new Error('The assistant sent an answer this page could not read. Please reload and try again.');
  return data as T;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const http: ChatTransport = {
  async start(): Promise<ChatStart> {
    if (!key) throw new Error('This chat link is missing its clinic key.');
    const config = await request<{ clinic: ChatStart['clinic']; greeting: ChatReply }>(
      `/widget/${encodeURIComponent(key)}`,
      undefined,
      (d) => isObject(d) && isObject(d.clinic) && typeof d.clinic.name === 'string' && isObject(d.greeting) && typeof d.greeting.text === 'string'
    );
    document.title = `Chat with ${config.clinic.name}`;
    let history: ChatStart['history'] = [];
    if (conversationId) {
      const past = await request<{ messages: { role: 'assistant' | 'visitor'; body: string; suggestions?: string[]; ui?: ChatReply['ui'] }[] }>(
        `/chat/${encodeURIComponent(key)}/${encodeURIComponent(conversationId)}?visitorId=${encodeURIComponent(visitorId)}`,
        undefined,
        (d) => isObject(d) && Array.isArray(d.messages)
      ).catch(() => ({ messages: [] }));
      history = past.messages.map((m) => ({ role: m.role, text: m.body, suggestions: m.suggestions, ui: m.ui }));
      if (!history.length) conversationId = undefined;
    }
    return { clinic: config.clinic, greeting: config.greeting, history };
  },
  async send(message: string): Promise<ChatReply> {
    const data = await request<{ conversationId: string; reply: ChatReply }>(
      `/chat/${encodeURIComponent(key)}`,
      {
        method: 'POST',
        body: JSON.stringify({ visitorId, conversationId, message, pageUrl: document.referrer || location.href }),
      },
      (d) => isObject(d) && typeof d.conversationId === 'string' && isObject(d.reply) && typeof d.reply.text === 'string'
    );
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
