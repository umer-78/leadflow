/**
 * Email delivery. With RESEND_API_KEY set, mail goes out through Resend's
 * HTTP API. Without it, nothing is sent: messages are kept in the outbox as
 * LOGGED so the team can see exactly what would have gone out.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** True when a real provider is configured. */
  readonly live: boolean;
  send(message: MailMessage): Promise<{ id?: string }>;
}

export function createMailer(options: { resendApiKey?: string; from: string }): Mailer {
  const { resendApiKey, from } = options;
  if (!resendApiKey) {
    return { live: false, send: async () => ({}) };
  }
  return {
    live: true,
    async send(m) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(`Email provider rejected the message (${res.status}): ${body.message ?? res.statusText}`);
      return { id: body.id };
    },
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text -> simple, readable HTML (paragraphs and clickable links). */
export function textToHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => escapeHtml(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>'));
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px">${paragraphs
    .map((p) => `<p style="margin:0 0 14px">${p}</p>`)
    .join('')}</div>`;
}
