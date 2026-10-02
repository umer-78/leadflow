/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Server-side Stripe helpers for LeadFlow subscriptions. All network calls live in
// server.ts; everything here is pure so it can be unit-tested without Stripe keys.
// The Stripe SDK is imported for its *types only* (erased at build time), so this
// module adds no runtime dependency and is never pulled into the browser bundle.
import type Stripe from 'stripe';
import { PLAN_CONFIGS, type PlanConfig } from './provider.ts';

export type PlanId = 'starter' | 'growth' | 'pro';

/** True only when a real Stripe secret key is present. Until then the app stays in
 *  demo mode and the checkout endpoint returns a clear "not configured" message. */
export function isStripeConfigured(): boolean {
  const k = process.env.STRIPE_SECRET_KEY;
  return !!k && k.startsWith('sk_') && k !== 'sk_test_xxx';
}

export interface CheckoutOptions {
  orgId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  /** Whether to add the one-time setup fee to the first invoice (default true). */
  includeSetupFee?: boolean;
}

/**
 * Build the Stripe Checkout Session parameters for a plan: a monthly recurring
 * subscription for the monthly fee, plus the one-time setup fee on the first
 * invoice. Pure — no network, so it is unit-testable.
 *
 * Note: a one-time line item alongside a recurring one is billed on the first
 * invoice in Checkout subscription mode. If a particular Stripe account rejects
 * the mix, set includeSetupFee:false and collect the setup fee separately.
 */
export function buildCheckoutParams(
  plan: PlanConfig,
  opts: CheckoutOptions
): Stripe.Checkout.SessionCreateParams {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        product_data: { name: `${plan.name} — monthly` },
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
        product_data: { name: `${plan.name} — one-time setup` },
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

/** Pull the org + plan to activate from a verified Stripe webhook event, or null
 *  if the event is not a completed checkout we recognise. Pure. */
export function planActivationFromEvent(
  event: Stripe.Event
): { orgId: string; planId: PlanId } | null {
  if (event.type !== 'checkout.session.completed') return null;
  const s = event.data.object as Stripe.Checkout.Session;
  const orgId = s.metadata?.orgId || s.client_reference_id || '';
  const planId = s.metadata?.planId as PlanId | undefined;
  if (!orgId || !planId || !(planId in PLAN_CONFIGS)) return null;
  return { orgId, planId };
}
