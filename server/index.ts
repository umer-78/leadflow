/**
 * Server entry point: database, migrations, demo data, background worker,
 * API and the web app (Vite in development, built files in production).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.ts';
import { createClaudeAnswerer } from './claude.ts';
import { loadConfig } from './config.ts';
import { connect, runMigrations } from './db/client.ts';
import { createMailer } from './mailer.ts';
import { syncLibrary } from './knowledge/sync.ts';
import { ensureDemo } from './orgs.ts';
import { startWorker } from './worker.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const config = loadConfig();
  const database = connect(config.databaseUrl);
  await runMigrations(database.db);
  if (config.seedDemo) await ensureDemo(database.db);
  // Corrected and new library articles reach existing clinics (in the background: it never blocks start-up).
  void syncLibrary(database.db)
    .then((r) => r.clinics && console.log(`[leadflow] knowledge library: ${r.updated} updated, ${r.added} added, ${r.retired} retired across ${r.clinics} clinic(s)`))
    .catch((err) => console.error('[leadflow] knowledge library sync failed', err));

  const mailer = createMailer(config.email);
  const worker = config.runWorker ? startWorker({ db: database.db, mailer, config }, config.workerIntervalMs) : undefined;
  const { apiKey } = config.anthropic;
  const claude = apiKey ? createClaudeAnswerer({ ...config.anthropic, apiKey }) : undefined;
  if (claude) console.log(`[leadflow] Claude answers on: ${claude.model} (effort ${config.anthropic.effort})`);
  const app = createApp({ db: database.db, config, mailer, claude, kick: () => void worker?.tick() });

  if (config.env === 'production') {
    const dist = path.join(root, 'dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    // The dashboard's page is read once, so serving it doesn't touch the disk on every request.
    const indexHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
    app.get(/^\/(?!api\/|u\/|a\/).*/, (_req, res) => res.type('html').send(indexHtml));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    const url = config.publicUrl ?? `http://localhost:${config.port}`;
    console.log(`[leadflow] running on ${url}`);
    if (config.seedDemo) console.log('[leadflow] demo clinic ready — sign in with demo@leadflow.local / demo1234');
    if (!mailer.live) console.log('[leadflow] email: log-only (set RESEND_API_KEY to send real email)');
  });

  const shutdown = () => {
    worker?.stop();
    server.close(() => void database.close().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[leadflow] failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
