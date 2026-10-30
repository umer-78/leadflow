/**
 * AI Center: the assistant's workload, answer quality, setup checks,
 * self-test and knowledge updates (see ai-center.ts).
 */
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { aiActivity, selfTest, setupChecks, updateStatus } from '../ai-center.ts';
import { route } from '../http.ts';
import { syncClinicLibrary } from '../knowledge/sync.ts';
import { logActivity } from '../leads.ts';

const PERIODS = [7, 30, 90];

export function aiRoutes(deps: AppDeps): Router {
  const { db } = deps;
  const r = Router();
  r.use(requireAuth(db));

  r.get(
    '/activity',
    route(async (req, res) => {
      const days = PERIODS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
      res.json(await aiActivity(db, req.auth!.org, days));
    })
  );

  r.get(
    '/checks',
    route(async (req, res) => {
      res.json({ checks: await setupChecks(db, req.auth!.org, deps.mailer.live) });
    })
  );

  r.post(
    '/self-test',
    requireRole('STAFF'),
    route(async (req, res) => {
      const probes = await selfTest(db, req.auth!.org);
      res.json({ probes, ranAt: new Date().toISOString() });
    })
  );

  r.get(
    '/updates',
    route(async (req, res) => {
      res.json(await updateStatus(db, req.auth!.org));
    })
  );

  r.post(
    '/updates/apply',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const changed = await syncClinicLibrary(db, org);
      if (changed.updated || changed.added || changed.retired) {
        await logActivity(db, org.id, 'LIBRARY_UPDATED', 'KNOWLEDGE', null, changed, req.auth!.user.id);
      }
      res.json({ changed, status: await updateStatus(db, org) });
    })
  );

  return r;
}
