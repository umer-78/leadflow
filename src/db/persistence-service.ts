/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eq, desc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  organizations,
  users,
  leads,
  appointments,
  knowledgeDocuments,
  automations,
  prospects,
  proposals,
  agencySettings,
  auditLogs,
} from './schema.ts';

// Robust Two-Layer Error Handling Helper
async function safeQuery<T>(fn: () => Promise<T>, fallbackMessage: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    console.error(`[PostgreSQL Service] ${fallbackMessage}:`, error);
    throw new Error(`${fallbackMessage}. Please verify database connectivity.`, { cause: error });
  }
}

export const persistenceService = {
  // Organizations
  async getOrganizations() {
    return safeQuery(
      async () => db.select().from(organizations),
      'Failed to fetch organizations'
    );
  },

  async getOrganization(id: string) {
    return safeQuery(
      async () => {
        const res = await db.select().from(organizations).where(eq(organizations.id, id));
        return res[0] || null;
      },
      `Failed to fetch organization ${id}`
    );
  },

  async upsertOrganization(data: any) {
    return safeQuery(
      async () => {
        return db
          .insert(organizations)
          .values({
            id: data.id,
            name: data.name,
            slug: data.slug || data.id,
            industry: data.industry || 'Dental / Cosmetic Dentistry',
            website: data.website || null,
            phone: data.phone || null,
            email: data.email || null,
            aiGreeting: data.aiGreeting || null,
            emergencyProtocol: data.emergencyProtocol || null,
            hours: data.hours || null,
            services: data.services || [],
          })
          .onConflictDoUpdate({
            target: organizations.id,
            set: {
              name: data.name,
              industry: data.industry || 'Dental / Cosmetic Dentistry',
              website: data.website || null,
              phone: data.phone || null,
              email: data.email || null,
              aiGreeting: data.aiGreeting || null,
              emergencyProtocol: data.emergencyProtocol || null,
              hours: data.hours || null,
              services: data.services || [],
              updatedAt: new Date(),
            },
          })
          .returning();
      },
      'Failed to upsert organization'
    );
  },

  // Patient Leads
  async getLeads(orgId?: string) {
    return safeQuery(
      async () => {
        if (orgId) {
          return db
            .select()
            .from(leads)
            .where(eq(leads.organizationId, orgId))
            .orderBy(desc(leads.createdAt));
        }
        return db.select().from(leads).orderBy(desc(leads.createdAt));
      },
      'Failed to fetch patient leads'
    );
  },

  async createLead(data: any) {
    return safeQuery(
      async () => {
        const id = data.id || `lead-${Date.now()}`;
        const result = await db
          .insert(leads)
          .values({
            id,
            organizationId: data.organizationId,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            serviceRequested: data.serviceRequested,
            preferredDate: data.preferredDate || null,
            preferredTime: data.preferredTime || null,
            urgency: data.urgency || 'MEDIUM',
            notes: data.notes || null,
            status: data.status || 'NEW',
            scoreTier: data.score?.tier || 'MEDIUM',
            scoreValue: data.score?.score || 50,
            scoreReasons: data.score?.reasons || [],
            source: data.source || 'Website AI Receptionist',
            estimatedValue: data.estimatedValue || 3500,
            followupScheduledAt: data.followupScheduledAt ? new Date(data.followupScheduledAt) : null,
            followupCount: data.followupCount || 0,
            optedOut: data.optedOut || false,
          })
          .returning();
        return result[0];
      },
      'Failed to create patient lead'
    );
  },

  async updateLead(id: string, updates: any) {
    return safeQuery(
      async () => {
        const payload: any = { updatedAt: new Date() };
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.scoreTier !== undefined) payload.scoreTier = updates.scoreTier;
        if (updates.scoreValue !== undefined) payload.scoreValue = updates.scoreValue;
        if (updates.scoreReasons !== undefined) payload.scoreReasons = updates.scoreReasons;
        if (updates.followupScheduledAt !== undefined) {
          payload.followupScheduledAt = updates.followupScheduledAt ? new Date(updates.followupScheduledAt) : null;
        }
        if (updates.followupCount !== undefined) payload.followupCount = updates.followupCount;
        if (updates.lastContactedAt !== undefined) {
          payload.lastContactedAt = updates.lastContactedAt ? new Date(updates.lastContactedAt) : null;
        }
        if (updates.optedOut !== undefined) payload.optedOut = updates.optedOut;
        if (updates.notes !== undefined) payload.notes = updates.notes;

        const result = await db.update(leads).set(payload).where(eq(leads.id, id)).returning();
        return result[0];
      },
      `Failed to update lead ${id}`
    );
  },

  async deleteLead(id: string) {
    return safeQuery(
      async () => {
        return db.delete(leads).where(eq(leads.id, id));
      },
      `Failed to delete lead ${id}`
    );
  },

  // Appointments
  async getAppointments(orgId?: string) {
    return safeQuery(
      async () => {
        if (orgId) {
          return db
            .select()
            .from(appointments)
            .where(eq(appointments.organizationId, orgId))
            .orderBy(desc(appointments.createdAt));
        }
        return db.select().from(appointments).orderBy(desc(appointments.createdAt));
      },
      'Failed to fetch appointments'
    );
  },

  async createAppointment(data: any) {
    return safeQuery(
      async () => {
        const id = data.id || `apt-${Date.now()}`;
        const result = await db
          .insert(appointments)
          .values({
            id,
            organizationId: data.organizationId,
            leadId: data.leadId || null,
            patientName: data.patientName,
            patientPhone: data.patientPhone || null,
            patientEmail: data.patientEmail || null,
            procedure: data.procedure,
            requestedDate: data.requestedDate,
            requestedTime: data.requestedTime,
            status: data.status || 'REQUESTED',
          })
          .returning();
        return result[0];
      },
      'Failed to create appointment'
    );
  },

  // Prospects (Agency CRM)
  async getProspects() {
    return safeQuery(
      async () => db.select().from(prospects).orderBy(desc(prospects.createdAt)),
      'Failed to fetch cold prospects'
    );
  },

  async createProspect(data: any) {
    return safeQuery(
      async () => {
        const id = data.id || `prosp-${Date.now()}`;
        const result = await db
          .insert(prospects)
          .values({
            id,
            businessName: data.businessName,
            website: data.website || null,
            industry: data.industry,
            city: data.city || null,
            state: data.state || null,
            contactName: data.contactName || null,
            contactEmail: data.contactEmail || null,
            contactPhone: data.contactPhone || null,
            stage: data.stage || 'PROSPECT',
            estimatedDealValue: data.estimatedDealValue || 1000,
            lastAuditNotes: data.lastAuditNotes || null,
            personalizedPitch: data.personalizedPitch || null,
          })
          .returning();
        return result[0];
      },
      'Failed to create prospect'
    );
  },

  async updateProspect(id: string, updates: any) {
    return safeQuery(
      async () => {
        const result = await db
          .update(prospects)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(prospects.id, id))
          .returning();
        return result[0];
      },
      `Failed to update prospect ${id}`
    );
  },

  // Proposals
  async getProposals(orgId?: string) {
    return safeQuery(
      async () => {
        if (orgId) {
          return db.select().from(proposals).where(eq(proposals.organizationId, orgId));
        }
        return db.select().from(proposals).orderBy(desc(proposals.createdAt));
      },
      'Failed to fetch proposals'
    );
  },

  async createProposal(data: any) {
    return safeQuery(
      async () => {
        const id = data.id || `prop-${Date.now()}`;
        const result = await db
          .insert(proposals)
          .values({
            id,
            organizationId: data.organizationId || null,
            prospectId: data.prospectId || null,
            clinicName: data.clinicName,
            contactName: data.contactName,
            contactEmail: data.contactEmail,
            packageSelected: data.packageSelected,
            setupFee: data.setupFee,
            monthlyFee: data.monthlyFee,
            scopeSummary: data.scopeSummary || null,
            status: data.status || 'DRAFT',
            validUntil: data.validUntil || null,
          })
          .returning();
        return result[0];
      },
      'Failed to create proposal'
    );
  },

  // Agency Settings
  async getAgencySettings() {
    return safeQuery(
      async () => {
        const res = await db.select().from(agencySettings).limit(1);
        if (res.length > 0) return res[0];
        // Create initial agency record if missing
        const initial = await db
          .insert(agencySettings)
          .values({
            id: 'agency-root',
            agencyName: 'LeadFlow AI Agency',
            ownerName: 'Umer Hashmi',
            ownerEmail: 'umerhashmi987@gmail.com',
            ownerPhone: '+1 (555) 782-9011',
            customDomain: 'leadflow-agency.com',
            defaultMonthlyTarget: 20000,
          })
          .returning();
        return initial[0];
      },
      'Failed to fetch agency settings'
    );
  },

  async updateAgencySettings(updates: any) {
    return safeQuery(
      async () => {
        const current = await this.getAgencySettings();
        const res = await db
          .update(agencySettings)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(agencySettings.id, current.id))
          .returning();
        return res[0];
      },
      'Failed to update agency settings'
    );
  },

  // Audit Logs
  async createAuditLog(log: any) {
    return safeQuery(
      async () => {
        const id = log.id || `audit-${Date.now()}`;
        return db.insert(auditLogs).values({
          id,
          organizationId: log.organizationId || null,
          userId: log.userId || null,
          userEmail: log.userEmail || null,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId || null,
          details: log.details || null,
        });
      },
      'Failed to write audit log'
    );
  },
};
