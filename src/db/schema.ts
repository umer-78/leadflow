/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Organizations / Tenants Table
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  industry: text('industry').notNull().default('Dental / Cosmetic Dentistry'),
  website: text('website'),
  phone: text('phone'),
  email: text('email'),
  aiGreeting: text('ai_greeting'),
  emergencyProtocol: text('emergency_protocol'),
  hours: text('hours'),
  services: jsonb('services'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users Table (Auth UID linked)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('STAFF'), // OWNER, ADMIN, STAFF, VIEWER
  organizationId: text('organization_id').references(() => organizations.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Patient Leads Table
export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organizations.id)
    .notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  serviceRequested: text('service_requested').notNull(),
  preferredDate: text('preferred_date'),
  preferredTime: text('preferred_time'),
  urgency: text('urgency').default('MEDIUM'),
  notes: text('notes'),
  status: text('status').notNull().default('NEW'), // NEW, QUALIFIED, CONTACTED, APPOINTMENT_REQUESTED, APPOINTMENT_BOOKED, WON, LOST, DO_NOT_CONTACT
  scoreTier: text('score_tier').default('MEDIUM'),
  scoreValue: integer('score_value').default(50),
  scoreReasons: jsonb('score_reasons'),
  source: text('source').default('Website AI Receptionist'),
  estimatedValue: integer('estimated_value').default(3500),
  lastContactedAt: timestamp('last_contacted_at'),
  followupScheduledAt: timestamp('followup_scheduled_at'),
  followupCount: integer('followup_count').default(0),
  optedOut: boolean('opted_out').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Appointments Table
export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organizations.id)
    .notNull(),
  leadId: text('lead_id').references(() => leads.id),
  patientName: text('patient_name').notNull(),
  patientPhone: text('patient_phone'),
  patientEmail: text('patient_email'),
  procedure: text('procedure').notNull(),
  requestedDate: text('requested_date').notNull(),
  requestedTime: text('requested_time').notNull(),
  status: text('status').notNull().default('REQUESTED'), // REQUESTED, CONFIRMED, RESCHEDULED, COMPLETED, CANCELLED
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Knowledge Base Documents
export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organizations.id)
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  content: text('content').notNull(),
  chunks: jsonb('chunks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Automation Rules Table
export const automations = pgTable('automations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organizations.id)
    .notNull(),
  name: text('name').notNull(),
  trigger: text('trigger').notNull(),
  condition: text('condition').notNull(),
  actionType: text('action_type').notNull(),
  actionPayload: jsonb('action_payload'),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Cold Prospects Table (Agency CRM)
export const prospects = pgTable('prospects', {
  id: text('id').primaryKey(),
  businessName: text('business_name').notNull(),
  website: text('website'),
  industry: text('industry').notNull(),
  city: text('city'),
  state: text('state'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  stage: text('stage').notNull().default('PROSPECT'), // PROSPECT, RESEARCHED, CONTACTED, REPLIED, DEMO, PROPOSAL, WON, LOST
  estimatedDealValue: integer('estimated_deal_value').default(1000),
  lastAuditNotes: text('last_audit_notes'),
  personalizedPitch: text('personalized_pitch'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Proposals Table
export const proposals = pgTable('proposals', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id),
  prospectId: text('prospect_id').references(() => prospects.id),
  clinicName: text('clinic_name').notNull(),
  contactName: text('contact_name').notNull(),
  contactEmail: text('contact_email').notNull(),
  packageSelected: text('package_selected').notNull(),
  setupFee: integer('setup_fee').notNull(),
  monthlyFee: integer('monthly_fee').notNull(),
  scopeSummary: text('scope_summary'),
  status: text('status').notNull().default('DRAFT'), // DRAFT, SENT, ACCEPTED, PAID, EXPIRED
  validUntil: text('valid_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Agency Settings
export const agencySettings = pgTable('agency_settings', {
  id: text('id').primaryKey(),
  agencyName: text('agency_name').notNull().default('LeadFlow AI Agency'),
  ownerName: text('owner_name').notNull().default('Umer Hashmi'),
  ownerEmail: text('owner_email').notNull().default('umerhashmi987@gmail.com'),
  ownerPhone: text('owner_phone'),
  customDomain: text('custom_domain'),
  stripeStarterLink: text('stripe_starter_link'),
  stripeGrowthLink: text('stripe_growth_link'),
  stripeProLink: text('stripe_pro_link'),
  defaultMonthlyTarget: integer('default_monthly_target').default(20000),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id'),
  userId: text('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Relations
export const orgsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  leads: many(leads),
  appointments: many(appointments),
  knowledgeDocuments: many(knowledgeDocuments),
  automations: many(automations),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [leads.organizationId],
    references: [organizations.id],
  }),
  appointments: many(appointments),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));
