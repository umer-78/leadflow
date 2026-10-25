/**
 * Sign up (creates a clinic + owner), sign in, sign out, current user.
 */
import { Router } from 'express';
import { eq, sql } from 'drizzle-orm';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  rateLimit,
  readCookie,
  resolveAuth,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
} from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { organizations, users } from '../db/schema.ts';
import { HttpError, body, email, route, str } from '../http.ts';
import { logActivity } from '../leads.ts';
import { createOrganization } from '../orgs.ts';
import { isValidTimeZone } from '../scheduling.ts';

export function publicUser(u: { id: string; email: string; name: string; role: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export function authRoutes(deps: AppDeps): Router {
  const { db, config } = deps;
  const r = Router();
  const secure = config.env === 'production';
  const limiter = rateLimit({ windowMs: 15 * 60_000, max: 20 });

  /** Public sign-in page hints: whether the demo clinic exists. */
  r.get(
    '/options',
    route(async (_req, res) => {
      const [demo] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.isDemo, true)).limit(1);
      res.json({ demo: !!demo });
    })
  );

  r.post(
    '/signup',
    limiter,
    route(async (req, res) => {
      const b = body(req);
      const clinicName = str(b, 'clinicName', { required: true, max: 120 })!;
      const name = str(b, 'name', { required: true, max: 120 })!;
      const userEmail = email(b, 'email', true)!;
      const password = str(b, 'password', { required: true, min: 8, max: 200 })!;
      const timezone = str(b, 'timezone', { max: 64 });
      if (timezone && !isValidTimeZone(timezone)) throw new HttpError(400, 'Unknown time zone.');

      const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${userEmail}`).limit(1);
      if (taken) throw new HttpError(409, 'An account with this email already exists. Please sign in.');

      const passwordHash = await hashPassword(password);
      const { user, org } = await db.transaction(async (tx) => {
        const org = await createOrganization(tx, { name: clinicName, timezone, email: userEmail });
        const [user] = await tx.insert(users).values({ orgId: org.id, email: userEmail, name, passwordHash, role: 'OWNER' }).returning();
        await logActivity(tx, org.id, 'ORG_CREATED', 'ORGANIZATION', org.id, { name: clinicName }, user.id);
        return { user, org };
      });
      const session = await createSession(db, user.id);
      setSessionCookie(res, session.token, session.expiresAt, secure);
      res.status(201).json({ user: publicUser(user), org: { id: org.id, name: org.name } });
    })
  );

  r.post(
    '/login',
    rateLimit({ windowMs: 15 * 60_000, max: 10, key: (req) => String(body(req).email ?? '').toLowerCase() }),
    route(async (req, res) => {
      const b = body(req);
      const userEmail = email(b, 'email', true)!;
      const password = str(b, 'password', { required: true, max: 200 })!;
      const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${userEmail}`).limit(1);
      // Same message either way, so emails can't be enumerated.
      if (!user || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'Incorrect email or password.');
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      const session = await createSession(db, user.id);
      setSessionCookie(res, session.token, session.expiresAt, secure);
      res.json({ user: publicUser(user) });
    })
  );

  r.post(
    '/logout',
    route(async (req, res) => {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) await destroySession(db, token);
      clearSessionCookie(res);
      res.json({ ok: true });
    })
  );

  r.get(
    '/me',
    route(async (req, res) => {
      const auth = await resolveAuth(db, req);
      // 200 with nulls when signed out, so the app can show the sign-in page without an error.
      if (!auth) {
        res.json({ user: null, org: null });
        return;
      }
      const { user, org } = auth;
      res.json({
        user: publicUser(user),
        org: { id: org.id, name: org.name, publicKey: org.publicKey, isDemo: org.isDemo, plan: org.plan, planStatus: org.planStatus, timezone: org.timezone },
      });
    })
  );

  return r;
}
