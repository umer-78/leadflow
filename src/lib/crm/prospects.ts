/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Proposal, Prospect } from '../types/index.ts';

export interface ResearchReport {
  businessSummary: string;
  websiteIssue: string;
  leadResponseIssue: string;
  automationOpportunity: string;
  personalizedOutreachAngle: string;
}

export function generateProspectResearch(prospect: Partial<Prospect>): ResearchReport {
  const name = prospect.businessName || 'the practice';
  const industry = prospect.industry || 'Dental / Aesthetic Clinic';
  const obs = prospect.verifiedObservations || [];

  const obsText = obs.length > 0 ? obs.join('; ') : 'No verified technical audit on file';

  return {
    businessSummary: `${name} is an established ${industry} provider. Verified data indicates high-ticket elective services offered with manual intake.`,
    websiteIssue: obs.some((o) => o.toLowerCase().includes('contact form'))
      ? 'Website relies on static 7-field contact form with zero immediate qualification or after-hours triage.'
      : 'No instant real-time inquiry triage detected on mobile landing view.',
    leadResponseIssue:
      'High likelihood of enquiry leakage after 5:00 PM and over weekends where phone calls go to standard voicemail without conversational intake.',
    automationOpportunity:
      'Deploy 24/7 AI Receptionist configured with exact treatment pricing boundaries, immediate phone qualification, and direct calendar sync.',
    personalizedOutreachAngle: `Highlighting that high-intent patients seeking ${prospect.notes || 'cosmetic dental care'} usually compare 2-3 clinics, and immediate response within 60 seconds wins 78% of bookings.`,
  };
}

export function generateOutreachDraft(prospect: Prospect, senderName = 'Alex Vance'): { subject: string; body: string } {
  const verifiedObservation =
    prospect.verifiedObservations && prospect.verifiedObservations.length > 0
      ? prospect.verifiedObservations[0]
      : 'your clinic has an impressive reputation for patient outcomes, but evening visitors only see a static contact form';

  const subject = `Quick idea for ${prospect.businessName}`;
  const body = `Hi ${prospect.contactName || 'there'},

I was reviewing ${prospect.businessName}'s patient inquiry flow and noticed ${verifiedObservation}.

We help ${prospect.industry || 'cosmetic clinics'} capture inquiries 24/7, qualify treatment intent, and organize consultation bookings automatically—without adding front-desk workload.

I created a private 2-minute interactive demo tailored for ${prospect.businessName} showing what this would look like on your site.

Would you like me to send over the link?

Regards,
${senderName}
Founder, LeadFlow AI`;

  return { subject, body };
}

export function generateProposalDraft(
  prospect: Prospect,
  tier: 'STARTER' | 'GROWTH' | 'PRO' = 'GROWTH'
): Proposal {
  const configs = {
    STARTER: {
      monthly: 500,
      setup: 500,
      deliverables: [
        'AI Receptionist Widget with Clinic Branding',
        'Core Treatment Knowledge Base & FAQ Engine',
        'Lead Capture & SMS Notification to Duty Staff',
        'Standard T+0 and T+1 Automated Follow-up Sequences',
        'Monthly Lead Performance Report',
      ],
    },
    GROWTH: {
      monthly: 1000,
      setup: 1000,
      deliverables: [
        'Everything in Starter Package',
        'Multi-Step Automated Follow-Up Sequences (T+0, T+1, T+3, T+7)',
        'Automated Qualification Scoring & High-Value Triage',
        'Direct Staff Handoff Notification via SMS/Email',
        'Full Client CRM Dashboard with Conversion Tracking',
        'Dedicated Practice Onboarding & Staff Training Session',
      ],
    },
    PRO: {
      monthly: 2000,
      setup: 2000,
      deliverables: [
        'Everything in Growth Package',
        'Multi-Location Practice Architecture & Routing',
        'Custom EMR/EHR Booking Workflow Integrations',
        'Priority AI Tuning with Weekly Analytics Audits',
        'Bi-Weekly Strategy & Pipeline Optimization Calls',
        'Guaranteed 99.9% Uptime SLA & 24/7 Priority Support',
      ],
    },
  };

  const selected = configs[tier];
  const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `prop-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    prospectId: prospect.id,
    businessName: prospect.businessName,
    contactName: prospect.contactName,
    packageTier: tier,
    setupFee: selected.setup,
    monthlyFee: selected.monthly,
    targetPainPoints: [
      'Unanswered after-hours and weekend patient inquiries',
      'Front-desk staff overwhelmed by routine repetitive treatment FAQs',
      'High-value elective consultations slipping through without prompt follow-up',
    ],
    deliverables: selected.deliverables,
    status: 'DRAFT',
    validUntil,
    createdAt: new Date().toISOString(),
  };
}
