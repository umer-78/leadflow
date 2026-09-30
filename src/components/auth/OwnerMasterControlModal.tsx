/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  Key,
  Lock,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  User,
  Zap,
} from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';

interface OwnerMasterControlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OwnerMasterControlModal({ isOpen, onClose }: OwnerMasterControlModalProps) {
  if (!isOpen) return null;

  const state = appStore.getState();
  const isOwner =
    state.currentUser.email === 'umerhashmi987@gmail.com' ||
    state.currentUser.organizationId === 'org-agency-root';

  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ShieldAlert className="w-5 h-5" />
              <span>Access Denied</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sovereign Owner Authorization Required. Master password and agency control settings are strictly restricted to Agency Founders (<strong className="text-white">umerhashmi987@gmail.com</strong>).
          </p>
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'PASSWORD' | 'OVERRIDE' | 'LOCK'>('PASSWORD');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Lock state
  const [lockPin, setLockPin] = useState('');

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsProcessing(true);
    try {
      await appStore.setOwnerPassword(newPassword);
      setStatusMsg({
        type: 'success',
        text: 'Owner master password securely updated and hashed with SHA-256.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLockWorkspace = () => {
    appStore.lockWorkspace();
    onClose();
  };

  const handleResetToCleanSlate = () => {
    if (
      window.confirm(
        'Are you sure you want to reset all pipelines to a pristine zero-dummy clean state? This removes all test leads and dummy prospects.'
      )
    ) {
      appStore.clearToCleanSlate();
      setStatusMsg({
        type: 'success',
        text: 'Workspace reset to 100% authentic clean production state.',
      });
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col text-slate-100 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 shrink-0 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Owner & Super Admin Command Center</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Master Password & Sovereign Access Controls
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified Owner: <strong className="text-white">Umer Hashmi</strong> ({state.agencySettings.ownerEmail})
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* Navigation Tabs */}
          <div className="flex gap-2 pb-3 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('PASSWORD')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'PASSWORD'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Master Password</span>
          </button>

          <button
            onClick={() => setActiveTab('LOCK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'LOCK'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Session Lock</span>
          </button>

          <button
            onClick={() => setActiveTab('OVERRIDE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === 'OVERRIDE'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Super Controls</span>
          </button>
        </div>

        {statusMsg && (
          <div
            className={`my-3 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* TAB 1: MASTER PASSWORD */}
        {activeTab === 'PASSWORD' && (
          <form onSubmit={handleUpdatePassword} className="py-4 space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Master Owner Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter strong owner password (min 6 characters)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pr-10 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirm Master Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 Cryptographic Protection</span>
              </div>
              <p>
                Passwords are never stored in plaintext. They are salted and securely hashed client and server-side.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Set Master Password</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SESSION LOCK */}
        {activeTab === 'LOCK' && (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-xs text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Instant Terminal Lock</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Step away from your workstation securely. Locking the terminal blocks all patient records, financial data, and agency proposals until the owner master password is entered.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLockWorkspace}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Workspace Now</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SUPER CONTROLS & CLEAN SLATE */}
        {activeTab === 'OVERRIDE' && (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="font-semibold text-xs text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Purge Demo Data & Force Pristine State</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cleanses all test leads, mock prospects, and temporary appointments, leaving only verified owner data and your clinical procedural pricing knowledge base.
              </p>
              <button
                type="button"
                onClick={handleResetToCleanSlate}
                className="mt-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Wipe All Demo Data (Pristine Production)</span>
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-slate-300">Owner Revenue Objective ($20,000 MRR)</div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Agency Target:</span>
                <span className="font-mono text-emerald-400 font-bold">$20,000 / month</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Primary Stripe Starter ($500/mo):</span>
                <span className="font-mono text-slate-300 truncate max-w-[240px]">
                  {state.agencySettings.stripeStarterLink || 'Configured in Settings'}
                </span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
