/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appStore } from '../store/app-store.ts';
import { Lead, Appointment } from '../types/index.ts';

export interface PrivacyPolicySettings {
  organizationId: string;
  dataRetentionDays: number; // e.g. 90, 180, 365, or 0 (forever)
  requireConsentCheckbox: boolean;
  maskPhoneNumbersInExports: boolean;
  autoPurgeOptedOutLeads: boolean;
  customPrivacyNoticeUrl?: string;
  hipaaDisclaimerEnabled: boolean;
}

export const defaultPrivacySettings: PrivacyPolicySettings = {
  organizationId: 'org-apex-smile',
  dataRetentionDays: 180,
  requireConsentCheckbox: true,
  maskPhoneNumbersInExports: false,
  autoPurgeOptedOutLeads: false,
  hipaaDisclaimerEnabled: true,
};

export const privacyService = {
  // Export all tenant data to structured JSON
  exportTenantDataJSON(organizationId: string) {
    const state = appStore.getState();
    const org = state.organizations.find((o) => o.id === organizationId);
    const leads = state.leads.filter((l) => l.organizationId === organizationId);
    const appointments = state.appointments.filter((a) => a.organizationId === organizationId);
    const knowledge = state.knowledge.filter((k) => k.organizationId === organizationId);
    const automations = state.automations.filter((a) => a.organizationId === organizationId);
    const auditLogs = state.auditLogs.filter((al) => al.organizationId === organizationId);

    const exportPackage = {
      exportMetadata: {
        organizationId,
        organizationName: org?.name || 'Practice Workspace',
        exportedAt: new Date().toISOString(),
        formatVersion: '1.0.0-HIPAA-GDPR',
        complianceType: 'Subject Access Request / Tenant Data Portability',
      },
      organization: org,
      patientLeads: leads,
      consultationAppointments: appointments,
      knowledgeDocuments: knowledge,
      automationRules: automations,
      securityAuditTrail: auditLogs,
    };

    const blob = new Blob([JSON.stringify(exportPackage, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadflow_privacy_export_${organizationId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    appStore.recordAuditLog({
      organizationId,
      action: 'DATA_EXPORT_JSON',
      entityType: 'PRIVACY_COMPLIANCE',
      details: { leadCount: leads.length, appointmentCount: appointments.length },
    });
  },

  // Export patient inquiries to CSV
  exportLeadsCSV(organizationId: string) {
    const state = appStore.getState();
    const leads = state.leads.filter((l) => l.organizationId === organizationId);

    const headers = [
      'Lead ID',
      'Patient Name',
      'Email',
      'Phone',
      'Service Requested',
      'Status',
      'Score Tier',
      'Score Value',
      'Urgency',
      'Estimated Value',
      'Created Date',
    ];

    const rows = leads.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.email}"`,
      `"${l.phone || ''}"`,
      `"${l.serviceRequested.replace(/"/g, '""')}"`,
      l.status,
      l.score.tier,
      l.score.score,
      l.urgency,
      `$${l.estimatedValue}`,
      new Date(l.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient_leads_${organizationId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    appStore.recordAuditLog({
      organizationId,
      action: 'DATA_EXPORT_CSV',
      entityType: 'PRIVACY_COMPLIANCE',
      details: { leadCount: leads.length },
    });
  },

  // Right-to-be-forgotten / Data Purge
  purgePatientData(organizationId: string, leadId: string) {
    appStore.deleteLead(leadId);
    appStore.recordAuditLog({
      organizationId,
      action: 'PATIENT_DATA_PURGED',
      entityType: 'PRIVACY_RIGHT_TO_ERASURE',
      entityId: leadId,
      details: { reason: 'Verified patient erasure request / GDPR Article 17' },
    });
  },

  // Purge all opted-out leads
  purgeAllOptedOutLeads(organizationId: string) {
    const state = appStore.getState();
    const optedOut = state.leads.filter(
      (l) => l.organizationId === organizationId && (l.optedOut || l.status === 'DO_NOT_CONTACT')
    );

    optedOut.forEach((l) => {
      appStore.deleteLead(l.id);
    });

    appStore.recordAuditLog({
      organizationId,
      action: 'BULK_PURGE_OPTED_OUT',
      entityType: 'PRIVACY_COMPLIANCE',
      details: { purgedCount: optedOut.length },
    });

    return optedOut.length;
  },
};
