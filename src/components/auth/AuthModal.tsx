/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Building2, Lock, ShieldCheck, Stethoscope, UserPlus } from 'lucide-react';
import { appStore } from '../../lib/store/app-store.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'CLIENT_LOGIN' | 'OWNER_LOGIN' | 'REGISTER' | 'RESET';
}

export function AuthModal({ isOpen, onClose, initialMode = 'CLIENT_LOGIN' }: AuthModalProps) {
  const [mode, setMode] = useState<'CLIENT_LOGIN' | 'OWNER_LOGIN' | 'REGISTER' | 'RESET'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [industry, setIndustry] = useState('Dental / Cosmetic Dentistry');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'CLIENT_LOGIN') {
        appStore.login(email, password);
        onClose();
      } else if (mode === 'OWNER_LOGIN') {
        const targetEmail = email.trim() || 'umerhashmi987@gmail.com';
        appStore.login(targetEmail, password);
        onClose();
      } else if (mode === 'REGISTER') {
        if (!name || !email || !password || !clinicName) {
          setError('Please fill in all required fields.');
          return;
        }
        appStore.registerUser({
          name,
          email,
          plainPassword: password,
          orgName: clinicName,
          industry,
        });
        setSuccess('Practice workspace registered successfully! Logged in as Practice Owner.');
        setTimeout(() => onClose(), 800);
      } else if (mode === 'RESET') {
        const token = appStore.requestPasswordReset(email);
        setSuccess(`Password reset instructions generated for ${email}. Token: ${token}`);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col text-slate-100 shadow-2xl relative overflow-hidden">
        {/* Header with Mode Tabs */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-white">
              {mode === 'CLIENT_LOGIN' && 'Clinic Doctor & Staff Portal'}
              {mode === 'OWNER_LOGIN' && 'Agency Founder Gateway'}
              {mode === 'REGISTER' && 'Register New Practice'}
              {mode === 'RESET' && 'Reset Access Password'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mode === 'CLIENT_LOGIN' && 'Access your private practice patient queue and intake'}
              {mode === 'OWNER_LOGIN' && 'Agency back-office, Stripe links, and acquisition engine'}
              {mode === 'REGISTER' && 'Set up 24/7 patient intake for your clinic'}
              {mode === 'RESET' && 'Enter your practice email to receive a recovery token'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">

        {/* Quick Portal Switcher Tabs */}
        {(mode === 'CLIENT_LOGIN' || mode === 'OWNER_LOGIN') && (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800 mb-4">
            <button
              type="button"
              onClick={() => {
                setMode('CLIENT_LOGIN');
                setEmail('');
                setPassword('');
                setError(null);
              }}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'CLIENT_LOGIN'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Practice Doctor</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('OWNER_LOGIN');
                setEmail('umerhashmi987@gmail.com');
                setPassword('');
                setError(null);
              }}
              className={`py-1.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'OWNER_LOGIN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Agency Founder</span>
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg text-xs text-emerald-300">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'REGISTER' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Doctor / Manager Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Alexander Wright"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Practice / Clinic Name</label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Wright Cosmetic & Implant Clinic"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Practice Niche</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Dental / Cosmetic Dentistry">Dental & Cosmetic Dentistry</option>
                  <option value="Facial Plastic Surgery">Facial Plastic Surgery</option>
                  <option value="Medical Spa & Aesthetics">Medical Spa & Aesthetics</option>
                  <option value="Orthodontics">Orthodontics & Aligners</option>
                  <option value="Specialty Healthcare Clinic">Other Specialty Clinic</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'OWNER_LOGIN' ? 'umerhashmi987@gmail.com' : 'doctor@practice.com'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          {mode !== 'RESET' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                {mode === 'CLIENT_LOGIN' && (
                  <button
                    type="button"
                    onClick={() => setMode('RESET')}
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-2.5 px-4 font-semibold text-xs rounded-lg transition-colors shadow-sm mt-2 text-white ${
              mode === 'OWNER_LOGIN'
                ? 'bg-indigo-600 hover:bg-indigo-500'
                : 'bg-sky-600 hover:bg-sky-500'
            }`}
          >
            {mode === 'CLIENT_LOGIN' && 'Sign In to Practice Portal'}
            {mode === 'OWNER_LOGIN' && 'Unlock Agency Command'}
            {mode === 'REGISTER' && 'Create Practice Account'}
            {mode === 'RESET' && 'Generate Reset Token'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
          {mode === 'REGISTER' ? (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => setMode('CLIENT_LOGIN')}
                className="text-sky-400 hover:text-sky-300 font-medium ml-1"
              >
                Sign in here
              </button>
            </p>
          ) : (
            <p>
              New clinic practice?{' '}
              <button
                onClick={() => setMode('REGISTER')}
                className="text-sky-400 hover:text-sky-300 font-medium ml-1"
              >
                Register your clinic
              </button>
            </p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
