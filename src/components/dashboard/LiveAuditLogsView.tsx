/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Mail,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import { AuditLog } from '../../lib/types/index.ts';

export function LiveAuditLogsView() {
  const state = appStore.getState();
  const currentOrg = state.currentOrg;
  const auditLogs = state.auditLogs;

  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesOrg = !log.organizationId || log.organizationId === currentOrg.id;
    const matchesType = filterType === 'ALL' || log.entityType === filterType;
    const matchesSearch =
      searchQuery === '' ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(log.details).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOrg && matchesType && matchesSearch;
  });

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leadflow_audit_logs_${currentOrg.id}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-semibold uppercase tracking-wider mb-1">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Immutable Practice Operations & Security Logs</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Real-Time System Audit Trail & Email Dispatches
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified event ledger tracking patient intake, security updates, email alerts, and staff actions.
          </p>
        </div>

        <button
          onClick={handleExportLogs}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>Export Audit Log JSON</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] text-slate-400">Total Logged Events</div>
          <div className="text-lg font-bold text-white">{auditLogs.length}</div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] text-slate-400">Security Events</div>
          <div className="text-lg font-bold text-emerald-400">
            {auditLogs.filter((l) => l.entityType === 'SECURITY').length}
          </div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] text-slate-400">Lead Intakes & Triage</div>
          <div className="text-lg font-bold text-sky-400">
            {auditLogs.filter((l) => l.entityType === 'LEAD').length}
          </div>
        </div>
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-[11px] text-slate-400">Owner Email Target</div>
          <div className="text-xs font-mono font-semibold text-slate-200 truncate">
            {state.agencySettings.ownerEmail || 'umerhashmi987@gmail.com'}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by action, user, or event details..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Event Categories</option>
            <option value="SECURITY">Security & Access</option>
            <option value="LEAD">Patient Leads</option>
            <option value="APPOINTMENT">Appointments</option>
            <option value="TEAM">Team & Staff</option>
            <option value="PRIVACY_COMPLIANCE">Privacy & HIPAA</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Actor / User</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <Activity className="w-6 h-6 mx-auto mb-2 text-slate-600 opacity-60" />
                    <span>No log records match the current filter. Real operations will log here automatically.</span>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          log.entityType === 'SECURITY'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : log.entityType === 'LEAD'
                            ? 'bg-sky-950 text-sky-400 border border-sky-800'
                            : log.entityType === 'APPOINTMENT'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {log.entityType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.userName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px] max-w-md truncate">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
