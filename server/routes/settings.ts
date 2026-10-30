/**
 * Clinic settings, team management and the user's own profile.
 */
import { Router } from 'express';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import { hashPassword, requireAuth, requireRole, roleAtLeast, verifyPassword } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { organizations, users, type DayKey, type Organization, type Role, type WeeklyHours } from '../db/schema.ts';
import { HttpError, body, bool, email, int, nullableStr, oneOf, route, str, uuidParam } from '../http.ts';
import { automationsOf, mergeAutomations } from '../automations.ts';
import { logActivity } from '../leads.ts';
import { newPublicKey } from '../orgs.ts';
import { DAY_KEYS, isValidTimeZone } from '../scheduling.ts';
import { publicUser } from './auth.ts';

const ROLES: Role[] = ['OWNER', 'ADMIN', 'STAFF', 'VIEWER'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseHours(v: unknown): WeeklyHours {
  if (!v || typeof v !== 'object') throw new HttpError(400, 'hours must be an object keyed by day.');
  const out = {} as WeeklyHours;
  for (const day of DAY_KEYS) {
    const list = (v as Record<string, unknown>)[day] ?? [];
    if (!Array.isArray(list) || list.length > 3) throw new HttpError(400, `hours.${day} must be a list of up to 3 [open, close] pairs.`);
    out[day as DayKey] = list.map((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2 || !TIME.test(pair[0]) || !TIME.test(pair[1]) || pair[0] >= pair[1]) {
        throw new HttpError(400, `hours.${day} has an invalid time range (use HH:MM, opening before closing).`);
      }
      return [pair[0], pair[1]] as [string, string];
    });
  }
  return out;
}

export function settingsView(org: Organization) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    publicKey: org.publicKey,
    phone: org.phone,
    email: org.email,
    notificationEmail: org.notificationEmail,
    website: org.website,
    address: org.address,
    timezone: org.timezone,
    hours: org.hours,
    slotMinutes: org.slotMinutes,
    minNoticeHours: org.minNoticeHours,
    greeting: org.greeting,
    emergencyInstructions: org.emergencyInstructions,
    followupsEnabled: org.followupsEnabled,
    automations: automationsOf(org),
    plan: org.plan,
    planStatus: org.planStatus,
    isDemo: org.isDemo,
  };
}

export function settingsRoutes(deps: AppDeps): Router {
  const { db } = deps;
  const r = Router();
  r.use(requireAuth(db));

  r.get(
    '/settings',
    route(async (req, res) => {
      res.json({ ...settingsView(req.auth!.org), emailLive: deps.mailer.live, publicUrl: deps.config.publicUrl ?? null });
    })
  );

  r.patch(
    '/settings',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const b = body(req);
      const patch: Partial<Organization> = {};
      const name = str(b, 'name', { max: 120 });
      if (name) patch.name = name;
      for (const key of ['phone', 'website', 'address', 'greeting', 'emergencyInstructions'] as const) {
        const v = nullableStr(b, key, key === 'greeting' || key === 'emergencyInstructions' ? 600 : 200);
        if (v !== undefined) patch[key] = key === 'phone' && v ? v.replace(/[^\d+]/g, '') : v;
      }
      for (const key of ['email', 'notificationEmail'] as const) {
        if (key in b) patch[key] = b[key] ? email(b, key)! : null;
      }
      const timezone = str(b, 'timezone', { max: 64 });
      if (timezone) {
        if (!isValidTimeZone(timezone)) throw new HttpError(400, 'Unknown time zone.');
        patch.timezone = timezone;
      }
      if ('hours' in b) patch.hours = parseHours(b.hours);
      const slotMinutes = int(b, 'slotMinutes', { min: 10, max: 240 });
      if (slotMinutes) patch.slotMinutes = slotMinutes;
      const minNotice = int(b, 'minNoticeHours', { min: 0, max: 168 });
      if (minNotice !== undefined && minNotice !== null) patch.minNoticeHours = minNotice;
      const followups = bool(b, 'followupsEnabled');
      if (followups !== undefined) patch.followupsEnabled = followups;
      if ('automations' in b) patch.automations = mergeAutomations(automationsOf(org), b.automations);
      const [updated] = await db
        .update(organizations)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(organizations.id, org.id))
        .returning();
      await logActivity(db, org.id, 'SETTINGS_UPDATED', 'ORGANIZATION', org.id, { fields: Object.keys(patch) }, req.auth!.user.id);
      res.json(settingsView(updated));
    })
  );

  r.post(
    '/settings/rotate-key',
    requireRole('OWNER'),
    route(async (req, res) => {
      const [updated] = await db
        .update(organizations)
        .set({ publicKey: newPublicKey(), updatedAt: new Date() })
        .where(eq(organizations.id, req.auth!.org.id))
        .returning();
      await logActivity(db, updated.id, 'WIDGET_KEY_ROTATED', 'ORGANIZATION', updated.id, {}, req.auth!.user.id);
      res.json(settingsView(updated));
    })
  );

  // ---------------------------------------------------------------- team
  r.get(
    '/team',
    route(async (req, res) => {
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.orgId, req.auth!.org.id))
        .orderBy(users.createdAt);
      res.json({ items: rows });
    })
  );

  r.post(
    '/team',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const me = req.auth!.user;
      const b = body(req);
      const role = oneOf(b, 'role', ROLES) ?? 'STAFF';
      if (role === 'OWNER' && me.role !== 'OWNER') throw new HttpError(403, 'Only an owner can add another owner.');
      const userEmail = email(b, 'email', true)!;
      const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${userEmail}`).limit(1);
      if (taken) throw new HttpError(409, 'Someone with this email already has an account.');
      const [user] = await db
        .insert(users)
        .values({
          orgId: me.orgId,
          name: str(b, 'name', { required: true, max: 120 })!,
          email: userEmail,
          role,
          passwordHash: await hashPassword(str(b, 'password', { required: true, min: 8, max: 200 })!),
        })
        .returning();
      await logActivity(db, me.orgId, 'TEAM_MEMBER_ADDED', 'USER', user.id, { role }, me.id);
      res.status(201).json(publicUser(user));
    })
  );

  r.patch(
    '/team/:id',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const me = req.auth!.user;
      const id = uuidParam(req);
      const role = oneOf(body(req), 'role', ROLES);
      if (!role) throw new HttpError(400, 'role is required.');
      const [target] = await db.select().from(users).where(and(eq(users.id, id), eq(users.orgId, me.orgId))).limit(1);
      if (!target) throw new HttpError(404, 'Team member not found.');
      if ((target.role === 'OWNER' || role === 'OWNER') && me.role !== 'OWNER') throw new HttpError(403, 'Only an owner can change owner roles.');
      if (target.role === 'OWNER' && role !== 'OWNER') {
        const [{ n }] = await db.select({ n: count() }).from(users).where(and(eq(users.orgId, me.orgId), eq(users.role, 'OWNER')));
        if (n <= 1) throw new HttpError(400, 'The clinic needs at least one owner.');
      }
      const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
      await logActivity(db, me.orgId, 'TEAM_ROLE_CHANGED', 'USER', id, { from: target.role, to: role }, me.id);
      res.json(publicUser(updated));
    })
  );

  r.delete(
    '/team/:id',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const me = req.auth!.user;
      const id = uuidParam(req);
      if (id === me.id) throw new HttpError(400, "You can't remove yourself.");
      const [target] = await db.select().from(users).where(and(eq(users.id, id), eq(users.orgId, me.orgId))).limit(1);
      if (!target) throw new HttpError(404, 'Team member not found.');
      if (target.role === 'OWNER' && !roleAtLeast(me.role, 'OWNER')) throw new HttpError(403, 'Only an owner can remove an owner.');
      await db.delete(users).where(and(eq(users.id, id), ne(users.id, me.id)));
      await logActivity(db, me.orgId, 'TEAM_MEMBER_REMOVED', 'USER', id, { email: target.email }, me.id);
      res.json({ ok: true });
    })
  );

  // ---------------------------------------------------------------- my profile
  r.patch(
    '/me',
    route(async (req, res) => {
      const me = req.auth!.user;
      const b = body(req);
      const patch: { name?: string; passwordHash?: string } = {};
      const name = str(b, 'name', { max: 120 });
      if (name) patch.name = name;
      const next = str(b, 'newPassword', { min: 8, max: 200 });
      if (next) {
        const current = str(b, 'currentPassword', { required: true, max: 200 })!;
        const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
        if (!(await verifyPassword(current, row.hash))) throw new HttpError(400, 'Your current password is incorrect.');
        patch.passwordHash = await hashPassword(next);
      }
      const [updated] = await db.update(users).set(patch).where(eq(users.id, me.id)).returning();
      res.json(publicUser(updated));
    })
  );

  return r;
}
