/**
 * Subscription plans and Stripe Checkout helpers. Pure functions; network
 * calls live in the billing routes. Billing stays off until a Stripe key is set.
 */
import type Stripe from 'stripe';

export type PlanId = 'starter' | 'growth' | 'pro';

export interface PlanConfig {
  id: PlanId;
  name: string;
  monthlyFee: number;
  setupFee: number;
  description: string;
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyFee: 500,
    setupFee: 500,
    description: '24/7 website assistant with lead capture and instant alerts.',
    features: ['Website chat assistant', 'Knowledge base', 'Lead capture & scoring', 'Email alerts for new leads', 'Single location'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyFee: 1000,
    setupFee: 1000,
    description: 'Everything in Starter plus booking and automated follow-up.',
    features: ['Everything in Starter', 'Online appointment requests', '4-step follow-up sequence (day 0, 1, 3, 7)', 'Urgent-case escalation', 'Team accounts'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyFee: 2000,
    setupFee: 2000,
    description: 'For busy and multi-location practices.',
    features: ['Everything in Growth', 'Priority support', 'Custom knowledge base build-out', 'Monthly conversation review'],
  },
};

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLANS;
}

export interface CheckoutOptions {
  orgId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  /** Add the one-time setup fee to the first invoice (default true). */
  includeSetupFee?: boolean;
}

/** Stripe Checkout parameters: a monthly subscription plus the one-time setup fee. */
export function buildCheckoutParams(plan: PlanConfig, opts: CheckoutOptions): Stripe.Checkout.SessionCreateParams {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: `LeadFlow ${plan.name} — monthly` },
        unit_amount: Math.round(plan.monthlyFee * 100),
        recurring: { interval: 'month' },
      },
    },
  ];
  if (opts.includeSetupFee !== false && plan.setupFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: `LeadFlow ${plan.name} — one-time setup` },
        unit_amount: Math.round(plan.setupFee * 100),
      },
    });
  }
  return {
    mode: 'subscription',
    line_items: lineItems,
    client_reference_id: opts.orgId,
    customer_email: opts.customerEmail,
    metadata: { orgId: opts.orgId, planId: plan.id },
    subscription_data: { metadata: { orgId: opts.orgId, planId: plan.id } },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  };
}

/** The org and plan to activate from a verified webhook event, or null. */
export function planActivationFromEvent(event: Stripe.Event): { orgId: string; planId: PlanId } | null {
  if (event.type !== 'checkout.session.completed') return null;
  const s = event.data.object as Stripe.Checkout.Session;
  const orgId = s.metadata?.orgId || s.client_reference_id || '';
  const planId = s.metadata?.planId;
  if (!orgId || !isPlanId(planId)) return null;
  return { orgId, planId };
}
