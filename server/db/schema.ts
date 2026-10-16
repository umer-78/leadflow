/**
 * Database schema (PostgreSQL, via Drizzle). Every tenant-owned row carries
 * org_id, and every query in the API filters by the caller's org.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export type Role = 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER';
export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
/** Opening intervals per weekday in clinic-local time, e.g. { mon: [["09:00","17:00"]] }. */
export type WeeklyHours = Record<DayKey, [string, string][]>;
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'BOOKED' | 'WON' | 'LOST' | 'DO_NOT_CONTACT';
export type LeadTier = 'HIGH' | 'MEDIUM' | 'LOW';
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type ConversationStatus = 'OPEN' | 'ESCALATED' | 'CLOSED';
export type OutboundStatus = 'PENDING' | 'SENDING' | 'SENT' | 'LOGGED' | 'SKIPPED' | 'FAILED';
export type OutboundKind = 'FOLLOWUP' | 'STAFF_ALERT' | 'CONFIRMATION';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  /** Public identifier used by the website widget. */
  publicKey: text('public_key').notNull().unique(),
  phone: text('phone'),
  email: text('email'),
  /** Where new-lead and escalation alerts are sent. */
  notificationEmail: text('notification_email'),
  website: text('website'),
  address: text('address'),
  timezone: text('timezone').notNull().default('America/New_York'),
  hours: jsonb('hours').$type<WeeklyHours>().notNull(),
  slotMinutes: integer('slot_minutes').notNull().default(30),
  minNoticeHours: integer('min_notice_hours').notNull().default(2),
  greeting: text('greeting'),
  /** Extra instructions shown for urgent problems, e.g. an after-hours number. */
  emergencyInstructions: text('emergency_instructions'),
  followupsEnabled: boolean('followups_enabled').notNull().default(true),
  plan: text('plan').notNull().default('trial'),
  planStatus: text('plan_status').notNull().default('trial'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').$type<Role>().notNull().default('STAFF'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('users_org_idx').on(t.orgId)]
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the session token; the token itself only lives in the cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)]
);

export const knowledgeArticles = pgTable(
  'knowledge_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull().default(''),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    service: text('service'),
    /** Clinic-set price range in whole dollars. The assistant only quotes prices set here. */
    priceMin: integer('price_min'),
    priceMax: integer('price_max'),
    priceUnit: text('price_unit'),
    caseValue: integer('case_value'),
    published: boolean('published').notNull().default(true),
    source: text('source').notNull().default('library'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('kb_org_slug_idx').on(t.orgId, t.slug)]
);

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    serviceInterest: text('service_interest'),
    status: text('status').$type<LeadStatus>().notNull().default('NEW'),
    score: integer('score').notNull().default(0),
    tier: text('tier').$type<LeadTier>().notNull().default('LOW'),
    scoreReasons: jsonb('score_reasons').$type<string[]>().notNull().default([]),
    estimatedValue: integer('estimated_value').notNull().default(0),
    urgent: boolean('urgent').notNull().default(false),
    source: text('source').notNull().default('WEB_CHAT'),
    notes: text('notes'),
    optedOut: boolean('opted_out').notNull().default(false),
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('leads_org_created_idx').on(t.orgId, t.createdAt)]
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    visitorId: text('visitor_id').notNull(),
    channel: text('channel').notNull().default('WEB'),
    status: text('status').$type<ConversationStatus>().notNull().default('OPEN'),
    /** Assistant dialogue state (what it is waiting for, collected details...). */
    state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
    messageCount: integer('message_count').notNull().default(0),
    needsAttention: boolean('needs_attention').notNull().default(false),
    attentionReason: text('attention_reason'),
    /** Staff alerts already sent for this conversation (dedupe keys). */
    alertsSent: jsonb('alerts_sent').$type<string[]>().notNull().default([]),
    pageUrl: text('page_url'),
    createdAt: createdAt(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('conversations_org_last_idx').on(t.orgId, t.lastMessageAt), index('conversations_lead_idx').on(t.leadId)]
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull(),
    /** 'visitor' | 'assistant' */
    role: text('role').notNull(),
    body: text('body').notNull(),
    /** Why the assistant said this: intent, confidence, skill, knowledge sources. */
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_idx').on(t.conversationId, t.createdAt), index('messages_org_idx').on(t.orgId, t.createdAt)]
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    service: text('service').notNull(),
    status: text('status').$type<AppointmentStatus>().notNull().default('REQUESTED'),
    notes: text('notes'),
    source: text('source').notNull().default('AI_RECEPTIONIST'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('appointments_org_start_idx').on(t.orgId, t.startsAt)]
);

export const outboundMessages = pgTable(
  'outbound_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<OutboundKind>().notNull(),
    /** Follow-up step in days after the lead was captured (0, 1, 3, 7). */
    step: integer('step'),
    channel: text('channel').notNull().default('EMAIL'),
    toAddress: text('to_address').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').$type<OutboundStatus>().notNull().default('PENDING'),
    statusReason: text('status_reason'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    providerId: text('provider_id'),
    createdAt: createdAt(),
  },
  (t) => [index('outbound_due_idx').on(t.status, t.scheduledFor), index('outbound_org_idx').on(t.orgId, t.createdAt)]
);

export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('activity_org_idx').on(t.orgId, t.createdAt)]
);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type OutboundMessage = typeof outboundMessages.$inferSelect;
