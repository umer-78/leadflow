/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  Shield,
  Sparkles,
  Target,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';
import { autonomousAgent } from '../../lib/automation/autonomous-agent.ts';

export type ActiveView =
  | 'MARKETING'
  | 'AUTONOMOUS'
  | 'AI_ACQUISITION'
  | 'CLIENT_DASHBOARD'
  | 'ADMIN_COMMAND'
  | 'WIDGET_SIMULATOR'
  | 'TESTS'
  | 'PLAYBOOK';

interface NavbarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  onOpenAuth: () => void;
}

export function Navbar({ activeView, setActiveView, onOpenAuth }: NavbarProps) {
  const state = appStore.getState();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);

  const currentUser = state.currentUser;
  const currentOrg = state.currentOrg;

  const isAgencyWorkspace = [
    'ADMIN_COMMAND',
    'AI_ACQUISITION',
    'AUTONOMOUS',
    'TESTS',
    'PLAYBOOK',
  ].includes(activeView);

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Left Navigation */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveView('MARKETING')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold tracking-tight shadow-sm group-hover:bg-sky-500 transition-colors">
                LF
              </div>
              <div>
                <span className="font-semibold text-sm tracking-tight text-white block">
                  LeadFlow AI
                </span>
                <span className="text-[11px] text-slate-400 block -mt-0.5">
                  {isAgencyWorkspace ? 'Agency Master Operations' : '24/7 Practice Receptionist'}
                </span>
              </div>
            </button>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 border-l border-slate-800 pl-6">
              {isAgencyWorkspace ? (
                // AGENCY FOUNDER WORKSPACE TABS (Private to Agency Owner)
                <>
                  <button
                    onClick={() => setActiveView('ADMIN_COMMAND')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                      activeView === 'ADMIN_COMMAND'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Agency Command</span>
                  </button>

                  <button
                    onClick={() => setActiveView('AI_ACQUISITION')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                      activeView === 'AI_ACQUISITION'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-sky-400 hover:text-sky-300 hover:bg-sky-950/40'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>AI Client Acquisition</span>
                  </button>

                  <button
                    onClick={() => setActiveView('AUTONOMOUS')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                      activeView === 'AUTONOMOUS'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40'
                    }`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Autonomous Engine</span>
                  </button>

                  <button
                    onClick={() => setActiveView('TESTS')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeView === 'TESTS'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Security & Health</span>
                  </button>
                </>
              ) : (
                // CLIENT & PUBLIC VIEW (Clean production website & portal)
                <>
                  <button
                    onClick={() => setActiveView('MARKETING')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeView === 'MARKETING'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    Website & Solutions
                  </button>

                  <button
                    onClick={() => setActiveView('WIDGET_SIMULATOR')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeView === 'WIDGET_SIMULATOR'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Live 24/7 AI Receptionist</span>
                  </button>

                  <button
                    onClick={() => setActiveView('CLIENT_DASHBOARD')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      activeView === 'CLIENT_DASHBOARD'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Practice Client Portal</span>
                  </button>
                </>
              )}
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Mode Switcher Toggle */}
            {isAgencyWorkspace ? (
              <button
                onClick={() => setActiveView('CLIENT_DASHBOARD')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs text-sky-300 transition-colors flex items-center gap-1.5 shadow-xs"
                title="Switch to Client Practice Portal"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline font-medium">View Practice Portal</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveView('ADMIN_COMMAND')}
                className="px-3 py-1.5 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800 rounded-lg text-xs text-indigo-300 transition-colors flex items-center gap-1.5 shadow-xs"
                title="Open Agency Owner Workspace"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline font-medium">Agency Workspace (Owner)</span>
              </button>
            )}

            {/* Clean Slate & Reset Button */}
            <div className="relative">
              <button
                onClick={() => setShowResetMenu(!showResetMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 rounded-lg text-xs text-rose-200 transition-colors shadow-xs"
                title="Reset database to clean slate or clear logs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline font-medium">Reset</span>
                <ChevronDown className="w-3 h-3 text-rose-400" />
              </button>

              {showResetMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2.5 text-xs z-50">
                  <div className="px-2 pb-2 mb-1.5 border-b border-slate-800">
                    <span className="font-semibold text-white block">Database & State Controls</span>
                    <span className="text-[11px] text-slate-400">Manage live working database</span>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        appStore.clearToCleanSlate();
                        autonomousAgent.clearLogs();
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 border border-rose-800 text-rose-200 transition-colors"
                    >
                      <div className="font-semibold text-xs text-rose-300">Clean Slate (0 Leads, Pure Start)</div>
                      <div className="text-[10px] text-rose-400/80 mt-0.5">
                        Wipes all records and logs. Ready for 100% real live inquiries.
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        appStore.clearAllLogs();
                        autonomousAgent.clearLogs();
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
                    >
                      <div className="font-semibold text-xs text-slate-200">Clear Activity Logs Only</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Empties all event streams and automation logs.
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-xs text-slate-200 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="text-left">
                  <div className="font-medium text-white truncate max-w-[130px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {currentUser.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 text-xs z-50">
                  <div className="pb-3 border-b border-slate-800">
                    <span className="font-semibold text-white block">{currentUser.name}</span>
                    <span className="text-[11px] text-slate-400 block">{currentUser.email}</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-semibold">
                        {currentUser.role}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate">
                        {currentOrg.name}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenAuth();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors flex items-center gap-2"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Switch User / Log In</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
