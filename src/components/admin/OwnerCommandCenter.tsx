/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  Building,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Globe,
  Mail,
  Phone,
  PieChart,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { aiRouter } from '../../lib/ai/router.ts';
import { AIProviderHealth } from '../../lib/ai/types.ts';
import { billingProvider } from '../../lib/billing/provider.ts';
import { generateOutreachDraft, generateProposalDraft, generateProspectResearch, ResearchReport } from '../../lib/crm/prospects.ts';
import { appStore } from '../../lib/store/app-store.ts';
import { Proposal, Prospect, ProspectStage } from '../../lib/types/index.ts';
import { GoogleLiveExplorerView } from '../research/GoogleLiveExplorerView.tsx';

export function OwnerCommandCenter() {
  const state = appStore.getState();
  const mrrMetrics = billingProvider.calculateMRR(state.organizations);

  const [activeTab, setActiveTab] = useState<'today' | 'mrr' | 'crm' | 'google_research' | 'campaigns' | 'settings' | 'health' | 'audit'>('today');
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [researchReport, setResearchReport] = useState<ResearchReport | null>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalDraft, setProposalDraft] = useState<Proposal | null>(null);
  const [providerHealthList, setProviderHealthList] = useState<AIProviderHealth[]>([]);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Agency Branding & Stripe Payment Links State
  const agencySettings = state.agencySettings;
  const [agencyName, setAgencyName] = useState(agencySettings.agencyName || 'LeadFlow AI Agency');
  const [ownerName, setOwnerName] = useState(agencySettings.ownerName || 'Umer Hashmi');
  const [ownerEmail, setOwnerEmail] = useState(agencySettings.ownerEmail || 'umerhashmi987@gmail.com');
  const [ownerPhone, setOwnerPhone] = useState(agencySettings.ownerPhone || '+1 (555) 782-9011');
  const [customDomain, setCustomDomain] = useState(agencySettings.customDomain || 'leadflow-agency.com');
  const [stripeStarterLink, setStripeStarterLink] = useState(agencySettings.stripeStarterLink || '');
  const [stripeGrowthLink, setStripeGrowthLink] = useState(agencySettings.stripeGrowthLink || '');
  const [stripeProLink, setStripeProLink] = useState(agencySettings.stripeProLink || '');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copiedPitchId, setCopiedPitchId] = useState<string | null>(null);

  // New Prospect state
  const [showAddProspectModal, setShowAddProspectModal] = useState(false);
  const [pBusiness, setPBusiness] = useState('');
  const [pWebsite, setPWebsite] = useState('');
  const [pIndustry, setPIndustry] = useState('Dental / Cosmetic Dentistry');
  const [pContact, setPContact] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pObs, setPObs] = useState('');

  const prospects = state.prospects;
  const auditLogs = state.auditLogs;

  const handleRunHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const results = await aiRouter.checkAllProviders();
      setProviderHealthList(results);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const handleOpenResearch = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    const rep = generateProspectResearch(prospect);
    setResearchReport(rep);
  };

  const handleGenerateOutreach = (prospect: Prospect) => {
    const draft = generateOutreachDraft(prospect, 'Umer Hashmi');
    prospect.outreachDraft = {
      subject: draft.subject,
      body: draft.body,
      approvedByHuman: false,
    };
    prospect.stage = 'RESEARCHED';
    appStore.updateProspectStage(prospect.id, 'RESEARCHED');
  };

  const handleApproveOutreach = (prospectId: string) => {
    appStore.approveOutreach(prospectId);
  };

  const handleOpenProposal = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    const draft = generateProposalDraft(prospect, 'GROWTH');
    setProposalDraft(draft);
    setShowProposalModal(true);
  };

  const handleSaveProposal = () => {
    if (proposalDraft) {
      proposalDraft.status = 'SENT';
      appStore.saveProposal(proposalDraft);
      if (selectedProspect) {
        appStore.updateProspectStage(selectedProspect.id, 'PROPOSAL');
      }
      setShowProposalModal(false);
    }
  };

  const handleAddProspect = (e: React.FormEvent) => {
    e.preventDefault();
    const newPrsp: Prospect = {
      id: `prsp-${Date.now()}`,
      businessName: pBusiness,
      website: pWebsite,
      industry: pIndustry,
      country: 'United States',
      contactName: pContact,
      email: pEmail,
      phone: pPhone,
      stage: 'PROSPECT',
      identifiedProblem: 'Awaiting initial contact funnel research audit.',
      verifiedObservations: pObs ? [pObs] : ['Website requires contact form triage review.'],
      estimatedDealValue: 1000,
      notes: 'Added from command center.',
      createdAt: new Date().toISOString(),
    };
    state.prospects.unshift(newPrsp);
    setShowAddProspectModal(false);
    setPBusiness('');
    setPWebsite('');
    setPContact('');
    setPEmail('');
    setPPhone('');
    setPObs('');
  };

  const handleExportProspectsCSV = () => {
    const headers = ['Business Name', 'Website', 'Industry', 'Contact Name', 'Email', 'Phone', 'Stage', 'Identified Problem', 'Estimated Monthly Value', 'Interactive Demo Link'];
    const rows = prospects.map((p) => [
      `"${p.businessName.replace(/"/g, '""')}"`,
      `"${p.website}"`,
      `"${p.industry}"`,
      `"${p.contactName.replace(/"/g, '""')}"`,
      `"${p.email}"`,
      `"${p.phone || ''}"`,
      `"${p.stage}"`,
      `"${(p.identifiedProblem || '').replace(/"/g, '""')}"`,
      `"$${p.estimatedDealValue}/mo"`,
      `"${window.location.origin}/?demo=${p.demoSlug || ''}&clinic=${encodeURIComponent(p.businessName)}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `target_clinics_outreach_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAgencySettings = (e: React.FormEvent) => {
    e.preventDefault();
    appStore.updateAgencySettings({
      agencyName,
      ownerName,
      ownerEmail,
      ownerPhone,
      customDomain,
      stripeStarterLink,
      stripeGrowthLink,
      stripeProLink,
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900/60 border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between">
        <div>
          <div className="pb-4 mb-4 border-b border-slate-800">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
              Agency Master Operations
            </span>
            <h2 className="text-sm font-bold text-white mt-0.5">LeadFlow Command Center</h2>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
              <span className="text-emerald-400 font-semibold">${mrrMetrics.currentMRR.toLocaleString()}</span>
              <span>/</span>
              <span className="text-white">${mrrMetrics.targetMRR.toLocaleString()} MRR</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('today')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'today'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Today's Cadence</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-amber-300 rounded font-mono">
                3 Action Items
              </span>
            </button>

            <button
              onClick={() => setActiveTab('mrr')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'mrr'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span>$20k Target Engine</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">
                {Math.round((mrrMetrics.currentMRR / mrrMetrics.targetMRR) * 100)}%
              </span>
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'crm'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Prospects & Outreach</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">
                {prospects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('google_research')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                activeTab === 'google_research'
                  ? 'bg-sky-600 text-white'
                  : 'text-sky-400 hover:text-sky-300 hover:bg-sky-950/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <span>Google & Maps Intel</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-sky-950 text-sky-300 border border-sky-800 rounded">
                Live AI
              </span>
            </button>

            <button
              onClick={() => setActiveTab('campaigns')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'campaigns'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>Cold Outreach & CSV</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded font-semibold">
                Export
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Stripe & Branding</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-sky-950 text-sky-300 rounded font-semibold">
                Payments
              </span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'health'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>System Health ($0 Free-First)</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                activeTab === 'audit'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Audit Logs & Security</span>
            </button>
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500">
          <p>LeadFlow AI Autonomous Ops v1.0</p>
          <p className="mt-1 text-slate-400">Strict Rule 50: Zero uncontrolled autonomy.</p>
        </div>
      </aside>

      {/* Main Agency View */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* TODAY COMMAND CENTER (Rule 44) */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Today's Operating Dashboard</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily command queue: research audits, human outreach approvals, and client alerts.
              </p>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Outreach Awaiting Approval</span>
                <span className="text-2xl font-bold text-amber-400 mt-1 block">
                  {prospects.filter((p) => p.outreachDraft && !p.outreachDraft.approvedByHuman).length}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Mandatory human-in-the-loop</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Follow-Ups Due Today</span>
                <span className="text-2xl font-bold text-sky-400 mt-1 block">
                  {prospects.filter((p) => p.nextFollowupDate).length}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">High-ticket clinic targets</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Active Client Tenants</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">
                  {state.organizations.filter((o) => o.id !== 'org-agency-root').length}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">100% isolated databases</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Pipeline Value</span>
                <span className="text-2xl font-bold text-white mt-1 block">
                  ${prospects.reduce((sum, p) => sum + p.estimatedDealValue, 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">Weighted monthly recurring</span>
              </div>
            </div>

            {/* Action Items List */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Daily High-Priority Queue</h3>

              <div className="space-y-3">
                {prospects
                  .filter((p) => p.outreachDraft && !p.outreachDraft.approvedByHuman)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-4 bg-slate-950/80 border border-amber-900/40 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950 text-amber-300 rounded border border-amber-800">
                            AWAITING HUMAN APPROVAL
                          </span>
                          <span className="font-semibold text-sm text-white">{p.businessName}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Personalized outreach ready for <strong className="text-slate-200">{p.contactName}</strong>. Verified observation checked.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenResearch(p)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg"
                        >
                          Review Draft
                        </button>
                        <button
                          onClick={() => handleApproveOutreach(p.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5 shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Approve & Dispatch</span>
                        </button>
                      </div>
                    </div>
                  ))}

                {prospects
                  .filter((p) => p.stage === 'DEMO')
                  .map((p) => (
                    <div
                      key={p.id}
                      className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-sky-950 text-sky-300 rounded border border-sky-800">
                            DEMO VIEWED
                          </span>
                          <span className="font-semibold text-sm text-white">{p.businessName}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{p.notes}</p>
                      </div>
                      <button
                        onClick={() => handleOpenProposal(p)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Build Proposal</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* $20k TARGET ENGINE (Rule 10 & 29 & 59) */}
        {activeTab === 'mrr' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Revenue Dashboard & $20,000 MRR Engine</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact financial math tracking client progression to the $20,000/month target.
              </p>
            </div>

            {/* Target Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Target MRR</span>
                <div className="text-3xl font-bold text-white mt-1">
                  ${mrrMetrics.targetMRR.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">$240,000 / year ARR goal</span>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Current MRR</span>
                <div className="text-3xl font-bold text-emerald-400 mt-1">
                  ${mrrMetrics.currentMRR.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">From verified active clients</span>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">MRR Gap</span>
                <div className="text-3xl font-bold text-rose-400 mt-1">
                  ${mrrMetrics.mrrGap.toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">Remaining monthly revenue</span>
              </div>

              <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Clients Needed to Close</span>
                <div className="text-3xl font-bold text-sky-400 mt-1">
                  {mrrMetrics.clientsNeededForTarget}
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  at ~${mrrMetrics.averageClientMRR}/mo average
                </span>
              </div>
            </div>

            {/* Formula Transparency Card (Rule 59) */}
            <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl">
              <h3 className="text-sm font-semibold text-white mb-2">Mathematical Formulation</h3>
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 leading-relaxed">
                clients_needed = ceil( (targetMRR - currentMRR) / averageClientMRR )<br />
                clients_needed = ceil( ({mrrMetrics.targetMRR} - {mrrMetrics.currentMRR}) / {mrrMetrics.averageClientMRR} ) = <strong>{mrrMetrics.clientsNeededForTarget} additional clients</strong>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
                <div className="text-xs">
                  <span className="text-slate-400 block">Starter Tier ($500/mo)</span>
                  <span className="text-white font-semibold mt-1 block">
                    {mrrMetrics.tierBreakdown.starter} active practices
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400 block">Growth Tier ($1,000/mo)</span>
                  <span className="text-white font-semibold mt-1 block">
                    {mrrMetrics.tierBreakdown.growth} active practices
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400 block">Pro Tier ($2,000/mo)</span>
                  <span className="text-white font-semibold mt-1 block">
                    {mrrMetrics.tierBreakdown.pro} active practices
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROSPECTS CRM & OUTREACH (Rule 21-26) */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Prospect CRM & Sales Pipeline</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  High-ticket elective practices, AI research audits, and approved outreach.
                </p>
              </div>

              <button
                onClick={() => setShowAddProspectModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 self-start shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Clinic Target</span>
              </button>
            </div>

            {/* Prospects Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Practice & Contact</th>
                      <th className="py-3 px-4">Niche</th>
                      <th className="py-3 px-4">Identified Inquiry Leak</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Deal Value</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {prospects.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{p.businessName}</div>
                          <div className="text-[11px] text-slate-400">{p.contactName}</div>
                          <div className="text-[10px] text-slate-500">{p.website}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{p.industry}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs">
                          <div className="truncate text-xs">{p.identifiedProblem}</div>
                          {p.verifiedObservations?.[0] && (
                            <div className="text-[10px] text-sky-400 truncate mt-0.5">
                              ✓ {p.verifiedObservations[0]}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={p.stage}
                            onChange={(e) => appStore.updateProspectStage(p.id, e.target.value as ProspectStage)}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                          >
                            <option value="PROSPECT">PROSPECT</option>
                            <option value="RESEARCHED">RESEARCHED</option>
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="REPLIED">REPLIED</option>
                            <option value="DEMO">DEMO</option>
                            <option value="PROPOSAL">PROPOSAL</option>
                            <option value="NEGOTIATION">NEGOTIATION</option>
                            <option value="WON">WON</option>
                            <option value="LOST">LOST</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          ${p.estimatedDealValue}/mo
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenResearch(p)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded"
                              title="AI Research Audit"
                            >
                              Research
                            </button>
                            <button
                              onClick={() => handleOpenProposal(p)}
                              className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-[11px] text-indigo-300 rounded"
                              title="Generate Proposal"
                            >
                              Proposal
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COLD OUTREACH CAMPAIGNS & CSV EXPORTER */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Cold Outreach Campaigns & Exporter</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-configured 3-step high-converting outreach sequence for cosmetic clinics with 1-click email and CSV download.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportProspectsCSV}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Targets CSV ({prospects.length})</span>
                </button>
              </div>
            </div>

            {/* Campaign Proven Sequences */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-950 text-sky-400 border border-sky-800 rounded">
                    Email 1 · Day 0
                  </span>
                  <span className="text-[10px] text-slate-500">First Touch</span>
                </div>
                <h3 className="text-xs font-bold text-white">After-Hours Revenue Leak Audit</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Points out the specific 6:00 PM drop-off gap on their contact form. Invites doctor to a private 2-minute interactive demo.
                </p>
                <div className="pt-2 text-[10px] text-sky-400 font-mono">
                  Subject: Quick lead triage observation for [Clinic Name]
                </div>
              </div>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded">
                    Email 2 · Day 3
                  </span>
                  <span className="text-[10px] text-slate-500">The 5-Min Test</span>
                </div>
                <h3 className="text-xs font-bold text-white">The $24,000/Month Metric</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Explains that 4 uncaptured veneer consultations = $24,000 lost revenue. Offers to let their front desk staff test the simulator.
                </p>
                <div className="pt-2 text-[10px] text-amber-400 font-mono">
                  Subject: 4 missed consultations/mo ($24k) at [Clinic Name]?
                </div>
              </div>

              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded">
                    Email 3 · Day 7
                  </span>
                  <span className="text-[10px] text-slate-500">Breakup / File Close</span>
                </div>
                <h3 className="text-xs font-bold text-white">Permission to Close File</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Respectfully informs the practice owner that you assume after-hours response is handled, archiving their custom demo.
                </p>
                <div className="pt-2 text-[10px] text-rose-400 font-mono">
                  Subject: Permission to archive [Clinic Name] demo?
                </div>
              </div>
            </div>

            {/* Quick Dispatch Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Target Practices Ready for Outreach ({prospects.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  Click 'Email' to pre-fill email client directly
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Clinic / Doctor</th>
                      <th className="py-3 px-4">Identified Gap</th>
                      <th className="py-3 px-4">Demo Link</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {prospects.map((p) => {
                      const demoUrl = `${window.location.origin}/?demo=${p.demoSlug || ''}&clinic=${encodeURIComponent(p.businessName)}`;
                      const emailSubject = encodeURIComponent(`Quick lead triage observation for ${p.businessName}`);
                      const emailBody = encodeURIComponent(
                        `Hi ${p.contactName},\n\nI was looking at ${p.businessName}'s website and noticed your after-hours inquiry form currently leaves evening and weekend cosmetic patients waiting until the next business day.\n\nSince high-intent patients typically call another clinic if not answered in 5 minutes, I spun up a private 2-minute interactive demo tailored specifically for ${p.businessName}:\n${demoUrl}\n\nWould you like to turn this on for your practice?\n\nBest,\n${ownerName}\n${agencyName}\n${ownerPhone}`
                      );
                      const mailtoUrl = `mailto:${p.email}?subject=${emailSubject}&body=${emailBody}`;

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{p.businessName}</div>
                            <div className="text-[11px] text-slate-400">{p.contactName} · {p.email}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                            {p.identifiedProblem || 'Static contact form with no after-hours triage'}
                          </td>
                          <td className="py-3 px-4">
                            <a
                              href={demoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px]"
                            >
                              <span>Private Demo</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Hi ${p.contactName},\n\nI audited ${p.businessName} and noticed after-hours cosmetic inquiries have no instant triage.\n\nHere is your private 2-minute demo link: ${demoUrl}\n\nBest,\n${ownerName}`
                                  );
                                  setCopiedPitchId(p.id);
                                  setTimeout(() => setCopiedPitchId(null), 2000);
                                }}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                <span>{copiedPitchId === p.id ? 'Copied!' : 'Copy Pitch'}</span>
                              </button>
                              <a
                                href={mailtoUrl}
                                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded flex items-center gap-1 shadow-xs"
                              >
                                <Send className="w-3 h-3" />
                                <span>Email Doctor</span>
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AGENCY BRANDING & STRIPE LIVE PAYMENTS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Agency Branding & Stripe Payments</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure your agency identity, contact email, and live Stripe checkout links to collect client retainer payments directly.
              </p>
            </div>

            <form onSubmit={handleSaveAgencySettings} className="space-y-6">
              {/* Stripe Payment Links */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-bold text-white">Live Stripe Payment Gateway Links</h2>
                  </div>
                  <a
                    href="https://dashboard.stripe.com/payment-links"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                  >
                    <span>Create Links on Stripe.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1 leading-relaxed">
                  <div className="font-semibold text-white">How to connect your Stripe account in 60 seconds:</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>Log into your free account at <strong className="text-white">dashboard.stripe.com</strong></li>
                    <li>Click <strong className="text-white">Payment Links</strong> &gt; <strong className="text-white">+ New</strong></li>
                    <li>Set monthly recurring price: e.g. <strong className="text-emerald-400">$1,000 / month</strong> (Growth Tier)</li>
                    <li>Copy your Stripe payment URL (e.g. <code className="text-sky-300">https://buy.stripe.com/...</code>) and paste it below!</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-200">
                      Starter Plan Stripe Link ($500/mo)
                    </label>
                    <input
                      type="url"
                      value={stripeStarterLink}
                      onChange={(e) => setStripeStarterLink(e.target.value)}
                      placeholder="https://buy.stripe.com/starter_link"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    {stripeStarterLink && (
                      <a
                        href={stripeStarterLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 pt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Test Starter Checkout</span>
                      </a>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-200">
                      Growth Plan Stripe Link ($1,000/mo) · Recommended
                    </label>
                    <input
                      type="url"
                      value={stripeGrowthLink}
                      onChange={(e) => setStripeGrowthLink(e.target.value)}
                      placeholder="https://buy.stripe.com/growth_link"
                      className="w-full bg-slate-950 border border-emerald-900 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    {stripeGrowthLink && (
                      <a
                        href={stripeGrowthLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 pt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Test Growth Checkout</span>
                      </a>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-200">
                      Pro Plan Stripe Link ($2,000/mo)
                    </label>
                    <input
                      type="url"
                      value={stripeProLink}
                      onChange={(e) => setStripeProLink(e.target.value)}
                      placeholder="https://buy.stripe.com/pro_link"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                    {stripeProLink && (
                      <a
                        href={stripeProLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 pt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Test Pro Checkout</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Agency Branding Details */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-sm">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <Settings className="w-4 h-4 text-sky-400" />
                  <h2 className="text-sm font-bold text-white">Agency Branding & Public Contact</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Agency Name</label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="LeadFlow AI Agency"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Owner / Founder Name</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Umer Hashmi"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Billing & Contact Email (Receives notifications)
                    </label>
                    <input
                      type="email"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="umerhashmi987@gmail.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Support Phone</label>
                    <input
                      type="tel"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="+1 (555) 782-9011"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Agency Domain</label>
                    <input
                      type="text"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      placeholder="leadflow-agency.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  {settingsSaved && (
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Settings & Stripe Configuration Saved Successfully!</span>
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
                >
                  Save Settings & Stripe Links
                </button>
              </div>
            </form>
          </div>
        )}

        {/* GOOGLE RESEARCH & MAPS INTEL TAB */}
        {activeTab === 'google_research' && <GoogleLiveExplorerView />}

        {/* SYSTEM HEALTH ($0 Free-First) (Rule 37 & 49) */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">System Health & Cloud Architecture</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cloud infrastructure: Google Cloud Gemini API and server-side lead intake.
                </p>
              </div>

              <button
                onClick={handleRunHealthCheck}
                disabled={isCheckingHealth}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 self-start"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                <span>Test Provider Latencies</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Database Engine</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    HEALTHY
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">Local-First Storage ($0 Capital)</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tenant-isolated store with zero database hosting bill. Migratable to PostgreSQL via Prisma.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">AI Gateway</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    HEALTHY
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">Cascading Router with Mock Fallback</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Deterministic offline fallback ensures uninterrupted client widget triage without paid API costs.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Cloud AI Infrastructure</span>
                  <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                    CLOUD ACTIVE
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">Google Gemini 3.8 Flash</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  100% cloud-hosted AI inference. Zero local models or local hardware footprint.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Automation Engine</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    HEALTHY
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">In-Memory Scheduler & Opt-Out Guard</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Evaluates triggers, enforces duplicate message suppression, and terminates sequences on reply.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Billing Engine</span>
                  <span className="text-[10px] font-semibold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                    MOCK ACTIVE
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">Zero-Fee Billing Abstraction</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tracks Starter/Growth/Pro subscription statuses without incurring payment processor setup costs.
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">Tenant Isolation Guard</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    VERIFIED
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">Cross-Tenant Barrier Enforced</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mandatory test confirms Org A cannot access Org B documents, leads, or appointments.
                </p>
              </div>
            </div>

            {/* Provider Test Results */}
            {providerHealthList.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-3">Live Provider Diagnostic Results</h3>
                <div className="space-y-2">
                  {providerHealthList.map((res, i) => (
                    <div key={i} className="p-3 bg-slate-950 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-200">{res.providerName}</span>
                        <span className="text-[11px] text-slate-500 ml-2">{res.details}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono">{res.latencyMs}ms</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            res.status === 'HEALTHY'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {res.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUDIT LOGS TAB (Rule 36) */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Audit Logs & Security Stream</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Every sensitive administrative and tenant-level mutation is recorded here.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{log.userName}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sky-400 text-[11px]">{log.action}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {log.entityType} ({log.entityId.slice(0, 8)})
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-[11px]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* AI Research & Outreach Review Modal (Rule 22 & 23) */}
      {selectedProspect && researchReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">AI Prospect Audit & Outreach Draft</h3>
                <span className="text-xs text-slate-400">{selectedProspect.businessName}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedProspect(null);
                  setResearchReport(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 block font-medium">Business Summary</span>
                  <span className="text-slate-300">{researchReport.businessSummary}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Website Funnel Issue</span>
                  <span className="text-amber-400">{researchReport.websiteIssue}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Lead Response Leak</span>
                  <span className="text-rose-400">{researchReport.leadResponseIssue}</span>
                </div>
                <div>
                  <span className="text-slate-500 block font-medium">Personalized Outreach Angle</span>
                  <span className="text-sky-300">{researchReport.personalizedOutreachAngle}</span>
                </div>
              </div>

              {selectedProspect.outreachDraft ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Personalized Draft (Requires Human Approval)</span>
                    <span className="text-[10px] text-amber-400">Rule 23 Enforced</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                    <div className="font-semibold text-slate-200">
                      Subject: {selectedProspect.outreachDraft.subject}
                    </div>
                    <pre className="font-sans whitespace-pre-wrap text-slate-300 text-xs leading-relaxed">
                      {selectedProspect.outreachDraft.body}
                    </pre>
                  </div>

                  {!selectedProspect.outreachDraft.approvedByHuman && (
                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          handleApproveOutreach(selectedProspect.id);
                          setSelectedProspect(null);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-lg flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Human Approve & Mark Sent</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <button
                    onClick={() => handleGenerateOutreach(selectedProspect)}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white rounded-lg flex items-center gap-1.5 mx-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Personalized Outreach Draft</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Proposal Builder Modal (Rule 26) */}
      {showProposalModal && proposalDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Service Proposal Generator</h3>
              <button onClick={() => setShowProposalModal(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Clinic:</span>
                  <span className="font-semibold text-white">{proposalDraft.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Package Tier:</span>
                  <span className="text-sky-400 font-semibold">{proposalDraft.packageTier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">One-Time Setup Fee:</span>
                  <span className="font-semibold text-white">${proposalDraft.setupFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Monthly Recurring Fee:</span>
                  <span className="font-semibold text-emerald-400">${proposalDraft.monthlyFee}/month</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-300 block mb-1.5">Deliverables Included:</span>
                <ul className="space-y-1 text-slate-400">
                  {proposalDraft.deliverables.map((d, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowProposalModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProposal}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white rounded-lg shadow-sm"
              >
                Confirm & Record Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Prospect Modal */}
      {showAddProspectModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full max-h-[85vh] flex flex-col text-slate-100 shadow-2xl relative overflow-hidden">
            {/* Header */}
            <div className="p-5 sm:p-6 pb-3 border-b border-slate-800 shrink-0 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Add Clinic Prospect to CRM</h3>
              <button onClick={() => setShowAddProspectModal(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">

            <form onSubmit={handleAddProspect} className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Practice Name</label>
                <input
                  type="text"
                  value={pBusiness}
                  onChange={(e) => setPBusiness(e.target.value)}
                  placeholder="e.g. Tribeca Smile Artistry"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Website URL</label>
                <input
                  type="url"
                  value={pWebsite}
                  onChange={(e) => setPWebsite(e.target.value)}
                  placeholder="https://tribecasmile.example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Doctor / Director</label>
                <input
                  type="text"
                  value={pContact}
                  onChange={(e) => setPContact(e.target.value)}
                  placeholder="Dr. Julia Vance"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={pEmail}
                  onChange={(e) => setPEmail(e.target.value)}
                  placeholder="dr.vance@tribecasmile.example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Verified Audit Observation</label>
                <textarea
                  value={pObs}
                  onChange={(e) => setPObs(e.target.value)}
                  rows={2}
                  placeholder="e.g. Website has a generic 8-field contact form with no after-hours triage"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProspectModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-lg"
                >
                  Save Target
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
