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

interface MarketingViewProps {
  onOpenWidget: () => void;
  onOpenDashboard: () => void;
  onOpenOnboarding: () => void;
}

export function MarketingView({ onOpenWidget, onOpenDashboard, onOpenOnboarding }: MarketingViewProps) {
  // ROI Calculator State (Rule 31)
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
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-sky-400 font-medium mb-4">
            <span>Specialized Autonomous Infrastructure</span>
            <span aria-hidden="true">·</span>
            <span>Dental & Cosmetic Clinics</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Turn missed enquiries into organized opportunities —{' '}
            <span className="text-sky-400">automatically.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            AI receptionist, high-value procedure qualification, multi-day follow-ups, and consultation
            scheduling engineered for high-ticket service practices.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenWidget}
              className="w-full sm:w-auto px-6 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4" />
              <span>See the Live AI Demo</span>
            </button>

            <button
              onClick={onOpenDashboard}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>Explore Client Dashboard</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Operational Guarantees */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero medical diagnosis liability</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>Strict tenant knowledge isolation</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Sub-45 second lead response</span>
            </div>
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
                Inconsistent Follow-up Cadence
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Busy clinical practices rarely execute a disciplined 4-step follow-up cadence (T+0, T+1,
                T+3, T+7). Inquiries that could have converted are forgotten after a single unanswered
                call.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Complete Solution System */}
      <section className="py-20 border-b border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              The LeadFlow System
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              An autonomous intake machine working alongside your staff
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white mb-1">
                  24/7 Precision AI Receptionist
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Trained exclusively on your practice’s validated treatment guidelines, financing terms,
                  hours, and procedures. Never hallucinates pricing and strictly adheres to clinical
                  guardrails.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white mb-1">
                  Explainable Lead Scoring & Triage
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Evaluates treatment value, phone provision, and urgency into HIGH, MEDIUM, and LOW
                  intent tiers with transparent point explanations for your treatment coordinator.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white mb-1">
                  Automated Multi-Day Follow-Up Sequences
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Executes structured follow-ups at T+0, T+1, T+3, and T+7. Automatically halts the instant
                  a patient replies, schedules a consultation, or requests opt-out.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-sky-950/80 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white mb-1">
                  Frictionless Appointment Workflow
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Collects patient scheduling preferences, logs consultation queues, and alerts staff via
                  SMS and dashboard notifications for instant confirmation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive ROI Calculator (Rule 31) */}
      <section className="py-20 border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              Practice ROI Modeler
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Calculate your practice’s estimated recovered opportunity
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Illustrative estimate based on typical high-ticket cosmetic clinic metrics — not a financial guarantee.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Sliders */}
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-300">Monthly Practice Inquiries</span>
                    <span className="text-sky-400 font-semibold">{monthlyInquiries} leads</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="400"
                    step="10"
                    value={monthlyInquiries}
                    onChange={(e) => setMonthlyInquiries(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>30/mo (Boutique)</span>
                    <span>400/mo (High Volume)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-300">Average Case / Patient Value</span>
                    <span className="text-sky-400 font-semibold">${avgPatientValue.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="800"
                    max="10000"
                    step="200"
                    value={avgPatientValue}
                    onChange={(e) => setAvgPatientValue(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>$800 (General)</span>
                    <span>$10,000 (Full-Arch/Surgical)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-300">Current Consultation Conversion</span>
                    <span className="text-sky-400 font-semibold">{currentConversion}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={currentConversion}
                    onChange={(e) => setCurrentConversion(Number(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Calculated Outputs */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Estimated Recovered Value
                  </span>
                  <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    +${estimatedIncrementalRevenue.toLocaleString()}
                    <span className="text-xs text-slate-400 font-normal ml-1">/ month</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    By providing sub-60s after-hours intake for approximately{' '}
                    <strong className="text-slate-200">{afterHoursMissedInquiries} evening inquiries</strong>,
                    your practice recovers an estimated{' '}
                    <strong className="text-sky-400">+{recoveredPatients} booked consultations</strong> per month.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Est. Annual Opportunity</span>
                    <span className="font-semibold text-emerald-400">
                      +${(estimatedIncrementalRevenue * 12).toLocaleString()} / year
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Target Growth Tier Fee</span>
                    <span className="text-slate-300">$1,000 / month</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-500 italic">
                * Note: Model demonstrates mathematical effect of immediate after-hours response on typical elective consultation inquiry pools. Individual practice conversion depends on local market pricing and clinical reputation.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (Rule 27) */}
      <section className="py-20 border-b border-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              Transparent Practice Pricing
            </h2>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Predictable monthly software & automation service
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              No hidden API surcharges. Flat monthly fee with dedicated practice configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Starter */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-semibold text-white">{PLAN_CONFIGS.starter.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{PLAN_CONFIGS.starter.description}</p>
                <div className="mt-4 pb-4 border-b border-slate-800">
                  <div className="text-3xl font-bold text-white">${PLAN_CONFIGS.starter.monthlyFee}</div>
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
              <button
                onClick={onOpenOnboarding}
                className="w-full mt-6 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                Select Starter Plan
              </button>
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
                  <div className="text-3xl font-bold text-white">${PLAN_CONFIGS.growth.monthlyFee}</div>
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
              <button
                onClick={onOpenOnboarding}
                className="w-full mt-6 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
              >
                Select Growth Plan
              </button>
            </div>

            {/* Pro */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-semibold text-white">{PLAN_CONFIGS.pro.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{PLAN_CONFIGS.pro.description}</p>
                <div className="mt-4 pb-4 border-b border-slate-800">
                  <div className="text-3xl font-bold text-white">${PLAN_CONFIGS.pro.monthlyFee}</div>
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
              <button
                onClick={onOpenOnboarding}
                className="w-full mt-6 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
              >
                Select Pro Plan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs uppercase font-semibold text-sky-400 tracking-wider mb-2">
              Questions & Clinical Guardrails
            </h2>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
              <h4 className="text-sm font-semibold text-white mb-1">
                Does the AI provide medical diagnoses or quote arbitrary fees?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strictly no. The AI is bounded entirely by your practice’s pre-approved knowledge base.
                If a patient asks for a clinical diagnosis or medical evaluation, it politely explains that
                only a licensed practitioner can assess them in person, and offers to schedule an in-clinic
                consultation.
              </p>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
              <h4 className="text-sm font-semibold text-white mb-1">
                How does the AI hand off urgent inquiries to my human staff?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a visitor requests human assistance or reports an acute clinical situation, the
                conversation is flagged with priority status, and an instant SMS and dashboard alert is
                dispatched to your designated front-desk coordinator.
              </p>
            </div>

            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
              <h4 className="text-sm font-semibold text-white mb-1">
                How difficult is installation on our current practice website?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Installation takes less than two minutes. We provide a single lightweight JavaScript tag
                that your webmaster pastes before the closing &lt;/body&gt; tag on WordPress, Squarespace,
                Wix, or Webflow.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
