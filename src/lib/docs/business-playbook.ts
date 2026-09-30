/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PlaybookDoc {
  id: string;
  title: string;
  category: 'STRATEGY' | 'SALES' | 'ONBOARDING' | 'OPERATIONS';
  summary: string;
  content: string;
}

export const BUSINESS_PLAYBOOK: PlaybookDoc[] = [
  {
    id: 'business-model',
    title: '1. Business Model & $20k/Mo Target Architecture',
    category: 'STRATEGY',
    summary: 'How LeadFlow AI packages, prices, and scales high-ticket clinic lead automation.',
    content: `# LeadFlow AI — Business Model & Revenue Mechanics

## The Core Value Proposition
Service businesses (starting with Dental & Cosmetic practices) spend thousands of dollars each month acquiring traffic via Google Ads, local SEO, and social media. However, up to 62% of prospective inquiries arrive outside standard 9-5 clinic hours or sit unresponded to for 4+ hours on front desks.

High-intent elective patients (Invisalign $4,000, Veneers $8,000-$15,000, Implants $3,000-$25,000) contact 2-3 local clinics. The first clinic to respond within 60 seconds with clear clinical procedure answers and friction-free consultation booking captures 78% of appointments.

**We do NOT sell "AI". We sell an automated lead intake & appointment machine.**

## Target Revenue Progression
- **Month 1:** 1st paying customer ($1,000/mo + $1,000 setup = $2,000 cash).
- **Month 3:** 3 active clients ($3,000 MRR).
- **Month 6:** 8 active clients ($8,000 MRR).
- **Month 9:** 14 active clients ($14,000 MRR).
- **Month 12:** 20 active clients ($20,000 MRR target).

## Pricing Structure
1. **Starter Tier ($500/mo + $500 setup)**: 24/7 AI receptionist widget, core FAQs, instant SMS alert, T+0 and T+1 follow-up sequence.
2. **Growth Tier ($1,000/mo + $1,000 setup) [RECOMMENDED]**: 4-step follow-up (T+0, T+1, T+3, T+7), high-value lead scoring, staff handoff triage, direct appointment calendar queue.
3. **Pro Tier ($2,000/mo + $2,000 setup)**: Multi-location routing, EHR integration, custom bi-weekly pipeline audit calls.`,
  },
  {
    id: 'prospecting',
    title: '2. High-Value Clinic Prospecting & Verification',
    category: 'SALES',
    summary: 'Zero-cost methodology to identify clinics losing after-hours leads.',
    content: `# Prospecting & Verification Playbook ($0 Capital)

## Target Selection Criteria
Focus exclusively on clinics with high-ticket elective procedures:
- Cosmetic Dentists (Veneers, Invisalign, Implants, Smile Makeovers)
- Facial Plastic Surgeons & MedSpas (Facelifts, Rhinoplasty, Injectables)
- High-ticket Orthodontists

## Step-by-Step Prospect Audit (10 Minutes per Clinic)
1. **Audit Website Contact Funnel**: Visit site after 6:00 PM. Is there a live chat? Or only an 8-field static contact form?
2. **Audit Mobile Experience**: Check responsiveness on mobile phone. Does it offer click-to-text or instant triage?
3. **Document 2 Verified Observations**:
   - Observation 1: "Contact form requires 7 inputs with no instant confirmation."
   - Observation 2: "Offers $15k All-on-4 dental implants with zero after-hours inquiry triage."
4. **Log in LeadFlow AI Prospect CRM** (/admin/prospects). Mark any unverified item as UNKNOWN.`,
  },
  {
    id: 'sales-process',
    title: '3. 8-Step Sales Conversion Pipeline',
    category: 'SALES',
    summary: 'From cold outreach to signed agreement with human-in-the-loop approval.',
    content: `# The 8-Step Sales Conversion Pipeline

1. **Prospect**: Identify practice, contact name, email, direct phone.
2. **Research**: AI Research Assistant summarizes business and potential leak points.
3. **Generate Draft**: AI drafts personalized 4-sentence outreach highlighting verified observation.
4. **Human Approval**: Founder reviews draft, edits tone, ensures zero false promises, approves.
5. **Outreach & T+2 Follow-up**: Send private interactive demo link.
6. **Discovery Call**: 15-minute diagnostic call assessing current monthly lost inquiries.
7. **Proposal**: Send 1-click Proposal (Starter/Growth/Pro) with 14-day validity.
8. **Payment & Kickoff**: Collect initial setup + first month fee ($2,000 on Growth plan).`,
  },
  {
    id: 'first-10-customers',
    title: '4. First 10 Customers Playbook',
    category: 'STRATEGY',
    summary: 'Detailed day-by-day checklist to secure the first 10 paying clinic clients.',
    content: `# The First 10 Customers Playbook

## Customer #1 Goal: Day 1 to 14
- Build 10 personalized demos in LeadFlow AI for top-rated local dental/cosmetic practices.
- Send personalized video or screenshot of their custom widget answering their exact procedure FAQs.
- Offer 14-day zero-risk trial or 30-day money-back guarantee based on consultation bookings.
- Target: $1,000 MRR closed.

## Customers #2 - #5: Day 15 to 45
- Case study leverage: Document lead response time reduction (from 4 hours to 45 seconds).
- Show captured leads from Customer #1.
- Target: $5,000 MRR closed.

## Customers #6 - #10: Day 45 to 90
- Referral engine activation: Offer $250 clinic credit or partner fee for doctor-to-doctor introductions.
- Target: $10,000 MRR closed.`,
  },
  {
    id: 'onboarding',
    title: '5. 11-Step Clinic Onboarding Wizard',
    category: 'ONBOARDING',
    summary: 'How to configure a new practice in 25 minutes without developer intervention.',
    content: `# 11-Step Clinic Onboarding Protocol

1. **Business Profile**: Clinic name, slug, address, primary phone.
2. **Services & Procedures**: Input top 3-5 procedures with starting prices or price ranges.
3. **FAQs**: Common patient concerns (financing, insurance, discomfort, recovery).
4. **Pricing & Financing Policy**: Clarify CareCredit, Sunbit, or in-house payment plans.
5. **Business Hours**: Operating hours and after-hours triage instructions.
6. **Staff Contacts**: Duty receptionist email and SMS numbers for urgent alerts.
7. **Appointment Procedures**: Consultation duration and provider names.
8. **Knowledge Document Ingestion**: Paste clinical brochure or procedure guidelines.
9. **AI Receptionist Settings**: Custom greeting, color, and qualification questions.
10. **Test Mode Simulation**: Test medical refusal, pricing check, and handoff.
11. **Production Activation**: Copy embed script and paste before </body> tag.`,
  },
  {
    id: 'weekly-operations',
    title: '6. Weekly AI Business Operations & Review',
    category: 'OPERATIONS',
    summary: 'Standard operating cadence to track MRR gap, churn, and pipeline velocity.',
    content: `# Weekly Operating Cadence

## Monday Morning: Pipeline & Outreach
- Review MRR Target Dashboard (Current vs $20k Target, Gap, Clients Needed).
- Review 15 prospects in CRM; generate and human-approve outreach batches.
- Check follow-up sequences due today.

## Wednesday Mid-Week: Client Health Audit
- Review Client Health Scores (Green, Yellow, Red).
- Check automation failure alerts.
- Check unhandled human handoffs.

## Friday Afternoon: Weekly Performance Report
- Generate Weekly Business Report with AI observations.
- Tally weekly new leads, qualified leads, and consultation bookings across all tenants.
- Prepare weekend after-hours monitoring.`,
  },
];
