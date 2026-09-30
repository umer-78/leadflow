/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Code,
  CreditCard,
  Edit,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import { assertPermission, hasPermission } from '../../lib/auth/auth-service.ts';
import { calculateLeadScore } from '../../lib/crm/scoring.ts';
import { appStore } from '../../lib/store/app-store.ts';
import { Appointment, Lead, LeadStatus, UserRole } from '../../lib/types/index.ts';

type DashboardTab =
  | 'overview'
  | 'leads'
  | 'appointments'
  | 'conversations'
  | 'knowledge'
  | 'automations'
  | 'team'
  | 'widget'
  | 'billing';

export function ClientDashboardView() {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;
  const currentUser = state.currentUser;

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [leadFilter, setLeadFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScoreLead, setSelectedScoreLead] = useState<Lead | null>(null);

  // Modal states
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddAptModal, setShowAddAptModal] = useState(false);
  const [showInviteStaffModal, setShowInviteStaffModal] = useState(false);
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editDocContent, setEditDocContent] = useState('');

  // Form states - Lead
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadService, setNewLeadService] = useState('Clear Aligners (Invisalign)');
  const [newLeadUrgency, setNewLeadUrgency] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newLeadNotes, setNewLeadNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states - Appointment
  const [aptLeadName, setAptLeadName] = useState('');
  const [aptService, setAptService] = useState('Handcrafted Porcelain Veneers');
  const [aptDateTime, setAptDateTime] = useState('2026-10-12T10:00');
  const [aptDuration, setAptDuration] = useState(45);
  const [aptClinician, setAptClinician] = useState('Dr. Elena Rostova');
  const [aptNotes, setAptNotes] = useState('');

  // Form states - Staff
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>('STAFF');

  // Form states - Rule
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState<'lead.created' | 'lead.qualified' | 'appointment.requested'>('lead.created');
  const [ruleCondition, setRuleCondition] = useState('status == NEW');

  // Filter tenant leads
  const orgLeads = state.leads.filter((l) => l.organizationId === currentOrg.id);
  const orgAppointments = state.appointments.filter((a) => a.organizationId === currentOrg.id);
  const orgAutomations = state.automations.filter((a) => a.organizationId === currentOrg.id);
  const orgKnowledge = state.knowledge.filter((k) => k.organizationId === currentOrg.id);
  const orgTeam = state.users.filter((u) => u.organizationId === currentOrg.id);

  // Filtered leads
  const filteredLeads = orgLeads.filter((l) => {
    if (leadFilter !== 'ALL' && l.status !== leadFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.serviceRequested.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate Metrics
  const newLeadsCount = orgLeads.filter((l) => l.status === 'NEW').length;
  const qualifiedCount = orgLeads.filter((l) => l.status === 'QUALIFIED' || l.score.tier === 'HIGH').length;
  const bookedCount = orgLeads.filter((l) => l.status === 'APPOINTMENT_BOOKED').length;
  const conversionRate = orgLeads.length > 0 ? Math.round((bookedCount / orgLeads.length) * 100) : 0;
  const pendingFollowups = orgLeads.filter((l) => l.followupScheduledAt && !l.optedOut).length;

  const canWriteLeads = hasPermission(currentUser.role, 'leads:write');
  const canDeleteLeads = hasPermission(currentUser.role, 'leads:delete');
  const canManageAutomations = hasPermission(currentUser.role, 'automations:manage');
  const canManageTeam = hasPermission(currentUser.role, 'team:manage');
  const canViewBilling = hasPermission(currentUser.role, 'org:billing');

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    try {
      setActionError(null);
      appStore.updateLead(leadId, { status: newStatus });
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleDeleteLead = (leadId: string) => {
    try {
      setActionError(null);
      appStore.deleteLead(leadId);
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      appStore.createLead({
        name: newLeadName,
        email: newLeadEmail,
        phone: newLeadPhone,
        serviceRequested: newLeadService,
        urgency: newLeadUrgency,
        notes: newLeadNotes,
        status: 'NEW',
        source: 'Manual Staff Intake',
        estimatedValue: newLeadService.toLowerCase().includes('veneer') ? 8000 : 3500,
      });
      setShowAddLeadModal(false);
      setNewLeadName('');
      setNewLeadEmail('');
      setNewLeadPhone('');
      setNewLeadNotes('');
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      appStore.createAppointment({
        leadId: `lead-${Date.now()}`,
        leadName: aptLeadName,
        service: aptService,
        dateTime: new Date(aptDateTime).toISOString(),
        durationMinutes: Number(aptDuration),
        status: 'CONFIRMED',
        providerStaffName: aptClinician,
        notes: aptNotes,
      });
      setShowAddAptModal(false);
      setAptLeadName('');
      setAptNotes('');
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleInviteStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      appStore.inviteTeamMember(staffName, staffEmail, staffRole);
      setShowInviteStaffModal(false);
      setStaffName('');
      setStaffEmail('');
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      appStore.createAutomationRule({
        name: ruleName,
        description: `Custom automation rule triggered on ${ruleTrigger}`,
        trigger: ruleTrigger,
        condition: ruleCondition,
        actions: [{ type: 'notify_client', params: { priority: 'NORMAL' } }],
        enabled: true,
      });
      setShowAddRuleModal(false);
      setRuleName('');
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleSaveKnowledge = (docId: string) => {
    setActionError(null);
    try {
      appStore.updateKnowledge(docId, editDocContent);
      setEditingDocId(null);
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const handleResolveHandoff = () => {
    appStore.resolveHandoff();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900/60 border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between">
        <div>
          {/* Org Header */}
          <div className="pb-4 mb-4 border-b border-slate-800">
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
              Active Practice
            </span>
            <h2 className="text-sm font-bold text-white truncate mt-0.5">{currentOrg.name}</h2>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>{currentOrg.industry}</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">{currentOrg.status}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'overview'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('leads')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'leads'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Leads & Triage</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">
                {orgLeads.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('appointments')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'appointments'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4" />
                <span>Appointments</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">
                {orgAppointments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('conversations')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'conversations'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Conversations & Handoff</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'knowledge'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Knowledge Base & FAQs</span>
            </button>

            <button
              onClick={() => setActiveTab('automations')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'automations'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4" />
                <span>Automations</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">
                {orgAutomations.filter((a) => a.enabled).length} active
              </span>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'team'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Team & Roles</span>
            </button>

            <button
              onClick={() => setActiveTab('widget')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors ${
                activeTab === 'widget'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>Widget Embed Code</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeTab === 'billing'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4" />
                <span>Plan & Billing</span>
              </div>
              <span className="text-[10px] font-mono text-sky-400 uppercase">
                {currentOrg.planId}
              </span>
            </button>
          </nav>
        </div>

        {/* User Role Badge in Sidebar */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Current Role</span>
            <span className="font-semibold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              {currentUser.role}
            </span>
          </div>
          {currentUser.role === 'VIEWER' && (
            <p className="text-[10px] text-amber-400/90 mt-1">
              Read-Only: Actions that create or mutate data are restricted.
            </p>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {actionError && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Practice Intake Overview</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Live metrics for {currentOrg.name} across 24/7 autonomous inquiry triage.
              </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Total Leads</span>
                <span className="text-2xl font-bold text-white mt-1 block">{orgLeads.length}</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">New Intake</span>
                <span className="text-2xl font-bold text-sky-400 mt-1 block">{newLeadsCount}</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Qualified (High)</span>
                <span className="text-2xl font-bold text-emerald-400 mt-1 block">{qualifiedCount}</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Consultations Booked</span>
                <span className="text-2xl font-bold text-white mt-1 block">{bookedCount}</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Consultation Rate</span>
                <span className="text-2xl font-bold text-white mt-1 block">{conversionRate}%</span>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Follow-Ups Due</span>
                <span className="text-2xl font-bold text-amber-400 mt-1 block">{pendingFollowups}</span>
              </div>
            </div>

            {/* Quick Actions & Recent Leads Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Recent Patient Inquiries</h3>
                  <span className="text-xs text-slate-400">
                    Highest-priority elective treatment inquiries captured by AI Receptionist
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('leads')}
                    className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                  >
                    View All {orgLeads.length} Leads →
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-y border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Service Interest</th>
                      <th className="py-2.5 px-3">Urgency</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {orgLeads.slice(0, 4).map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{lead.name}</div>
                          <div className="text-[11px] text-slate-400">{lead.phone || lead.email}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-200">{lead.serviceRequested}</td>
                        <td className="py-3 px-3">
                          <span
                            className={
                              lead.urgency === 'HIGH'
                                ? 'text-rose-400 font-medium'
                                : lead.urgency === 'MEDIUM'
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }
                          >
                            {lead.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => setSelectedScoreLead(lead)}
                            className="text-left group cursor-pointer"
                          >
                            <span
                              className={`font-semibold ${
                                lead.score.tier === 'HIGH'
                                  ? 'text-emerald-400'
                                  : lead.score.tier === 'MEDIUM'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {lead.score.score} pts ({lead.score.tier})
                            </span>
                            <span className="text-[10px] text-slate-500 block group-hover:text-sky-400">
                              View reasons
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-300 font-mono text-[11px]">
                            {lead.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-white">
                          ${lead.estimatedValue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LEADS & TRIAGE TAB */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Lead Pipeline & Triage</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Qualified patients, follow-up cadence, and status progression.
                </p>
              </div>
              {canWriteLeads && (
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 self-start shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lead Manually</span>
                </button>
              )}
            </div>

            {/* Filter Bar & Search */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              {/* Segmented Filter Buttons (interactive buttons, anti-slop compliant) */}
              <div className="flex flex-wrap items-center gap-1">
                {(['ALL', 'NEW', 'QUALIFIED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_BOOKED', 'DO_NOT_CONTACT'] as const).map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setLeadFilter(status)}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                        leadFilter === status
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {status === 'ALL' ? 'All Leads' : status.replace('_', ' ')}
                    </button>
                  )
                )}
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Leads Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Procedure Interest</th>
                      <th className="py-3 px-4">Score & Intent</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Next Follow-Up</th>
                      <th className="py-3 px-4">Est. Value</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{lead.name}</div>
                          <div className="text-[11px] text-slate-400">{lead.phone || 'No phone'}</div>
                          <div className="text-[10px] text-slate-500">{lead.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-medium">{lead.serviceRequested}</div>
                          {lead.preferredDate && (
                            <div className="text-[10px] text-sky-400 mt-0.5">
                              Prefers: {lead.preferredDate} ({lead.preferredTime || 'Anytime'})
                            </div>
                          )}
                          {lead.notes && (
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                              {lead.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => setSelectedScoreLead(lead)}
                            className="text-left group cursor-pointer"
                          >
                            <span
                              className={`font-semibold ${
                                lead.score.tier === 'HIGH'
                                  ? 'text-emerald-400'
                                  : lead.score.tier === 'MEDIUM'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {lead.score.score} pts ({lead.score.tier})
                            </span>
                            <span className="text-[10px] text-slate-500 block group-hover:text-sky-400">
                              View breakdown
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          {canWriteLeads ? (
                            <select
                              value={lead.status}
                              onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-sky-500"
                            >
                              <option value="NEW">NEW</option>
                              <option value="QUALIFIED">QUALIFIED</option>
                              <option value="CONTACTED">CONTACTED</option>
                              <option value="APPOINTMENT_REQUESTED">APPOINTMENT REQUESTED</option>
                              <option value="APPOINTMENT_BOOKED">APPOINTMENT BOOKED</option>
                              <option value="WON">WON</option>
                              <option value="LOST">LOST</option>
                              <option value="DO_NOT_CONTACT">DO NOT CONTACT</option>
                            </select>
                          ) : (
                            <span className="text-slate-300 font-mono text-[11px]">
                              {lead.status.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {lead.optedOut ? (
                            <span className="text-rose-400 text-[11px]">Opted Out (Stopped)</span>
                          ) : lead.followupScheduledAt ? (
                            <div>
                              <span className="text-amber-400 font-mono text-[11px]">
                                Step {lead.followupCount + 1}
                              </span>
                              <div className="text-[10px] text-slate-500">
                                {new Date(lead.followupScheduledAt).toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">None pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          ${lead.estimatedValue.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canDeleteLeads && (
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'appointments' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Consultation Appointments</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Organized consultation bookings captured from conversational intake.
                </p>
              </div>
              <button
                onClick={() => setShowAddAptModal(true)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 self-start shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Consultation</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgAppointments.map((apt) => (
                <div key={apt.id} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
                        {apt.service}
                      </span>
                      <h3 className="text-base font-bold text-white mt-1">{apt.leadName}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        apt.status === 'CONFIRMED'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {apt.status}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(apt.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      <span className="text-slate-500">({apt.durationMinutes} mins)</span>
                    </div>
                    {apt.providerStaffName && (
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                        <span>Clinician: {apt.providerStaffName}</span>
                      </div>
                    )}
                    {apt.notes && (
                      <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded mt-2">
                        {apt.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CONVERSATIONS & HANDOFF TAB */}
        {activeTab === 'conversations' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Conversations & Live Handoffs</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                AI receptionist transcripts and human intervention queues.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-white">Active Reception Queue</span>
                </div>
                <button
                  onClick={handleResolveHandoff}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg transition-colors"
                >
                  ✓ Mark All Alerts Resolved
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                    <span className="font-semibold text-slate-200">Visitor: Samantha Hughes</span>
                    <span>14:32 Today</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-2 bg-slate-900 rounded text-slate-300">
                      <strong className="text-slate-400">Visitor:</strong> "Hi! I am getting married in November and want porcelain veneers for my front teeth. How much are they?"
                    </div>
                    <div className="p-2 bg-sky-950/40 border border-sky-900/40 rounded text-slate-300">
                      <strong className="text-sky-400">AI Receptionist:</strong> "Handcrafted e.max porcelain veneers are $1,400 per tooth. Two appointments are required: design & aesthetic prep, followed by final bonding. Would you like to share your phone number so our treatment coordinator can verify your insurance or schedule a consultation?"
                    </div>
                    <div className="p-2 bg-slate-900 rounded text-slate-300">
                      <strong className="text-slate-400">Visitor:</strong> "Yes, my number is 555-902-4411 and mornings work best."
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-emerald-400 pt-2 border-t border-slate-900">
                    <span>✓ Lead automatically extracted & scored 85 pts (HIGH)</span>
                    <span className="text-slate-500">Sentiment: POSITIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KNOWLEDGE BASE TAB */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Practice Knowledge Base</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Clinical boundaries, procedure pricing, operating hours, and financing policies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {orgKnowledge.map((doc) => (
                <div key={doc.id} className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                        {doc.category}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{doc.title}</h3>
                    </div>
                    <button
                      onClick={() => {
                        setEditingDocId(doc.id);
                        setEditDocContent(doc.content);
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-400 rounded flex items-center gap-1 transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      <span>Edit Content</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {doc.chunks.map((chunk) => (
                      <div key={chunk.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg">
                        <div className="font-semibold text-xs text-slate-200">{chunk.heading}</div>
                        <div className="text-xs text-slate-400 mt-1 leading-relaxed">{chunk.content}</div>
                        <div className="flex flex-wrap gap-1 mt-2 text-[10px] text-slate-500">
                          {chunk.keywords.map((kw, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-slate-900 rounded">
                              #{kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUTOMATIONS TAB */}
        {activeTab === 'automations' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">Autonomous Sequences</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Disciplined follow-up rules, duplicate prevention, and opt-out stop controls.
                </p>
              </div>
              {canManageAutomations && (
                <button
                  onClick={() => setShowAddRuleModal(true)}
                  className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 self-start shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Custom Rule</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {orgAutomations.map((rule) => (
                <div key={rule.id} className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{rule.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                          TRIGGER: {rule.trigger}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                    </div>

                    <button
                      onClick={() => appStore.toggleAutomation(rule.id)}
                      disabled={!canManageAutomations}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        rule.enabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>Condition: <code className="text-slate-300">{rule.condition}</code></span>
                      <span>·</span>
                      <span>Executions: <strong className="text-white">{rule.executionCount}</strong></span>
                    </div>
                    <span className="text-[11px] text-emerald-400">
                      ✓ Zero communication after patient replies or opt-outs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM & ROLES TAB */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Practice Staff & Roles</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Server-enforced role-based access control (OWNER, ADMIN, STAFF, VIEWER).
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Permission Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orgTeam.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4 font-semibold text-white">{u.name}</td>
                      <td className="py-3 px-4 text-slate-400">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sky-400 font-semibold">{u.role}</span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">
                        {u.role === 'OWNER' && 'Full system control, billing, automations, team management, deletion.'}
                        {u.role === 'ADMIN' && 'Manage automations, knowledge base, leads, appointments.'}
                        {u.role === 'STAFF' && 'Read/write leads, consultation appointments, conversational handoff.'}
                        {u.role === 'VIEWER' && 'Read-only audit access. All write/delete mutations prohibited.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WIDGET EMBED TAB */}
        {activeTab === 'widget' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Embeddable Web Widget</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Simple one-line snippet to deploy LeadFlow AI onto your practice website.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto">
                {`<!-- LeadFlow AI Widget Tag: ${currentOrg.name} -->
<script
  src="https://app.leadflow.ai/widget.js"
  data-widget-id="${currentOrg.widgetId}"
  data-color="${currentOrg.widgetColor}"
  defer
></script>`}
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <h4 className="font-semibold text-white">Installation Instructions:</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Copy the script snippet above.</li>
                  <li>Open your website CMS (WordPress, Squarespace, Webflow, or Wix).</li>
                  <li>Paste the code directly before the closing <code className="text-sky-300">&lt;/body&gt;</code> tag in custom code settings.</li>
                  <li>Save and publish. The 24/7 AI Receptionist will immediately appear on your site.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* BILLING TAB */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Practice Subscription & Billing</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero surprise usage fees. Predictable flat monthly plan.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 max-w-xl">
              <div className="flex justify-between items-start pb-4 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
                    Current Plan
                  </span>
                  <h3 className="text-lg font-bold text-white capitalize mt-0.5">{currentOrg.planId} Tier</h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">${currentOrg.monthlyFee}</div>
                  <div className="text-xs text-slate-400">per month</div>
                </div>
              </div>

              <div className="py-4 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subscription Status:</span>
                  <span className="text-emerald-400 font-semibold">{currentOrg.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Billing Engine:</span>
                  <span className="text-slate-300">Mock Provider ($0 Capital Local Architecture)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Next Renewal Date:</span>
                  <span className="text-slate-300">November 1, 2026</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Score Breakdown Modal */}
      {selectedScoreLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Lead Qualification Breakdown</h3>
                <span className="text-xs text-slate-400">{selectedScoreLead.name}</span>
              </div>
              <button
                onClick={() => setSelectedScoreLead(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-xs text-slate-400">Assigned Score</span>
                <span className="text-lg font-bold text-emerald-400">
                  {selectedScoreLead.score.score} pts ({selectedScoreLead.score.tier})
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-2">
                  Transparent Point Factors:
                </span>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {selectedScoreLead.score.reasons.map((r, i) => (
                    <li key={i} className="p-2 bg-slate-950/60 rounded border border-slate-800/80">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setSelectedScoreLead(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Intake Lead Manually</h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Patient Name</label>
                <input
                  type="text"
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="e.g. Rachel Adams"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  placeholder="rachel@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="+1 (555) 321-9988"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Service Requested</label>
                <select
                  value={newLeadService}
                  onChange={(e) => setNewLeadService(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Clear Aligners (Invisalign)">Clear Aligners (Invisalign)</option>
                  <option value="Handcrafted Porcelain Veneers">Handcrafted Porcelain Veneers</option>
                  <option value="Single & Full-Arch Dental Implants">Single & Full-Arch Dental Implants</option>
                  <option value="In-Office Laser Teeth Whitening">In-Office Laser Teeth Whitening</option>
                  <option value="Comprehensive Exam & Prophylaxis">Comprehensive Exam & Prophylaxis</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Urgency</label>
                <select
                  value={newLeadUrgency}
                  onChange={(e) => setNewLeadUrgency(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="HIGH">HIGH (Within 7-14 days)</option>
                  <option value="MEDIUM">MEDIUM (Standard 30 days)</option>
                  <option value="LOW">LOW (Just researching)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Intake Notes</label>
                <textarea
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  rows={2}
                  placeholder="Patient notes or specific concerns..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white rounded-lg"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
