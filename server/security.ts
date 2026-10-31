/**
 * Security headers for the HTML pages the server sends in production.
 *
 * Everything the pages load comes from this server (the built bundles, no
 * CDNs, no external fonts), so the Content-Security-Policy can be strict:
 * scripts and connections only to 'self', no inline scripts, no plugins.
 * The one difference between pages is framing. The dashboard must never be
 * framed (clickjacking); the chat page exists to be framed by the clinic's own
 * website through widget.js, on any domain, so it allows any ancestor.
 */
export function pageSecurityHeaders(pathname: string, secure: boolean): Record<string, string> {
  const embeddable = pathname === '/chat.html' || pathname === '/chat';
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    // React and the widget set style attributes; stylesheets stay same-origin
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${embeddable ? '*' : "'none'"}`,
  ].join('; ');
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': embeddable ? 'unsafe-none' : 'same-origin',
  };
  if (!embeddable) headers['X-Frame-Options'] = 'DENY';
  if (secure) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return headers;
}
