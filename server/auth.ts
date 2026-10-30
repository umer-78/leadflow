/**
 * Authentication: scrypt password hashes, opaque session tokens (only their
 * SHA-256 is stored), cookie handling and role-based access control.
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { and, eq, gt, lt } from 'drizzle-orm';
import { ipKeyGenerator, rateLimit as expressRateLimit } from 'express-rate-limit';
import type { DB } from './db/client.ts';
import { organizations, sessions, users, type Organization, type Role, type User } from './db/schema.ts';
import { HttpError } from './http.ts';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(actual, expected);
}

export const SESSION_COOKIE = 'lf_session';
const SESSION_DAYS = 30;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(db: DB, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });
  // Opportunistic cleanup of expired sessions.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function destroySession(db: DB, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure, expires: expiresAt, path: '/' });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export interface AuthContext {
  user: Pick<User, 'id' | 'orgId' | 'email' | 'name' | 'role'>;
  org: Organization;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** The signed-in user and organization for this request, if any. */
export async function resolveAuth(db: DB, req: Request): Promise<AuthContext | undefined> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return undefined;
  const rows = await db
    .select({ user: users, org: organizations })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows.length) return undefined;
  const { user, org } = rows[0];
  return { user: { id: user.id, orgId: user.orgId, email: user.email, name: user.name, role: user.role }, org };
}

/** Resolve the session cookie into req.auth, or respond 401. */
export function requireAuth(db: DB) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = await resolveAuth(db, req);
      if (!auth) throw new HttpError(401, 'Please sign in.');
      req.auth = auth;
      next();
    } catch (err) {
      next(err);
    }
  };
}

const RANK: Record<Role, number> = { VIEWER: 0, STAFF: 1, ADMIN: 2, OWNER: 3 };

/** Allow the request only if the user's role is at least `minimum`. */
export function requireRole(minimum: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.auth?.user.role;
    if (!role) return next(new HttpError(401, 'Please sign in.'));
    if (RANK[role] < RANK[minimum]) return next(new HttpError(403, 'Your role does not allow this action.'));
    next();
  };
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * Fixed-window rate limiter keyed by IP (+ optional extra key), in memory. Built on
 * express-rate-limit so security scanners recognise it; IPv6 addresses are grouped by /56.
 */
export function rateLimit(options: { windowMs: number; max: number; key?: (req: Request) => string }) {
  return expressRateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}|${options.key?.(req as Request) ?? ''}`,
    handler: (req, res, next) => {
      const reset = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      res.setHeader('Retry-After', Math.max(1, Math.ceil(((reset?.getTime() ?? Date.now() + options.windowMs) - Date.now()) / 1000)));
      next(new HttpError(429, 'Too many requests. Please slow down and try again shortly.'));
    },
  });
}
