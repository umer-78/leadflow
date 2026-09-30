/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lead, LeadScore, LeadScoreTier } from '../types/index.ts';

const HIGH_VALUE_SERVICES = [
  'clear aligners',
  'invisalign',
  'porcelain veneers',
  'veneers',
  'dental implants',
  'implants',
  'full mouth rehabilitation',
  'smile makeover',
  'cosmetic facial aesthetics',
];

export function calculateLeadScore(lead: Partial<Lead>): LeadScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Phone number presence (high intent)
  if (lead.phone && lead.phone.trim().length >= 7) {
    score += 35;
    reasons.push('+ Provided direct phone number (+35 pts)');
  } else {
    reasons.push('- No direct telephone number supplied (0 pts)');
  }

  // 2. High-value service inquiry
  const serviceLower = (lead.serviceRequested || '').toLowerCase();
  const isHighValue = HIGH_VALUE_SERVICES.some((h) => serviceLower.includes(h));
  if (isHighValue) {
    score += 30;
    reasons.push('+ Inquired about high-value elective procedure (+30 pts)');
  } else if (serviceLower.length > 0) {
    score += 15;
    reasons.push('+ Inquired about standard preventive/general dental care (+15 pts)');
  }

  // 3. Urgency signal
  if (lead.urgency === 'HIGH') {
    score += 20;
    reasons.push('+ Immediate/urgent requirement within 7 days (+20 pts)');
  } else if (lead.urgency === 'MEDIUM') {
    score += 10;
    reasons.push('+ Standard timeframe requirement (+10 pts)');
  }

  // 4. Appointment date/time preference requested
  if (lead.preferredDate || lead.preferredTime) {
    score += 15;
    reasons.push('+ Specified preferred booking date/time slot (+15 pts)');
  }

  // Determine tier
  let tier: LeadScoreTier = 'LOW';
  if (score >= 70) {
    tier = 'HIGH';
  } else if (score >= 40) {
    tier = 'MEDIUM';
  }

  return {
    score,
    tier,
    reasons,
  };
}
