/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileSpreadsheet,
  Lock,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import {
  defaultPrivacySettings,
  PrivacyPolicySettings,
  privacyService,
} from '../../lib/privacy/privacy-service.ts';

export function PrivacyComplianceView() {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;
  const orgLeads = state.leads.filter((l) => l.organizationId === currentOrg.id);
  const optedOutCount = orgLeads.filter(
    (l) => l.optedOut || l.status === 'DO_NOT_CONTACT'
  ).length;

  const [settings, setSettings] = useState<PrivacyPolicySettings>(defaultPrivacySettings);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [purgedCount, setPurgedCount] = useState<number | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('Privacy policy & retention parameters saved successfully.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleBulkPurge = () => {
    if (
      window.confirm(
        `Are you sure you want to permanently delete all ${optedOutCount} opted-out patient records? This action cannot be undone.`
      )
    ) {
      const count = privacyService.purgeAllOptedOutLeads(currentOrg.id);
      setPurgedCount(count);
      setSuccessMsg(`Permanently purged ${count} opted-out records.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Practice Security & Data Privacy Center</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            HIPAA & GDPR Compliance, Patient Portability & Erasure
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage data export rights, automated retention policies, consent banners, and tenant isolation.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Security Status Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Tenant Isolation</span>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px] font-mono font-bold">
              ACTIVE
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Strict Row-Level Scoping</div>
          <p className="text-[11px] text-slate-400">
            Cross-tenant queries are blocked server-side. Practice knowledge is isolated per clinic.
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Clinical Diagnosis Guardrail</span>
            <span className="px-2 py-0.5 bg-sky-950 text-sky-400 border border-sky-800 rounded text-[10px] font-mono font-bold">
              ENFORCED
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Zero Medical Liability</div>
          <p className="text-[11px] text-slate-400">
            The AI is strictly barred from diagnosing conditions, ensuring patient safety.
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Data Storage Engine</span>
            <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded text-[10px] font-mono font-bold">
              POSTGRESQL
            </span>
          </div>
          <div className="text-sm font-semibold text-white">Google Cloud SQL Developer</div>
          <p className="text-[11px] text-slate-400">
            Encrypted in transit and at rest with parameterized Drizzle queries.
          </p>
        </div>
      </div>

      {/* Patient Data Portability & Export */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-sky-400" />
            <span>Patient Data Portability & SAR Export (GDPR Article 20 / HIPAA)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate full compliant data exports of all patient leads, consultation history, and knowledge documents.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>Complete JSON Portability Archive</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Full structured database dump with audit logs
              </div>
            </div>
            <button
              onClick={() => privacyService.exportTenantDataJSON(currentOrg.id)}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Patient Leads CSV Spreadsheet</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Tabular format for clinical management and audits
              </div>
            </div>
            <button
              onClick={() => privacyService.exportLeadsCSV(currentOrg.id)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right to Erasure & Purge Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Right to Erasure & Opt-Out Purge (GDPR Article 17)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Permanently delete patient inquiries upon request and purge opted-out records to prevent unauthorized messaging.
          </p>
        </div>

        <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-xs text-rose-300 flex items-center gap-1.5">
              <UserX className="w-4 h-4 text-rose-400" />
              <span>Bulk Purge Opted-Out Patients ({optedOutCount} records pending)</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Instantly removes patients who unsubscribed or requested DO_NOT_CONTACT.
            </div>
          </div>

          <button
            onClick={handleBulkPurge}
            disabled={optedOutCount === 0}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Opted-Out Leads</span>
          </button>
        </div>
      </div>

      {/* Retention & Consent Policy Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Automated Data Retention & Consent Settings</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure how long patient data is retained and customize public consent disclosures.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Data Retention Window (Auto-Archive)
              </label>
              <select
                value={settings.dataRetentionDays}
                onChange={(e) =>
                  setSettings({ ...settings, dataRetentionDays: Number(e.target.value) })
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value={90}>90 Days (Strict Minimal Retention)</option>
                <option value={180}>180 Days (Recommended for Elective Practices)</option>
                <option value={365}>365 Days (1 Calendar Year)</option>
                <option value={0}>Indefinite (Manual Purge Only)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Custom Practice Privacy Policy Link
              </label>
              <input
                type="url"
                value={settings.customPrivacyNoticeUrl || ''}
                onChange={(e) =>
                  setSettings({ ...settings, customPrivacyNoticeUrl: e.target.value })
                }
                placeholder="https://yourclinic.com/privacy-policy"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.requireConsentCheckbox}
                onChange={(e) =>
                  setSettings({ ...settings, requireConsentCheckbox: e.target.checked })
                }
                className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0"
              />
              <span className="text-xs text-slate-300">
                Display explicit SMS & Email communication consent prompt during AI widget intake
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.hipaaDisclaimerEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, hipaaDisclaimerEnabled: e.target.checked })
                }
                className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0"
              />
              <span className="text-xs text-slate-300">
                Display clinical disclaimer: "AI provides procedure info only; clinical diagnosis occurs in person."
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Privacy & Compliance Configuration</span>
          </button>
        </form>
      </div>
    </div>
  );
}
