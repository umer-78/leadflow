/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CheckCircle,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { PLAN_CONFIGS } from '../../lib/billing/provider.ts';
import { appStore } from '../../lib/store/app-store.ts';
import { AIReceptionistWidget } from '../widget/AIReceptionistWidget.tsx';

interface MarketingViewProps {
  onOpenWidget: () => void;
  onOpenDashboard: () => void;
  onOpenOnboarding: () => void;
}

export function MarketingView({ onOpenWidget, onOpenDashboard, onOpenOnboarding }: MarketingViewProps) {
  const state = appStore.getState();
  const agencySettings = state.agencySettings;

  // ROI Calculator State
  const [monthlyInquiries, setMonthlyInquiries] = useState<number>(120);
  const [avgPatientValue, setAvgPatientValue] = useState<number>(3200);
  const [currentConversion, setCurrentConversion] = useState<number>(12); // 12%
  const [estimatedRecovery, setEstimatedRecovery] = useState<number>(20); // +20% faster response lift

  // Honest illustrative math
  const currentPatients = Math.round(monthlyInquiries * (currentConversion / 100));
  const currentRevenue = currentPatients * avgPatientValue;

  const afterHoursMissedInquiries = Math.round(monthlyInquiries * 0.45); // ~45% inquiries occur outside 9-5
  const recoveredPatients = Math.round(afterHoursMissedInquiries * (estimatedRecovery / 100));
  const estimatedIncrementalRevenue = recoveredPatients * avgPatientValue;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-sky-400 font-medium mb-4">
            <span>Specialized Autonomous Intake</span>
            <span aria-hidden="true">·</span>
            <span>Cosmetic Dental & Medical Practices</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Turn after-hours patient inquiries into booked consultations —{' '}
            <span className="text-sky-400">24/7.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Instant conversational triage, clinical procedure qualification, automated multi-day follow-ups,
            and direct appointment scheduling for high-ticket service clinics.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenOnboarding}
              className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <span>Launch Intake for Your Practice</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>

            <button
              onClick={onOpenDashboard}
              className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>View Practice Portal</span>
            </button>
          </div>

          {/* Operational Guarantees */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero medical diagnosis liability</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>Strict practice data isolation</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Sub-5 second conversational response</span>
            </div>
          </div>

          {/* Live Interactive AI Receptionist Widget */}
          <div className="mt-12 max-w-2xl mx-auto text-left bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Live AI Intake Simulator</span>
              </div>
              <span className="text-[11px] text-sky-400 font-medium">Try asking about veneer prices or appointments!</span>
            </div>
            <AIReceptionistWidget isEmbedded={true} />
          </div>
        </div>
      </section>

      {/* The Operational Problem */}
      <section className="py-20 border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              The Front-Desk Bottleneck
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Why high-ticket elective practices lose qualified patients every week
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-xl">
              <div className="text-xs text-rose-400 font-mono mb-2">PROBLEM 01</div>
              <h4 className="text-base font-semibold text-white mb-2">
                After-Hours Inquiry Leakage
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Over 58% of cosmetic dentistry, veneer, and aligner inquiries arrive between 6:00 PM
                and 8:00 AM or over weekends when staff are off-duty. Visitors encounter a static contact
                form and immediately bounce to local competitors.
              </p>
            </div>

            <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-xl">
              <div className="text-xs text-rose-400 font-mono mb-2">PROBLEM 02</div>
              <h4 className="text-base font-semibold text-white mb-2">
                Zero Qualification Triage
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Front desk staff waste hours responding to basic price shoppers and insurance inquiries
                manually while high-ticket $8,000+ cosmetic case inquiries sit in the unread inbox queue.
              </p>
            </div>

            <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-xl">
              <div className="text-xs text-rose-400 font-mono mb-2">PROBLEM 03</div>
              <h4 className="text-base font-semibold text-white mb-2">
                Forgotten Follow-Ups
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                80% of elective healthcare consultations require 3 to 5 touchpoints to confirm.
                Busy practice receptionists rarely have time to execute disciplined 24h, 72h, and 7-day
                re-engagement cadences.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section className="py-20 border-b border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              Financial Impact Model
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Calculate Potential Practice Revenue Recovery
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Illustrative financial projection based on capturing and qualifying after-hours inquiries.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Sliders */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-slate-300">Monthly Website Inquiries</span>
                    <span className="text-sky-400 font-bold font-mono">{monthlyInquiries} inquiries</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={monthlyInquiries}
                    onChange={(e) => setMonthlyInquiries(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>30/mo (Boutique)</span>
                    <span>500/mo (Multi-Op)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-slate-300">Average Case / Procedure Value</span>
                    <span className="text-emerald-400 font-bold font-mono">${avgPatientValue.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="15000"
                    step="250"
                    value={avgPatientValue}
                    onChange={(e) => setAvgPatientValue(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>$1,000 (Whitening/Cleaning)</span>
                    <span>$15,000 (Full-Mouth/Surgery)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-2">
                    <span className="text-slate-300">Current Consultation Conversion</span>
                    <span className="text-slate-300 font-bold font-mono">{currentConversion}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={currentConversion}
                    onChange={(e) => setCurrentConversion(Number(e.target.value))}
                    className="w-full accent-sky-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Calculated Outputs */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="pb-3 border-b border-slate-800">
                  <div className="text-xs text-slate-400">Estimated Unhandled After-Hours Volume</div>
                  <div className="text-xl font-bold text-white font-mono mt-0.5">
                    ~{afterHoursMissedInquiries} patient inquiries / month
                  </div>
                </div>

                <div className="pb-3 border-b border-slate-800">
                  <div className="text-xs text-slate-400">Projected Recovered Case Starts</div>
                  <div className="text-xl font-bold text-sky-400 font-mono mt-0.5">
                    +{recoveredPatients} confirmed patients / month
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Estimated Incremental Monthly Value</div>
                  <div className="text-3xl font-bold text-emerald-400 font-mono mt-1">
                    +${estimatedIncrementalRevenue.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 font-sans ml-1">/ month</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section className="py-20 border-b border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              Transparent Practice Pricing
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Flat monthly software & automation service
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              No variable usage penalties. Flat monthly retainer with custom practice knowledge base.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Starter */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-semibold text-white">{PLAN_CONFIGS.starter.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{PLAN_CONFIGS.starter.description}</p>
                <div className="mt-4 pb-4 border-b border-slate-800">
                  <div className="text-3xl font-bold text-white font-mono">${PLAN_CONFIGS.starter.monthlyFee}</div>
                  <div className="text-xs text-slate-400">per month + ${PLAN_CONFIGS.starter.setupFee} setup</div>
                </div>
                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  {PLAN_CONFIGS.starter.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 mt-6">
                {agencySettings.stripeStarterLink ? (
                  <a
                    href={agencySettings.stripeStarterLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay with Stripe Checkout</span>
                  </a>
                ) : (
                  <button
                    onClick={onOpenOnboarding}
                    className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                  >
                    Configure Starter Plan
                  </button>
                )}
              </div>
            </div>

            {/* Growth (Recommended) */}
            <div className="bg-slate-900 border-2 border-sky-500/80 rounded-xl p-6 flex flex-col justify-between shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-sky-500 text-slate-950 font-semibold text-[10px] uppercase tracking-wider rounded-full">
                Most Popular for Single Clinics
              </div>
              <div>
                <h4 className="text-base font-semibold text-white">{PLAN_CONFIGS.growth.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{PLAN_CONFIGS.growth.description}</p>
                <div className="mt-4 pb-4 border-b border-slate-800">
                  <div className="text-3xl font-bold text-white font-mono">${PLAN_CONFIGS.growth.monthlyFee}</div>
                  <div className="text-xs text-slate-400">per month + ${PLAN_CONFIGS.growth.setupFee} setup</div>
                </div>
                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  {PLAN_CONFIGS.growth.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 mt-6">
                {agencySettings.stripeGrowthLink ? (
                  <a
                    href={agencySettings.stripeGrowthLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay with Stripe Checkout</span>
                  </a>
                ) : (
                  <button
                    onClick={onOpenOnboarding}
                    className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                  >
                    Select Growth Plan
                  </button>
                )}
              </div>
            </div>

            {/* Pro */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-semibold text-white">{PLAN_CONFIGS.pro.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{PLAN_CONFIGS.pro.description}</p>
                <div className="mt-4 pb-4 border-b border-slate-800">
                  <div className="text-3xl font-bold text-white font-mono">${PLAN_CONFIGS.pro.monthlyFee}</div>
                  <div className="text-xs text-slate-400">per month + ${PLAN_CONFIGS.pro.setupFee} setup</div>
                </div>
                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  {PLAN_CONFIGS.pro.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 mt-6">
                {agencySettings.stripeProLink ? (
                  <a
                    href={agencySettings.stripeProLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pay with Stripe Checkout</span>
                  </a>
                ) : (
                  <button
                    onClick={onOpenOnboarding}
                    className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                  >
                    Configure Pro Plan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              Frequently Asked Questions
            </h2>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Safety, clinical accuracy, and installation
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-sm font-semibold text-white">
                Does the AI provide medical or dental diagnoses?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Never. The system is strictly bound to your custom practice knowledge base. It answers procedure questions, explains timeline and financing options, and gathers patient contact preferences for clinical consultation.
              </p>
            </div>

            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-sm font-semibold text-white">
                How difficult is installation on our existing practice website?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                It takes 2 minutes. You simply copy a single lightweight JavaScript snippet from your client portal and paste it into WordPress, Webflow, Squarespace, or custom code.
              </p>
            </div>

            <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-sm font-semibold text-white">
                Can our front desk staff take over live conversations?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yes. Whenever a patient requests complex medical guidance or a high-value surgical quote, the AI immediately flags the inquiry for human staff handoff and notifies your practice via email or portal alert.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-900 text-xs text-slate-500 text-center">
        <div className="max-w-5xl mx-auto px-4">
          <p>© {new Date().getFullYear()} {agencySettings.agencyName || 'LeadFlow AI'}. All rights reserved.</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Dedicated Autonomous Lead Capture & Intake Infrastructure for Elective Healthcare Practices.
          </p>
        </div>
      </footer>
    </div>
  );
}
