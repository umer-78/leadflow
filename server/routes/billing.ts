/**
 * Subscription billing with Stripe Checkout. Disabled until STRIPE_SECRET_KEY is set.
 */
import express, { Router } from 'express';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { requireAuth, requireRole } from '../auth.ts';
import type { AppDeps } from '../app.ts';
import { PLANS, buildCheckoutParams, isPlanId, planActivationFromEvent } from '../billing.ts';
import { organizations } from '../db/schema.ts';
import { HttpError, body, route } from '../http.ts';
import { logActivity } from '../leads.ts';

export function billingRoutes(deps: AppDeps): Router {
  const { db, config } = deps;
  const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
  const r = Router();

  r.get(
    '/config',
    requireAuth(db),
    route(async (req, res) => {
      const org = req.auth!.org;
      res.json({ enabled: !!stripe, plans: PLANS, current: { plan: org.plan, status: org.planStatus } });
    })
  );

  r.post(
    '/checkout',
    requireAuth(db),
    requireRole('OWNER'),
    route(async (req, res) => {
      if (!stripe) throw new HttpError(503, 'Card payments are not enabled yet. Set STRIPE_SECRET_KEY to turn on checkout.');
      const planId = body(req).planId;
      if (!isPlanId(planId)) throw new HttpError(400, 'Unknown plan.');
      const base = config.publicUrl ?? `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create(
        buildCheckoutParams(PLANS[planId], {
          orgId: req.auth!.org.id,
          customerEmail: req.auth!.user.email,
          successUrl: `${base}/#/settings?billing=success`,
          cancelUrl: `${base}/#/settings?billing=cancelled`,
        })
      );
      res.json({ url: session.url });
    })
  );

  // Registered with a raw body parser in app.ts (signature verification needs the exact bytes).
  r.post(
    '/webhook',
    express.raw({ type: '*/*' }),
    route(async (req, res) => {
      if (!stripe) throw new HttpError(503, 'Billing is not configured.');
      const secret = config.stripe.webhookSecret;
      const signature = req.headers['stripe-signature'];
      if (!secret || !signature) throw new HttpError(400, 'Missing webhook signature or secret.');
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, signature as string, secret);
      } catch (err) {
        throw new HttpError(400, `Signature verification failed: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
      const activation = planActivationFromEvent(event);
      if (activation) {
        const [org] = await db
          .update(organizations)
          .set({ plan: activation.planId, planStatus: 'active', updatedAt: new Date() })
          .where(eq(organizations.id, activation.orgId))
          .returning({ id: organizations.id });
        if (org) await logActivity(db, org.id, 'PLAN_ACTIVATED', 'ORGANIZATION', org.id, { plan: activation.planId });
      }
      res.json({ received: true });
    })
  );

  return r;
}
