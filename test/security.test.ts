import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageSecurityHeaders } from '../server/security.ts';

test('the dashboard can never be framed and runs no inline scripts', () => {
  const h = pageSecurityHeaders('/leads', true);
  assert.match(h['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(h['Content-Security-Policy'], /script-src 'self'(;|$)/);
  assert.match(h['Content-Security-Policy'], /script-src-attr 'none'/);
  assert.match(h['Content-Security-Policy'], /object-src 'none'/);
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.match(h['Strict-Transport-Security'], /max-age=/);
});

test('the chat page stays embeddable on clinic websites', () => {
  const h = pageSecurityHeaders('/chat.html', false);
  assert.match(h['Content-Security-Policy'], /frame-ancestors \*/);
  assert.equal(h['X-Frame-Options'], undefined);
  assert.equal(h['Strict-Transport-Security'], undefined); // only over https
});
