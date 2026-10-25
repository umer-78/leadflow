/**
 * Explainable lead scoring: every point comes with a human-readable reason.
 */
import type { LeadTier } from '../db/schema.ts';

export interface ScoreInput {
  service?: string | null;
  /** Typical case value of the service of interest (USD). */
  caseValue?: number | null;
  hasName: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  appointmentRequested: boolean;
  askedToBook: boolean;
  urgent: boolean;
  /** Preferred date is within the next 14 days. */
  wantsSoon: boolean;
  /** Asked about price, insurance or financing. */
  buyingSignals: number;
  visitorMessages: number;
  optedOut: boolean;
}

export interface LeadScore {
  score: number;
  tier: LeadTier;
  reasons: string[];
  estimatedValue: number;
}

export function scoreLead(i: ScoreInput): LeadScore {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(`+${points} ${reason}`);
  };

  const value = i.caseValue ?? 0;
  if (i.service) {
    if (value >= 3000) add(30, `High-value treatment interest: ${i.service}`);
    else if (value >= 1000) add(18, `Restorative treatment interest: ${i.service}`);
    else add(8, `Interested in ${i.service}`);
  }
  if (i.appointmentRequested) add(25, 'Requested an appointment');
  else if (i.askedToBook) add(10, 'Asked about booking');
  if (i.hasPhone) add(15, 'Left a phone number');
  if (i.hasEmail) add(10, 'Left an email address');
  if (i.hasName) add(5, 'Shared their name');
  if (i.urgent) add(10, 'Has an urgent dental problem');
  if (i.wantsSoon) add(5, 'Wants to come in within two weeks');
  if (i.buyingSignals > 0) add(Math.min(10, 5 * i.buyingSignals), 'Asked about price, insurance or financing');
  if (i.visitorMessages >= 4) add(5, 'Engaged conversation');

  score = Math.min(100, score);
  let tier: LeadTier = score >= 60 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
  if (i.optedOut) {
    tier = 'LOW';
    reasons.push('Opted out of follow-up messages');
  }
  return { score, tier, reasons, estimatedValue: value };
}
