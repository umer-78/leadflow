/**
 * The Express application (without static assets or a listening socket, so
 * tests can mount it directly).
 */
import express from 'express';
import { sql } from 'drizzle-orm';
import type { Config } from './config.ts';
import type { DB } from './db/client.ts';
import { errorHandler, route } from './http.ts';
import type { PageFetcher } from './knowledge/importer.ts';
import type { Mailer } from './mailer.ts';
import { aiRoutes } from './routes/ai.ts';
import { authRoutes } from './routes/auth.ts';
import { billingRoutes } from './routes/billing.ts';
import { dashboardRoutes } from './routes/dashboard.ts';
import { knowledgeRoutes } from './routes/knowledge.ts';
import { appointmentLinksRoute, publicRoutes, unsubscribeRoute } from './routes/public.ts';
import { settingsRoutes } from './routes/settings.ts';

export interface AppDeps {
  db: DB;
  config: Config;
  mailer: Mailer;
  /** Ask the background worker to send queued email now. */
  kick?: () => void;
  /** How website pages are fetched for "Import from your website" (tests use a fake website). */
  fetchPage?: PageFetcher;
}

export function createApp(deps: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Stripe needs the raw body; everything else is JSON.
  app.use((req, res, next) => (req.path === '/api/billing/webhook' ? next() : express.json({ limit: '200kb' })(req, res, next)));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/') && req.path !== '/api/public/widget') res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get(
    '/api/health',
    route(async (_req, res) => {
      let database = 'ok';
      try {
        await deps.db.execute(sql`select 1`);
      } catch {
        database = 'unreachable';
      }
      res.status(database === 'ok' ? 200 : 503).json({
        status: database === 'ok' ? 'ok' : 'degraded',
        database,
        assistant: 'localbrain (on-device, no external AI)',
        email: deps.mailer.live ? 'resend' : 'log-only (set RESEND_API_KEY to send)',
        billing: deps.config.stripe.secretKey ? 'stripe' : 'disabled',
        time: new Date().toISOString(),
      });
    })
  );

  app.use('/api/auth', authRoutes(deps));
  app.use('/api/public', publicRoutes(deps));
  app.use('/api/knowledge', knowledgeRoutes(deps));
  app.use('/api/billing', billingRoutes(deps));
  app.use('/api/ai', aiRoutes(deps));
  app.use('/api', settingsRoutes(deps));
  app.use('/api', dashboardRoutes(deps));
  app.use(unsubscribeRoute(deps));
  app.use(appointmentLinksRoute(deps));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });
  app.use(errorHandler);
  return app;
}
