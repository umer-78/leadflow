/**
 * Keeps every clinic's copy of the built-in library current. Clinics get the
 * library when they sign up; afterwards, corrected and expanded articles
 * replace the copies a clinic hasn't rewritten, and new articles are added
 * unless the clinic deleted that topic. A clinic's prices, publishing choices,
 * rewritten articles and own articles are never touched.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '../db/client.ts';
import { activity, knowledgeArticles, organizations } from '../db/schema.ts';
import type { Queryable } from '../leads.ts';
import { insertArticles, libraryVersion, type ArticleSeed } from '../orgs.ts';
import { demoArticles } from './demo.ts';
import { LIBRARY } from './library.ts';

export interface SyncResult {
  clinics: number;
  updated: number;
  added: number;
  retired: number;
}

/** The library as this clinic should have it (the demo clinic's has its prices and policies filled in). */
export function libraryFor(isDemo: boolean): ArticleSeed[] {
  return isDemo ? demoArticles() : LIBRARY;
}

/** The library-owned fields of an article (what a sync or a restore writes). */
export function libraryContent(a: ArticleSeed, isDemo: boolean) {
  return {
    category: a.category,
    title: a.title,
    summary: a.summary,
    body: a.body,
    tags: a.tags,
    service: a.service ?? null,
    references: a.references ?? [],
    libraryVersion: libraryVersion(a),
    // The demo clinic's prices and policies are ours too.
    ...(isDemo ? { priceMin: a.priceMin ?? null, priceMax: a.priceMax ?? null, priceUnit: a.priceUnit ?? null, published: a.published ?? true } : {}),
  };
}

/** Topics a clinic deleted (by slug, or by title for deletions logged before slugs were). */
export async function removedTopics(q: Queryable, orgId: string): Promise<Set<string>> {
  const rows = await q
    .select({ details: activity.details })
    .from(activity)
    .where(and(eq(activity.orgId, orgId), eq(activity.action, 'KNOWLEDGE_DELETED')));
  const out = new Set<string>();
  for (const { details } of rows) {
    if (typeof details.slug === 'string') out.add(details.slug);
    if (typeof details.title === 'string') out.add(details.title.toLowerCase());
  }
  return out;
}

export async function syncLibrary(db: DB): Promise<SyncResult> {
  const result: SyncResult = { clinics: 0, updated: 0, added: 0, retired: 0 };
  const orgs = await db.select({ id: organizations.id, isDemo: organizations.isDemo }).from(organizations);
  for (const org of orgs) {
    const changed = await syncClinicLibrary(db, org);
    if (!changed.updated && !changed.added && !changed.retired) continue;
    result.clinics++;
    result.updated += changed.updated;
    result.added += changed.added;
    result.retired += changed.retired;
  }
  return result;
}

/** Bring one clinic's copy of the library up to date. */
export async function syncClinicLibrary(db: DB, org: { id: string; isDemo: boolean }): Promise<Omit<SyncResult, 'clinics'>> {
  const library = libraryFor(org.isDemo);
  const slugs = new Set(library.map((a) => a.slug));
  const rows = await db
    .select({
      id: knowledgeArticles.id,
      slug: knowledgeArticles.slug,
      source: knowledgeArticles.source,
      libraryVersion: knowledgeArticles.libraryVersion,
      priced: knowledgeArticles.priceMin,
    })
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.orgId, org.id));
  const have = new Map(rows.map((r) => [r.slug, r]));
  const stale = library.filter((a) => {
    const row = have.get(a.slug);
    return row?.source === 'library' && row.libraryVersion !== libraryVersion(a);
  });
  const missing = library.filter((a) => !have.has(a.slug));
  const removed = missing.length ? await removedTopics(db, org.id) : new Set<string>();
  const add = missing.filter((a) => !removed.has(a.slug) && !removed.has(a.title.toLowerCase()));
  // Articles dropped from the library go too, unless the clinic rewrote them or priced them.
  const retired = rows.filter((r) => r.source === 'library' && !slugs.has(r.slug) && r.priced === null).map((r) => r.id);
  if (!stale.length && !add.length && !retired.length) return { updated: 0, added: 0, retired: 0 };
  await db.transaction(async (tx) => {
    for (const a of stale) {
      await tx
        .update(knowledgeArticles)
        .set({ ...libraryContent(a, org.isDemo), updatedAt: new Date() })
        .where(eq(knowledgeArticles.id, have.get(a.slug)!.id));
    }
    await insertArticles(tx, org.id, add);
    if (retired.length) await tx.delete(knowledgeArticles).where(inArray(knowledgeArticles.id, retired));
  });
  return { updated: stale.length, added: add.length, retired: retired.length };
}
