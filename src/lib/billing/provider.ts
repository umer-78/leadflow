/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Organization } from '../types/index.ts';

export interface PlanConfig {
  id: 'starter' | 'growth' | 'pro';
  name: string;
  monthlyFee: number;
  setupFee: number;
  description: string;
  features: string[];
}

export const PLAN_CONFIGS: Record<'starter' | 'growth' | 'pro', PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter Tier',
    monthlyFee: 500,
    setupFee: 500,
    description: 'Essential 24/7 AI lead capture and instant notification for boutique practices.',
    features: [
      '24/7 AI Receptionist Web Widget',
      'Knowledge Base (up to 15 procedures & FAQs)',
      'Instant SMS & Email Lead Notifications',
      'T+0 and T+1 Automated Follow-up Sequences',
      'Basic Client Lead Dashboard',
      'Single Location Support',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth Tier',
    monthlyFee: 1000,
    setupFee: 1000,
    description: 'Complete autonomous lead qualification, scoring, and multi-day booking sequences.',
    features: [
      'Everything in Starter',
      'Full 4-Step Follow-Up Sequence (T+0, T+1, T+3, T+7)',
      'Automated High-Value Lead Scoring & Triage',
      'Real-Time Human Staff Handoff Triggers',
      'Unlimited Knowledge Base Documents & FAQs',
      'Appointment Request Queue & Calendar Sync',
      'Dedicated Onboarding & Clinic Configuration Call',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Tier',
    monthlyFee: 2000,
    setupFee: 2000,
    description: 'Custom multi-provider practice automation with SLA and weekly pipeline audits.',
    features: [
      'Everything in Growth',
      'Multi-Location Practice Routing & Staff Rosters',
      'Custom Electronic Health Record (EHR) Webhook Integrations',
      'Weekly AI Performance & Conversation Quality Audits',
      'Bi-Weekly Revenue Strategy & Conversion Review',
      'Guaranteed 99.9% Uptime SLA & Priority 1-Hour Support',
    ],
  },
};

export interface MRRMetrics {
  targetMRR: number;
  currentMRR: number;
  mrrGap: number;
  activeClientsCount: number;
  averageClientMRR: number;
  clientsNeededForTarget: number;
  tierBreakdown: {
    starter: number;
    growth: number;
    pro: number;
  };
}

export class MockBillingProvider {
  name = 'Mock Billing (Local $0 Capital Engine)';

  calculateMRR(organizations: Organization[]): MRRMetrics {
    const targetMRR = 20000;
    const activeOrgs = organizations.filter(
      (o) => o.status === 'ACTIVE' && o.id !== 'org-agency-root'
    );

    const currentMRR = activeOrgs.reduce((sum, org) => sum + (org.monthlyFee || 0), 0);
    const activeClientsCount = activeOrgs.length;
    const averageClientMRR = activeClientsCount > 0 ? Math.round(currentMRR / activeClientsCount) : 1000;
    const mrrGap = Math.max(0, targetMRR - currentMRR);
    const clientsNeededForTarget = averageClientMRR > 0 ? Math.ceil(mrrGap / averageClientMRR) : 0;

    const tierBreakdown = {
      starter: activeOrgs.filter((o) => o.planId === 'starter').length,
      growth: activeOrgs.filter((o) => o.planId === 'growth').length,
      pro: activeOrgs.filter((o) => o.planId === 'pro').length,
    };

    return {
      targetMRR,
      currentMRR,
      mrrGap,
      activeClientsCount,
      averageClientMRR,
      clientsNeededForTarget,
      tierBreakdown,
    };
  }
}

export const billingProvider = new MockBillingProvider();
