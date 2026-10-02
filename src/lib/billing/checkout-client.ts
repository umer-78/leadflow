/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Browser-side billing helper. Talks to the server over fetch only — it never
// imports the Stripe Node SDK, so it is safe to bundle into the frontend.
import type { PlanConfig } from './provider.ts';

export interface BillingConfig {
  enabled: boolean;
  plans: Record<string, PlanConfig>;
}

/** Ask the server whether card checkout is live and which plans are on offer. */
export async function getBillingConfig(): Promise<BillingConfig> {
  const r = await fetch('/api/billing/config');
  if (!r.ok) return { enabled: false, plans: {} };
  return r.json();
}

/**
 * Start Stripe Checkout for a plan and redirect the browser to the hosted page.
 * Throws with a readable message if billing is not configured yet, so the UI can
 * fall back to "contact us" instead of failing silently.
 */
export async function startCheckout(planId: string, orgId: string): Promise<void> {
  const r = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ planId, orgId }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Checkout failed (${r.status})`);
  if (!data.url) throw new Error('Checkout did not return a redirect URL.');
  window.location.href = data.url;
}
