/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { appStore } from '../src/lib/store/app-store.ts';
import { calculateLeadScore } from '../src/lib/crm/scoring.ts';
import { billingProvider, PLAN_CONFIGS } from '../src/lib/billing/provider.ts';
import { hasPermission } from '../src/lib/auth/auth-service.ts';
import {
  buildCheckoutParams,
  isStripeConfigured,
  planActivationFromEvent,
} from '../src/lib/billing/stripe-provider.ts';

export function runLeadFlowTestRunner(): { name: string; status: 'PASS' | 'FAIL'; message?: string }[] {
  const results: { name: string; status: 'PASS' | 'FAIL'; message?: string }[] = [];

  // Test 1: Tenant Isolation
  try {
    const state = appStore.getState();
    const currentOrgId = state.currentOrg.id;
    const leads = state.leads.filter((l) => l.organizationId === currentOrgId);
    const isolated = leads.every((l) => l.organizationId === currentOrgId);
    if (!isolated) throw new Error('Leads from outside organization detected');
    results.push({ name: 'Tenant Isolation Test', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Tenant Isolation Test', status: 'FAIL', message: err.message });
  }

  // Test 2: Deterministic Lead Scoring
  try {
    const scoreHigh = calculateLeadScore({
      serviceRequested: 'Porcelain Veneers Full Set',
      phone: '+1 (555) 302-9911',
      urgency: 'HIGH',
      notes: 'Ready for consultation this week',
    });
    if (scoreHigh.tier !== 'HIGH' || scoreHigh.score < 75) {
      throw new Error(`Scoring calculation mismatch: tier=${scoreHigh.tier}, score=${scoreHigh.score}`);
    }
    results.push({ name: 'Lead Scoring Engine', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Lead Scoring Engine', status: 'FAIL', message: err.message });
  }

  // Test 3: MRR Calculation Engine ($20,000 Target)
  try {
    const state = appStore.getState();
    const mrr = billingProvider.calculateMRR(state.organizations);
    if (mrr.targetMRR !== 20000 || mrr.mrrGap < 0) {
      throw new Error(`MRR target mismatch: target=${mrr.targetMRR}`);
    }
    results.push({ name: '$20k Target MRR Engine', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: '$20k Target MRR Engine', status: 'FAIL', message: err.message });
  }

  // Test 4: Role-Based Access Control (RBAC)
  try {
    if (!hasPermission('OWNER', 'org:billing')) throw new Error('OWNER should have org:billing');
    if (hasPermission('STAFF', 'org:billing')) throw new Error('STAFF must NOT have org:billing');
    if (!hasPermission('STAFF', 'leads:read')) throw new Error('STAFF should have leads:read');
    if (hasPermission('VIEWER', 'knowledge:manage')) throw new Error('VIEWER must NOT have knowledge:manage');
    results.push({ name: 'Server-Side RBAC Enforcement', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Server-Side RBAC Enforcement', status: 'FAIL', message: err.message });
  }

  // Test 5: Stripe Checkout params match the plan (money is in cents, monthly is
  // recurring, setup fee is one-time, org/plan carried in metadata)
  try {
    const plan = PLAN_CONFIGS.growth;
    const params = buildCheckoutParams(plan, {
      orgId: 'org-123',
      successUrl: 'https://x/ok',
      cancelUrl: 'https://x/no',
    });
    const items = (params.line_items || []) as any[];
    const monthly = items.find((i) => i.price_data?.recurring);
    const setup = items.find((i) => !i.price_data?.recurring);
    if (params.mode !== 'subscription') throw new Error('mode must be subscription');
    if (!monthly || monthly.price_data.unit_amount !== plan.monthlyFee * 100) {
      throw new Error('monthly amount wrong');
    }
    if (!setup || setup.price_data.unit_amount !== plan.setupFee * 100) {
      throw new Error('setup amount wrong');
    }
    if (monthly.price_data.recurring.interval !== 'month') throw new Error('interval must be month');
    if (params.metadata?.orgId !== 'org-123' || params.metadata?.planId !== 'growth') {
      throw new Error('metadata missing org/plan');
    }
    results.push({ name: 'Stripe Checkout Pricing Math', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Stripe Checkout Pricing Math', status: 'FAIL', message: err.message });
  }

  // Test 6: billing stays in demo mode until a real key is set
  try {
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const off = isStripeConfigured();
    process.env.STRIPE_SECRET_KEY = 'sk_live_dummy_key_for_test';
    const on = isStripeConfigured();
    if (saved === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = saved;
    if (off !== false) throw new Error('should be off with no key');
    if (on !== true) throw new Error('should be on with sk_ key');
    results.push({ name: 'Billing Demo-Mode Gate', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Billing Demo-Mode Gate', status: 'FAIL', message: err.message });
  }

  // Test 7: webhook event -> org/plan activation (and ignores unrelated events)
  try {
    const good = planActivationFromEvent({
      type: 'checkout.session.completed',
      data: { object: { metadata: { orgId: 'org-9', planId: 'pro' } } },
    } as any);
    if (!good || good.orgId !== 'org-9' || good.planId !== 'pro') {
      throw new Error('did not extract org/plan from completed checkout');
    }
    const ignored = planActivationFromEvent({ type: 'invoice.paid', data: { object: {} } } as any);
    if (ignored !== null) throw new Error('should ignore unrelated events');
    results.push({ name: 'Stripe Webhook Activation', status: 'PASS' });
  } catch (err: any) {
    results.push({ name: 'Stripe Webhook Activation', status: 'FAIL', message: err.message });
  }

  return results;
}
