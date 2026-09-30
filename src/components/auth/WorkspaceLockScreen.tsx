/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Crown, Key, Lock, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';

export function WorkspaceLockScreen() {
  const state = appStore.getState();
  if (!state.isWorkspaceLocked) return null;

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsProcessing(true);
    setError(null);
    try {
      const success = await appStore.unlockWorkspace(password);
      if (!success) {
        setError('Incorrect master owner password. Please try again.');
      } else {
        setPassword('');
      }
    } catch {
      setError('Authentication error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl max-w-sm w-full p-6 text-slate-100 shadow-2xl text-center space-y-4 relative">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">
            <Crown className="w-3.5 h-3.5" />
            <span>Workspace Protected</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Terminal Locked</h2>
          <p className="text-xs text-slate-400 mt-1">
            Enter master password for <strong className="text-white">Umer Hashmi</strong> to unlock patient records and agency data.
          </p>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-3 pt-1">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter owner master password..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white text-center focus:outline-none focus:border-amber-500 font-mono tracking-widest"
            autoFocus
            required
          />

          <button
            type="submit"
            disabled={isProcessing || !password}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            <span>Unlock Workspace</span>
          </button>
        </form>

        <div className="text-[10px] text-slate-500 pt-1">
          Protected with SHA-256 Row-Level Tenant Encryption
        </div>
      </div>
    </div>
  );
}
