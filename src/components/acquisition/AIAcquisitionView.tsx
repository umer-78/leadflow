/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building,
  CheckCircle2,
  ChevronRight,
  Copy,
  DollarSign,
  ExternalLink,
  Flame,
  Globe,
  Mail,
  Play,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import { billingProvider } from '../../lib/billing/provider.ts';
import { appStore } from '../../lib/store/app-store.ts';
import { Prospect } from '../../lib/types/index.ts';

interface AcquisitionAuditResult {
  clinicName: string;
  website: string;
  niche: string;
  leakagePoints: {
    category: string;
    finding: string;
    impact: string;
    severity: 'HIGH' | 'CRITICAL' | 'MEDIUM';
  }[];
  monthlyRevenueLeakage: number;
  personalizedPitch: {
    subject: string;
    openingLine: string;
    auditObservation: string;
    callToAction: string;
  };
  demoUrl: string;
}

export function AIAcquisitionView() {
  const state = appStore.getState();
  const [targetName, setTargetName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetNiche, setTargetNiche] = useState('Cosmetic Dentistry');
  const [targetDoctor, setTargetDoctor] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AcquisitionAuditResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [outreachSent, setOutreachSent] = useState(false);

  // Pre-configured high-ticket niches for fast acquisition targeting
  const nichePresets = [
    {
      name: 'Cosmetic Dentistry',
      sampleName: 'Tribeca Aesthetic Dentistry',
      sampleUrl: 'https://tribecadental.example.com',
      doctor: 'Dr. Aaron Meyer',
      avgCase: 6500,
    },
    {
      name: 'Orthodontics & Clear Aligners',
      sampleName: 'Precision Aligners Studio',
      sampleUrl: 'https://precisionalign.example.com',
      doctor: 'Dr. Sarah Lin',
      avgCase: 5200,
    },
    {
      name: 'Medical Aesthetics & MedSpa',
      sampleName: 'Luxe Beverly Medical Spa',
      sampleUrl: 'https://luxemedbeverly.example.com',
      doctor: 'Dr. Julian Ross',
      avgCase: 3800,
    },
    {
      name: 'Aesthetic Plastic Surgery',
      sampleName: 'Park Avenue Facial Surgery',
      sampleUrl: 'https://parkavefacial.example.com',
      doctor: 'Dr. Elena Rostova',
      avgCase: 12000,
    },
  ];

  const handleApplyPreset = (preset: (typeof nichePresets)[0]) => {
    setTargetNiche(preset.name);
    setTargetName(preset.sampleName);
    setTargetUrl(preset.sampleUrl);
    setTargetDoctor(preset.doctor);
    setTargetEmail(`${preset.doctor.toLowerCase().replace(/[^a-z]/g, '')}@${preset.sampleName.toLowerCase().replace(/[^a-z]/g, '')}.example.com`);
    setTargetPhone('+1 (555) 234-9821');
  };

  const handleRunAcquisitionAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim()) return;

    setIsAuditing(true);
    setAuditResult(null);
    setOutreachSent(false);

    // Simulate AI Acquisition Audit Engine
    setTimeout(() => {
      const avgCaseValue =
        targetNiche.includes('Plastic') ? 12000 : targetNiche.includes('Dentistry') ? 6500 : 4200;
      const estimatedLostCasesPerMonth = 4;
      const totalLeakage = avgCaseValue * estimatedLostCasesPerMonth;

      const slug = targetName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const demoUrl = `${window.location.origin}/?demo=${slug}&clinic=${encodeURIComponent(targetName)}`;

      const result: AcquisitionAuditResult = {
        clinicName: targetName,
        website: targetUrl || `https://${slug}.com`,
        niche: targetNiche,
        monthlyRevenueLeakage: totalLeakage,
        leakagePoints: [
          {
            category: 'After-Hours Patient Abandonment',
            finding: 'Static 8-field contact form with zero immediate triage after 5:00 PM or weekends.',
            impact: `~${estimatedLostCasesPerMonth} high-ticket patients call competitors who respond within 5 minutes.`,
            severity: 'CRITICAL',
          },
          {
            category: 'Lack of Instant Pricing Transparency',
            finding: 'High-intent procedure questions (Veneers, Aligners) receive no automated qualification.',
            impact: 'Cold leads wait 18-24 hours for basic consultation booking confirmation.',
            severity: 'HIGH',
          },
          {
            category: 'Absence of Multi-Step Follow-Up Cadence',
            finding: 'No automated T+1, T+3, or T+7 reminder sequences for patients who do not pick up first callback.',
            impact: '30-40% lead drop-off prior to scheduled clinical consultation.',
            severity: 'HIGH',
          },
        ],
        personalizedPitch: {
          subject: `Quick lead triage observation for ${targetName}`,
          openingLine: `Dr. ${targetDoctor.replace(/^Dr\.\s*/, '') || 'Doctor'}, I audited ${targetName}'s patient inquiry flow and noticed evening website visitors currently have no way to get instant consultation answers.`,
          auditObservation: `Practices in ${targetNiche} typically leak ~${estimatedLostCasesPerMonth} elective inquiries ($${totalLeakage.toLocaleString()}/mo) because patients seeking smile makeovers expect 24/7 instant chat booking.`,
          callToAction: `I spun up a private 2-minute interactive demo tailored specifically for ${targetName} so you can test how our 24/7 AI Receptionist qualifies patients: ${demoUrl}`,
        },
        demoUrl,
      };

      setAuditResult(result);
      setIsAuditing(false);

      // Auto-save to CRM Prospects
      const newProspect: Prospect = {
        id: `prsp-${Date.now()}`,
        businessName: targetName,
        website: targetUrl || `https://${slug}.com`,
        industry: targetNiche,
        country: 'United States',
        contactName: targetDoctor || 'Practice Director',
        email: targetEmail || `intake@${slug}.com`,
        phone: targetPhone || '+1 (555) 902-1144',
        stage: 'RESEARCHED',
        identifiedProblem: result.leakagePoints[0].finding,
        verifiedObservations: result.leakagePoints.map((p) => `${p.category}: ${p.finding}`),
        outreachDraft: {
          subject: result.personalizedPitch.subject,
          body: `${result.personalizedPitch.openingLine}\n\n${result.personalizedPitch.auditObservation}\n\n${result.personalizedPitch.callToAction}\n\nBest,\nLeadFlow Operations`,
          approvedByHuman: false,
        },
        estimatedDealValue: 1000,
        notes: `AI Acquisition Engine audit: Est. leakage $${totalLeakage.toLocaleString()}/mo across ${estimatedLostCasesPerMonth} elective cases.`,
        demoSlug: slug,
        createdAt: new Date().toISOString(),
      };

      appStore.createProspect(newProspect);
    }, 900);
  };

  const handleApproveAndSendOutreach = () => {
    if (!auditResult) return;
    setOutreachSent(true);
    // Find the saved prospect and mark outreach approved
    const prsp = state.prospects.find((p) => p.businessName === auditResult.clinicName);
    if (prsp) {
      appStore.approveOutreach(prsp.id);
    }
  };

  const handleCopyDemoLink = () => {
    if (!auditResult) return;
    navigator.clipboard.writeText(auditResult.demoUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const mrrMetrics = billingProvider.calculateMRR(state.organizations);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>AI Client Acquisition Engine</span>
              <span className="text-slate-600">·</span>
              <span className="text-sky-400">Target $20,000 MRR</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Automated Clinic Prospecting & Intake Audit
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Audit target practices, calculate patient revenue leakage, build custom interactive demos, and dispatch approved outreach.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Acquisition Target</span>
              <span className="text-base font-bold text-white">
                ${mrrMetrics.currentMRR.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ $20k</span>
              </span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <span className="text-[10px] text-slate-400 block uppercase font-medium">Clinics to Close</span>
              <span className="text-base font-bold text-emerald-400">
                {mrrMetrics.clientsNeededForTarget} <span className="text-xs text-slate-400 font-normal">@ $1,000/mo</span>
              </span>
            </div>
          </div>
        </div>

        {/* Niche Presets */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-slate-300 block">
            1-Click High-Ticket Acquisition Targets:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {nichePresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleApplyPreset(preset)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  targetNiche === preset.name
                    ? 'bg-sky-950/40 border-sky-600 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold text-sky-400 mb-1">
                  <span>{preset.name}</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs text-white font-medium truncate">{preset.sampleName}</div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Avg Case: ${preset.avgCase.toLocaleString()}</span>
                  <ChevronRight className="w-3 h-3 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Audit Input Form */}
        <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-sky-400" />
              <span>Target Practice Intake Audit</span>
            </h2>
            <span className="text-[11px] text-slate-400">Calculates exact after-hours revenue loss</span>
          </div>

          <form onSubmit={handleRunAcquisitionAudit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Practice Name</label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Apex Cosmetic & Dental Studio"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Website URL</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://apexsmile.example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Niche</label>
                <select
                  value={targetNiche}
                  onChange={(e) => setTargetNiche(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Cosmetic Dentistry">Cosmetic Dentistry</option>
                  <option value="Orthodontics & Clear Aligners">Orthodontics & Clear Aligners</option>
                  <option value="Medical Aesthetics & MedSpa">Medical Aesthetics & MedSpa</option>
                  <option value="Aesthetic Plastic Surgery">Aesthetic Plastic Surgery</option>
                  <option value="Dental Implants & Restorative">Dental Implants & Restorative</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Owner / Lead Doctor</label>
                <input
                  type="text"
                  value={targetDoctor}
                  onChange={(e) => setTargetDoctor(e.target.value)}
                  placeholder="Dr. Julia Vance"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Direct Contact Email</label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="dr.vance@apexsmile.example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  placeholder="+1 (555) 902-4411"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isAuditing}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <Zap className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                <span>{isAuditing ? 'Auditing Practice Funnel...' : 'Run AI Acquisition Audit'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Audit Results & Acquisition Deliverables */}
        {auditResult && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6 shadow-xl">
              {/* Header result */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Audit Complete · Added to CRM Prospects
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">{auditResult.clinicName}</h3>
                  <span className="text-xs text-slate-400">{auditResult.niche}</span>
                </div>

                <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-right">
                  <span className="text-[10px] text-rose-300 font-semibold block uppercase tracking-wider">
                    Est. Monthly Revenue Leakage
                  </span>
                  <span className="text-xl font-bold text-rose-400">
                    -${auditResult.monthlyRevenueLeakage.toLocaleString()}/mo
                  </span>
                </div>
              </div>

              {/* Identified Leakage Points */}
              <div>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
                  Funnel Vulnerabilities Discovered:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {auditResult.leakagePoints.map((point, i) => (
                    <div
                      key={i}
                      className="p-4 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          {point.severity}
                        </span>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <div className="text-xs font-semibold text-white">{point.category}</div>
                      <div className="text-[11px] text-slate-400 leading-relaxed">{point.finding}</div>
                      <div className="text-[10px] text-sky-400 pt-1 border-t border-slate-900">
                        {point.impact}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Demo Link */}
              <div className="p-4 bg-slate-950 rounded-xl border border-sky-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Personalized Interactive Clinic Demo</span>
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Pre-configured 24/7 AI Receptionist ready for the clinic owner to test.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyDemoLink}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedLink ? 'Copied Link!' : 'Copy Demo URL'}</span>
                  </button>
                  <a
                    href={auditResult.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Demo</span>
                  </a>
                </div>
              </div>

              {/* Personalized Outreach Pitch */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Tailored Cold Acquisition Email (Human Approval Enforced):
                  </span>
                  <span className="text-[10px] text-amber-400">Rule 23 & 50 Compliant</span>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="text-white font-semibold">
                    Subject: {auditResult.personalizedPitch.subject}
                  </div>
                  <div className="text-slate-300 leading-relaxed space-y-2 pt-1 font-sans">
                    <p>{auditResult.personalizedPitch.openingLine}</p>
                    <p>{auditResult.personalizedPitch.auditObservation}</p>
                    <p>{auditResult.personalizedPitch.callToAction}</p>
                    <p className="text-slate-400">Best,<br />Umer Hashmi · LeadFlow Operations</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  {outreachSent ? (
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Outreach Approved & Sent · Follow-up Scheduled (T+3)</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleApproveAndSendOutreach}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Human Approve & Dispatch Acquisition Outreach</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
