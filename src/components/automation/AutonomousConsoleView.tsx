/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  Flame,
  Layers,
  Play,
  Power,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import { autonomousAgent, AutonomousLogEntry } from '../../lib/automation/autonomous-agent.ts';
import { billingProvider } from '../../lib/billing/provider.ts';
import { appStore } from '../../lib/store/app-store.ts';

export function AutonomousConsoleView() {
  const [logs, setLogs] = useState<AutonomousLogEntry[]>(autonomousAgent.getLogs());
  const [isAutoPilot, setIsAutoPilot] = useState<boolean>(autonomousAgent.isAutoPilot());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastCycleSummary, setLastCycleSummary] = useState<string | null>(null);

  const state = appStore.getState();
  const mrrMetrics = billingProvider.calculateMRR(state.organizations);

  // Subscribe to agent log changes
  useEffect(() => {
    const unsub = autonomousAgent.subscribe(() => {
      setLogs(autonomousAgent.getLogs());
      setIsAutoPilot(autonomousAgent.isAutoPilot());
    });
    return () => {
      unsub();
    };
  }, []);

  const handleRunCycle = async () => {
    setIsRunning(true);
    try {
      const summary = await autonomousAgent.runAutonomousCycle();
      setLastCycleSummary(
        `Cycle complete: ${summary.prospectsResearched} clinic audits, ${summary.outreachDrafted} personalized drafts, ${summary.followupsProcessed} patient follow-ups, ${summary.leadsTriaged} triaged leads.`
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleAutoPilot = () => {
    const active = autonomousAgent.toggleAutoPilot();
    setIsAutoPilot(active);
  };

  const handleBatchApproveOutreach = () => {
    state.prospects.forEach((p) => {
      if (p.outreachDraft && !p.outreachDraft.approvedByHuman) {
        appStore.approveOutreach(p.id);
      }
    });
    autonomousAgent.runAutonomousCycle();
  };

  const handleSimulateRealPatientLead = () => {
    const newLead = appStore.createLead({
      name: 'Dr. Katherine Bell (Patient)',
      email: 'katherine.bell@executive.example.com',
      phone: '+1 (555) 849-3312',
      serviceRequested: 'Handcrafted Porcelain Veneers',
      urgency: 'HIGH',
      preferredDate: '2026-10-14',
      preferredTime: 'Morning (11:00 AM)',
      notes: 'Captured via 24/7 AI Receptionist: Patient seeking aesthetic smile enhancement prior to conference.',
      status: 'NEW',
      source: 'Website 24/7 AI Receptionist',
      estimatedValue: 8400,
    });
    autonomousAgent.runAutonomousCycle();
  };

  const pendingOutreachCount = state.prospects.filter(
    (p) => p.outreachDraft && !p.outreachDraft.approvedByHuman
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Master Run & Auto-Pilot Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Autonomous Execution Engine</span>
              <span className="text-slate-600">·</span>
              <span className="text-sky-400">Pursuing $20k/Mo Target</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              LeadFlow Autonomous Operations Engine
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Automates prospecting, personalized outreach drafts, 24/7 patient intake, and follow-up sequences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              onClick={() => {
                autonomousAgent.clearLogs();
                appStore.clearAllLogs();
              }}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              title="Clear all event stream logs"
            >
              Clear Logs
            </button>

            <button
              onClick={() => {
                appStore.clearToCleanSlate();
                autonomousAgent.clearLogs();
              }}
              className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 rounded-lg text-xs font-medium transition-colors"
              title="Wipe to clean slate with 0 leads and $0 MRR"
            >
              Reset to Clean Slate ($0 MRR)
            </button>

            <button
              onClick={handleToggleAutoPilot}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                isAutoPilot
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Power className={`w-3.5 h-3.5 ${isAutoPilot ? 'animate-pulse' : ''}`} />
              <span>{isAutoPilot ? 'Auto-Pilot: ACTIVE (24/7)' : 'Auto-Pilot: PAUSED'}</span>
            </button>

            <button
              onClick={handleRunCycle}
              disabled={isRunning}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
              <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Executing...' : 'Run Autonomous Cycle Now'}</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden">
            <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>Target MRR Engine</span>
              <Target className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">
              ${mrrMetrics.currentMRR.toLocaleString()}
              <span className="text-xs text-slate-400 font-normal ml-1">/ $20,000</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span>MRR Gap: <strong className="text-rose-400">${mrrMetrics.mrrGap.toLocaleString()}</strong></span>
              <span>Need: <strong className="text-sky-400">{mrrMetrics.clientsNeededForTarget} clients</strong></span>
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>Active Practice Pipeline</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400 mt-2">
              ${state.prospects.reduce((sum, p) => sum + p.estimatedDealValue, 0).toLocaleString()}
              <span className="text-xs text-slate-400 font-normal ml-1">/ mo</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span>{state.prospects.length} high-ticket clinics being tracked</span>
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>Patient Inquiries Triaged</span>
              <UserCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{state.leads.length} leads</div>
            <div className="mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span>{state.leads.filter((l) => l.score.tier === 'HIGH').length} High-Intent (Veneers / Implants)</span>
            </div>
          </div>

          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>Consultations Scheduled</span>
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-300 mt-2">
              {state.appointments.length} bookings
            </div>
            <div className="mt-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span>Zero manual front-desk friction</span>
            </div>
          </div>
        </div>

        {/* Quick Automation Actions Panel */}
        <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Autonomous Actions & Growth Triggers</h3>
              <p className="text-xs text-slate-400">
                Trigger real pipeline events to see the autonomous engine take action and process opportunities.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pendingOutreachCount > 0 && (
                <button
                  onClick={handleBatchApproveOutreach}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>1-Click Approve {pendingOutreachCount} Outreach Drafts</span>
                </button>
              )}

              <button
                onClick={handleSimulateRealPatientLead}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate High-Value Patient Intake ($8,400 Veneers)</span>
              </button>
            </div>
          </div>

          {lastCycleSummary && (
            <div className="p-3 bg-sky-950/40 border border-sky-800/60 rounded-lg text-xs text-sky-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{lastCycleSummary}</span>
            </div>
          )}
        </div>

        {/* Real-Time Autonomous Stream Logs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Autonomous Event Stream</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Auto-updating every heartbeat
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto font-mono text-xs">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 hover:bg-slate-800/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      log.phase === 'PROSPECT_RESEARCH'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : log.phase === 'OUTREACH_GEN'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : log.phase === 'FOLLOWUP_EXEC'
                        ? 'bg-sky-950 text-sky-300 border border-sky-800'
                        : log.phase === 'LEAD_TRIAGE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-purple-950 text-purple-300 border border-purple-800'
                    }`}
                  >
                    {log.phase}
                  </span>
                  <div>
                    <div className="text-white font-medium">{log.action}</div>
                    <div className="text-[11px] text-slate-400 font-sans mt-0.5">{log.details}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {log.metricImpact && (
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {log.metricImpact}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
