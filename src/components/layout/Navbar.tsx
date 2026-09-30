/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  Crown,
  Key,
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
import { OwnerMasterControlModal } from '../auth/OwnerMasterControlModal.tsx';

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
  onOpenOwnerModal?: () => void;
}

export function Navbar({ activeView, setActiveView, onOpenAuth, onOpenOwnerModal }: NavbarProps) {
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

  const isOwnerAuthenticated =
    currentUser.email === 'umerhashmi987@gmail.com' ||
    currentUser.organizationId === 'org-agency-root';

  // Strict Security Gate: unauthorized users are routed back to Client Dashboard
  useEffect(() => {
    if (isAgencyWorkspace && !isOwnerAuthenticated) {
      setActiveView('CLIENT_DASHBOARD');
    }
  }, [isAgencyWorkspace, isOwnerAuthenticated, setActiveView]);

  const handleOpenAgencyWorkspace = () => {
    if (isOwnerAuthenticated) {
      setActiveView('ADMIN_COMMAND');
    } else {
      onOpenAuth();
    }
  };

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
              {isAgencyWorkspace && isOwnerAuthenticated ? (
                // AGENCY FOUNDER WORKSPACE TABS (Strictly Gated to Agency Owner)
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
          <div className="flex items-center gap-2">
            {/* Live Role Switcher Pill */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 gap-1 text-[11px] font-semibold">
              <span className="text-slate-400 px-1 flex items-center gap-1">
                <Shield className="w-3 h-3 text-sky-400" />
              </span>
              {(['OWNER', 'ADMIN', 'STAFF', 'VIEWER'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => appStore.setCurrentUserRole(r)}
                  className={`px-2 py-0.5 rounded-lg transition-all ${
                    currentUser.role === r
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title={`Switch active role to ${r}`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Admin & Security Tools Menu Dropdown - OWNER ONLY */}
            {isOwnerAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowResetMenu(!showResetMenu)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 transition-colors shadow-xs"
                  title="Admin Security & System Tools"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Owner Tools</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showResetMenu && (
                  <div className="absolute right-0 mt-2 w-72 max-w-[90vw] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 text-xs z-50 space-y-2">
                    <div className="pb-2 border-b border-slate-800">
                      <span className="font-bold text-white block">System & Security Controls</span>
                      <span className="text-[10px] text-slate-400">Owner Terminal & Clean Slate</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowResetMenu(false);
                        onOpenOwnerModal?.();
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/80 text-amber-200 font-semibold transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span>Owner Master Security</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                        SHA-256
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        appStore.clearToCleanSlate();
                        autonomousAgent.clearLogs();
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-200 font-semibold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-rose-400" />
                        <span>Reset Clean Slate (0 Leads)</span>
                      </div>
                      <div className="text-[10px] text-rose-400/80 mt-0.5">
                        Wipes dummy data for 100% authentic start.
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mode Switcher Toggle */}
            {isAgencyWorkspace ? (
              <button
                onClick={() => setActiveView('CLIENT_DASHBOARD')}
                className="px-3 py-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-800 rounded-xl text-xs text-sky-300 font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                title="Switch to Client Practice Portal"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden md:inline">Practice Portal</span>
              </button>
            ) : (
              <button
                onClick={handleOpenAgencyWorkspace}
                className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 rounded-xl text-xs text-indigo-300 font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                title={isOwnerAuthenticated ? "Open Agency Owner Workspace" : "Sign in as Agency Founder"}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">
                  {isOwnerAuthenticated ? 'Agency Workspace' : 'Agency Login'}
                </span>
              </button>
            )}

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
                      <span>Switch Account / Sign In</span>
                    </button>

                    {isOwnerAuthenticated && onOpenOwnerModal && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onOpenOwnerModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 text-xs font-semibold transition-colors flex items-center gap-2 border-t border-slate-800/80 mt-1 pt-2"
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span>Owner Sovereign Control</span>
                      </button>
                    )}
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
