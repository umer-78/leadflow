/**
 * Knowledge base management, plus a sandbox to test the assistant.
 */
import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { receptionistFor, slotFinder } from '../chat.ts';
import { knowledgeArticles } from '../db/schema.ts';
import { HttpError, body, bool, int, nullableStr, oneOf, route, str, uuidParam } from '../http.ts';
import type { ArticleCategory } from '../knowledge/library.ts';
import { logActivity } from '../leads.ts';
import { slugify } from '../orgs.ts';
import { newChatState, type ChatState } from '../receptionist/engine.ts';

const CATEGORIES: ArticleCategory[] = ['PROCEDURE', 'CONDITION', 'EMERGENCY', 'AFTERCARE', 'FAQ', 'POLICY'];

function tagsOf(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : null;
  if (!list) throw new HttpError(400, 'tags must be a list.');
  return [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 40);
}

export function knowledgeRoutes(deps: AppDeps): Router {
  const { db } = deps;
  const r = Router();
  r.use(requireAuth(db));

  r.get(
    '/',
    route(async (req, res) => {
      const rows = await db
        .select()
        .from(knowledgeArticles)
        .where(eq(knowledgeArticles.orgId, req.auth!.org.id))
        .orderBy(asc(knowledgeArticles.category), asc(knowledgeArticles.title));
      res.json({ items: rows });
    })
  );

  r.post(
    '/',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const b = body(req);
      const title = str(b, 'title', { required: true, max: 160 })!;
      let slug = slugify(title);
      const [clash] = await db
        .select({ id: knowledgeArticles.id })
        .from(knowledgeArticles)
        .where(and(eq(knowledgeArticles.orgId, org.id), eq(knowledgeArticles.slug, slug)))
        .limit(1);
      if (clash) slug = `${slug}-${Date.now().toString(36)}`;
      const priceMin = int(b, 'priceMin', { min: 0, max: 1_000_000 }) ?? null;
      const priceMax = int(b, 'priceMax', { min: 0, max: 1_000_000 }) ?? null;
      if (priceMin !== null && priceMax !== null && priceMin > priceMax) throw new HttpError(400, 'The minimum price is higher than the maximum.');
      const [article] = await db
        .insert(knowledgeArticles)
        .values({
          orgId: org.id,
          slug,
          title,
          category: oneOf(b, 'category', CATEGORIES) ?? 'FAQ',
          summary: str(b, 'summary', { required: true, max: 1000 })!,
          body: str(b, 'body', { max: 20_000 }) ?? '',
          tags: tagsOf(b.tags) ?? [],
          service: str(b, 'service', { max: 120 }) ?? null,
          priceMin,
          priceMax,
          priceUnit: str(b, 'priceUnit', { max: 80 }) ?? null,
          caseValue: int(b, 'caseValue', { min: 0, max: 1_000_000 }) ?? null,
          published: bool(b, 'published') ?? true,
          source: 'custom',
        })
        .returning();
      await logActivity(db, org.id, 'KNOWLEDGE_CREATED', 'KNOWLEDGE', article.id, { title }, req.auth!.user.id);
      res.status(201).json(article);
    })
  );

  r.patch(
    '/:id',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const b = body(req);
      const [current] = await db
        .select()
        .from(knowledgeArticles)
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.orgId, org.id)))
        .limit(1);
      if (!current) throw new HttpError(404, 'Article not found.');
      const patch: Partial<typeof current> = {};
      const title = str(b, 'title', { max: 160 });
      if (title) patch.title = title;
      const summary = str(b, 'summary', { max: 1000 });
      if (summary) patch.summary = summary;
      if ('body' in b) patch.body = str(b, 'body', { max: 20_000 }) ?? '';
      const category = oneOf(b, 'category', CATEGORIES);
      if (category) patch.category = category;
      const tags = tagsOf(b.tags);
      if (tags) patch.tags = tags;
      for (const key of ['service', 'priceUnit'] as const) {
        const v = nullableStr(b, key, 120);
        if (v !== undefined) patch[key] = v;
      }
      for (const key of ['priceMin', 'priceMax', 'caseValue'] as const) {
        const v = int(b, key, { min: 0, max: 1_000_000 });
        if (v !== undefined) patch[key] = v;
      }
      const min = patch.priceMin !== undefined ? patch.priceMin : current.priceMin;
      const max = patch.priceMax !== undefined ? patch.priceMax : current.priceMax;
      if (min !== null && max !== null && min > max) throw new HttpError(400, 'The minimum price is higher than the maximum.');
      const published = bool(b, 'published');
      if (published !== undefined) patch.published = published;
      const [updated] = await db
        .update(knowledgeArticles)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(knowledgeArticles.id, id))
        .returning();
      await logActivity(db, org.id, 'KNOWLEDGE_UPDATED', 'KNOWLEDGE', id, { fields: Object.keys(patch) }, req.auth!.user.id);
      res.json(updated);
    })
  );

  r.delete(
    '/:id',
    requireRole('ADMIN'),
    route(async (req, res) => {
      const org = req.auth!.org;
      const id = uuidParam(req);
      const deleted = await db
        .delete(knowledgeArticles)
        .where(and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.orgId, org.id)))
        .returning({ id: knowledgeArticles.id, title: knowledgeArticles.title });
      if (!deleted.length) throw new HttpError(404, 'Article not found.');
      await logActivity(db, org.id, 'KNOWLEDGE_DELETED', 'KNOWLEDGE', id, { title: deleted[0].title }, req.auth!.user.id);
      res.json({ ok: true });
    })
  );

  /** Ask the assistant something without creating conversations, leads or bookings. */
  r.post(
    '/test',
    route(async (req, res) => {
      const org = req.auth!.org;
      const b = body(req);
      const message = str(b, 'message', { required: true, max: 1000 })!;
      const state: ChatState = b.state && typeof b.state === 'object' ? { ...newChatState(), ...(b.state as Partial<ChatState>) } : newChatState();
      const receptionist = await receptionistFor(db, org);
      const now = new Date();
      const result = await receptionist.respond(message, state, {
        findSlots: slotFinder(db, org, now),
        reserve: async () => ({ ok: true, appointmentId: 'preview' }),
      }, now);
      res.json({ reply: result.reply, meta: result.meta, state: result.state, events: result.events });
    })
  );

  return r;
}
