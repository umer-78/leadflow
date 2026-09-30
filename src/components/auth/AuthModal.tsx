/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { appStore } from '../../lib/store/app-store.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'RESET';
}

export function AuthModal({ isOpen, onClose, initialMode = 'LOGIN' }: AuthModalProps) {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'RESET'>(initialMode);
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
      if (mode === 'LOGIN') {
        appStore.login(email, password);
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
        setSuccess('Account created successfully! You are logged in as practice Owner.');
        setTimeout(() => onClose(), 800);
      } else if (mode === 'RESET') {
        const token = appStore.requestPasswordReset(email);
        setSuccess(`Reset link simulated! In production an email is sent. Token: ${token}`);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {mode === 'LOGIN' && 'Sign In to LeadFlow AI'}
              {mode === 'REGISTER' && 'Create Practice Account'}
              {mode === 'RESET' && 'Reset Your Password'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mode === 'LOGIN' && 'Access your clinic dashboard and lead pipeline'}
              {mode === 'REGISTER' && 'Setup 24/7 autonomous lead intake for your practice'}
              {mode === 'RESET' && 'Enter your verified email address'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            ✕
          </button>
        </div>

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
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Alexander Wright"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinic / Practice Name</label>
                <input
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Wright Cosmetic & Implant Clinic"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Practice Niche</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Dental / Cosmetic Dentistry">Dental & Cosmetic Dentistry</option>
                  <option value="Facial Plastic Surgery">Facial Plastic Surgery</option>
                  <option value="Medical Spa & Aesthetics">Medical Spa & Aesthetics</option>
                  <option value="Orthodontics">Orthodontics & Aligners</option>
                  <option value="High-Ticket Specialty Clinic">Other Specialty Clinic</option>
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
              placeholder="doctor@practice.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              required
            />
          </div>

          {mode !== 'RESET' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                {mode === 'LOGIN' && (
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
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                required
              />
              {mode === 'LOGIN' && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Demo hint: any pre-seeded user password is <code className="text-slate-400">demo123</code>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-lg transition-colors shadow-sm mt-2"
          >
            {mode === 'LOGIN' && 'Sign In to Dashboard'}
            {mode === 'REGISTER' && 'Create Practice Workspace'}
            {mode === 'RESET' && 'Generate Reset Token'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
          {mode === 'LOGIN' ? (
            <p>
              Don't have a practice account?{' '}
              <button
                onClick={() => setMode('REGISTER')}
                className="text-sky-400 hover:text-sky-300 font-medium ml-1"
              >
                Register your clinic
              </button>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <button
                onClick={() => setMode('LOGIN')}
                className="text-sky-400 hover:text-sky-300 font-medium ml-1"
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
