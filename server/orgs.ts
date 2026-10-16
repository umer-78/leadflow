/**
 * Creating organizations (signup) and the demo clinic.
 */
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashPassword } from './auth.ts';
import type { DB } from './db/client.ts';
import { knowledgeArticles, organizations, users, type Organization, type WeeklyHours } from './db/schema.ts';
import { DEMO_CLINIC, DEMO_OWNER, demoArticles } from './knowledge/demo.ts';
import { LIBRARY, type LibraryArticle } from './knowledge/library.ts';
import type { Queryable } from './leads.ts';
import { DEFAULT_HOURS } from './scheduling.ts';

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'clinic'
  );
}

export const newPublicKey = () => `pk_${crypto.randomBytes(12).toString('base64url')}`;

export async function uniqueSlug(q: Queryable, base: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 5; i++) {
    const [taken] = await q.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (!taken) return slug;
    slug = `${slugify(base)}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return `${slugify(base)}-${crypto.randomBytes(4).toString('hex')}`;
}

type ArticleSeed = LibraryArticle & { priceMin?: number | null; priceMax?: number | null };

export async function insertArticles(q: Queryable, orgId: string, articles: ArticleSeed[]): Promise<void> {
  await q.insert(knowledgeArticles).values(
    articles.map((a) => ({
      orgId,
      slug: a.slug,
      category: a.category,
      title: a.title,
      summary: a.summary,
      body: a.body,
      tags: a.tags,
      service: a.service ?? null,
      caseValue: a.caseValue ?? null,
      priceUnit: a.priceUnit ?? null,
      priceMin: a.priceMin ?? null,
      priceMax: a.priceMax ?? null,
      published: a.published ?? true,
      source: 'library',
    }))
  );
}

export interface NewOrganization {
  name: string;
  timezone?: string;
  phone?: string | null;
  email?: string | null;
  hours?: WeeklyHours;
}

/** Create a clinic with the starter knowledge library. */
export async function createOrganization(q: Queryable, input: NewOrganization, articles: ArticleSeed[] = LIBRARY): Promise<Organization> {
  const [org] = await q
    .insert(organizations)
    .values({
      name: input.name,
      slug: await uniqueSlug(q, input.name),
      publicKey: newPublicKey(),
      timezone: input.timezone ?? 'America/New_York',
      hours: input.hours ?? DEFAULT_HOURS,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notificationEmail: input.email ?? null,
    })
    .returning();
  await insertArticles(q, org.id, articles);
  return org;
}

/** Create the demo clinic and its owner account if they don't exist yet. */
export async function ensureDemo(db: DB): Promise<Organization> {
  const [existing] = await db.select().from(organizations).where(eq(organizations.slug, DEMO_CLINIC.slug)).limit(1);
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ ...DEMO_CLINIC, isDemo: true, plan: 'growth', planStatus: 'demo' })
      .returning();
    await insertArticles(tx, org.id, demoArticles());
    const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.email, DEMO_OWNER.email)).limit(1);
    if (!owner) {
      await tx.insert(users).values({
        orgId: org.id,
        email: DEMO_OWNER.email,
        name: DEMO_OWNER.name,
        role: 'OWNER',
        passwordHash: await hashPassword(DEMO_OWNER.password),
      });
    }
    return org;
  });
}
