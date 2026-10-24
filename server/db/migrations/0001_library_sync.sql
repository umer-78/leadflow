ALTER TABLE "knowledge_articles" ADD COLUMN "references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD COLUMN "library_version" text;--> statement-breakpoint
-- Library articles a clinic already rewrote keep their wording; only untouched ones receive library updates.
UPDATE "knowledge_articles" k SET "source" = 'edited'
WHERE k."source" = 'library' AND EXISTS (
  SELECT 1 FROM "activity" a
  WHERE a."entity_id" = k."id"::text AND a."action" = 'KNOWLEDGE_UPDATED'
    AND a."details"->'fields' ?| array['title', 'summary', 'body', 'tags', 'category', 'service']
);
