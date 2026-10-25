/**
 * Public endpoints used by the website widget, and the unsubscribe link.
 */
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { rateLimit } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { chatTurn, conversationHistory, widgetConfig } from '../chat.ts';
import { leads, organizations } from '../db/schema.ts';
import { HttpError, body, route, str } from '../http.ts';
import { logActivity, skipPendingFollowups } from '../leads.ts';

const KEY = /^pk_[A-Za-z0-9_-]{6,64}$/;
const VISITOR = /^[A-Za-z0-9_-]{8,64}$/;

function key(raw: string | undefined): string {
  if (!raw || !KEY.test(raw)) throw new HttpError(404, 'This chat is not available.');
  return raw;
}

export function publicRoutes(deps: AppDeps): Router {
  const r = Router();
  const chatLimiter = rateLimit({ windowMs: 60_000, max: 30, key: (req) => req.params.key ?? '' });

  r.get(
    '/widget/:key',
    route(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(await widgetConfig(deps, key(req.params.key)));
    })
  );

  r.get(
    '/chat/:key/:conversationId',
    route(async (req, res) => {
      const visitorId = String(req.query.visitorId ?? '');
      if (!VISITOR.test(visitorId)) throw new HttpError(400, 'visitorId is required.');
      res.json(await conversationHistory(deps, key(req.params.key), req.params.conversationId, visitorId));
    })
  );

  r.post(
    '/chat/:key',
    chatLimiter,
    route(async (req, res) => {
      const b = body(req);
      const visitorId = str(b, 'visitorId', { required: true, max: 64 })!;
      if (!VISITOR.test(visitorId)) throw new HttpError(400, 'Invalid visitorId.');
      const message = str(b, 'message', { required: true, max: 1000 })!;
      const result = await chatTurn(deps, {
        publicKey: key(req.params.key),
        conversationId: str(b, 'conversationId', { max: 64 }),
        visitorId,
        message,
        pageUrl: str(b, 'pageUrl', { max: 500 }),
      });
      res.json(result);
    })
  );

  return r;
}

const page = (title: string, text: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f9;color:#1f2937;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:32px;max-width:440px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0;line-height:1.5;color:#4b5563}</style>
</head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** GET /u/:token — one-click unsubscribe from follow-up emails. */
export function unsubscribeRoute(deps: AppDeps): Router {
  const r = Router();
  r.get(
    '/u/:token',
    route(async (req, res) => {
      const token = req.params.token;
      const [lead] = /^[A-Za-z0-9_-]{20,64}$/.test(token)
        ? await deps.db.select().from(leads).where(eq(leads.unsubscribeToken, token)).limit(1)
        : [];
      if (!lead) {
        res.status(404).type('html').send(page('Link not recognised', 'This unsubscribe link is not valid or has expired.'));
        return;
      }
      if (!lead.optedOut) {
        await deps.db.update(leads).set({ optedOut: true, status: 'DO_NOT_CONTACT', updatedAt: new Date() }).where(eq(leads.id, lead.id));
        await skipPendingFollowups(deps.db, lead.id, 'Lead unsubscribed');
        await logActivity(deps.db, lead.orgId, 'LEAD_UNSUBSCRIBED', 'LEAD', lead.id);
      }
      const [org] = await deps.db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, lead.orgId));
      res.type('html').send(page("You're unsubscribed", `You won't receive any more follow-up emails from ${escapeHtml(org?.name ?? 'this clinic')}.`));
    })
  );
  return r;
}
