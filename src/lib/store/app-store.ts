/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { assertPermission, assertTenantAccess, hashPassword } from '../auth/auth-service.ts';
import { calculateLeadScore } from '../crm/scoring.ts';
import {
  Appointment,
  AuditLog,
  AutomationRule,
  AutomationRun,
  Conversation,
  KnowledgeDocument,
  Lead,
  NotificationItem,
  Organization,
  Proposal,
  Prospect,
  SystemHealthState,
  AgencySettings,
  User,
  UserRole,
} from '../types/index.ts';

// Initial Demo Seed Data
const INITIAL_ORGS: Organization[] = [
  {
    id: 'org-apex-dental',
    name: 'Apex Smile & Cosmetic Studio',
    slug: 'apex-smile',
    industry: 'Dental / Cosmetic Dentistry',
    website: 'https://apexsmilestudio.example.com',
    phone: '+1 (555) 349-2041',
    address: '420 Lexington Avenue, Suite 800, New York, NY 10170',
    status: 'ACTIVE',
    planId: 'growth',
    monthlyFee: 1000,
    setupFee: 1000,
    widgetId: 'apex-widget-9842',
    widgetColor: '#0284c7',
    aiGreeting:
      'Hello! Welcome to Apex Smile & Cosmetic Studio. How can we assist with your dental or smile makeover inquiries today?',
    qualificationQuestions: [
      'What procedure or smile goal are you exploring today?',
      'Have you had a clinical dental examination in the last 6 months?',
      'Are you experiencing any acute discomfort or sensitivity?',
      'What is your preferred timeframe to start treatment?',
    ],
    businessHours: 'Mon-Fri: 8:00 AM - 6:00 PM, Sat: 9:00 AM - 2:00 PM, Sun: Closed',
    services: [
      {
        id: 'srv-1',
        name: 'Clear Aligners (Invisalign)',
        category: 'Orthodontics',
        price: 'From $3,800 or $129/mo',
        duration: '45 mins initial scan',
        description: 'Comprehensive 3D iTero digital scan, custom aligner plan, and retainer set.',
        highValue: true,
      },
      {
        id: 'srv-2',
        name: 'Handcrafted Porcelain Veneers',
        category: 'Cosmetic',
        price: '$1,400 per tooth',
        duration: '60 mins consultation',
        description: 'Ultra-thin, custom-shaded porcelain shells for transformative smile rejuvenation.',
        highValue: true,
      },
      {
        id: 'srv-3',
        name: 'Single & Full-Arch Dental Implants',
        category: 'Restorative',
        price: 'From $2,400 per implant',
        duration: '60 mins 3D CBCT review',
        description: 'Surgical titanium or zirconia post with custom screw-retained ceramic crown.',
        highValue: true,
      },
      {
        id: 'srv-4',
        name: 'In-Office Laser Teeth Whitening',
        category: 'Cosmetic',
        price: '$450',
        duration: '75 mins',
        description: 'Philips Zoom laser whitening achieving up to 8 shades brighter in a single session.',
        highValue: false,
      },
      {
        id: 'srv-5',
        name: 'Comprehensive Exam & Prophylaxis',
        category: 'Preventive',
        price: '$195 (often covered 100% by insurance)',
        duration: '50 mins',
        description: 'Digital X-rays, periodontal charting, oral cancer screening, and ultrasonic cleaning.',
        highValue: false,
      },
    ],
    createdAt: '2026-08-15T10:00:00.000Z',
  },
  {
    id: 'org-harborview',
    name: 'Harborview Aesthetic Surgery Institute',
    slug: 'harborview-surgery',
    industry: 'Cosmetic / Plastic Surgery',
    website: 'https://harborviewaesthetics.example.com',
    phone: '+1 (555) 782-9900',
    address: '880 Ocean Promenade, Suite 300, Miami, FL 33139',
    status: 'ACTIVE',
    planId: 'starter',
    monthlyFee: 500,
    setupFee: 500,
    widgetId: 'harborview-widget-1142',
    widgetColor: '#0f766e',
    aiGreeting:
      'Welcome to Harborview Aesthetic Surgery Institute. How may we guide your consultation inquiry today?',
    qualificationQuestions: [
      'Which procedure are you considering?',
      'Have you consulted with a board-certified surgeon previously?',
    ],
    businessHours: 'Mon-Thu: 9:00 AM - 5:00 PM, Fri: 9:00 AM - 3:00 PM',
    services: [
      {
        id: 'srv-h1',
        name: 'Deep Plane Facial Rejuvenation',
        category: 'Surgical',
        price: 'From $14,000',
        duration: '90 mins consultation',
        description: 'Advanced structural facial restoration performed under accredited surgical facility.',
        highValue: true,
      },
    ],
    createdAt: '2026-09-01T12:00:00.000Z',
  },
  {
    id: 'org-agency-root',
    name: 'LeadFlow AI Agency Operations',
    slug: 'leadflow-root',
    industry: 'AI Automation Agency',
    website: 'https://leadflow.ai',
    phone: '+1 (800) 555-LEAD',
    status: 'ACTIVE',
    planId: 'pro',
    monthlyFee: 0,
    setupFee: 0,
    widgetId: 'agency-leadflow-001',
    widgetColor: '#4f46e5',
    aiGreeting: 'Hi there! Looking to automate lead capture and appointments for your high-ticket clinic?',
    qualificationQuestions: ['What is your current monthly lead volume?'],
    businessHours: '24/7 Autonomous Operations',
    services: [],
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

const INITIAL_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'usr-agency-founder',
    name: 'Umer Hashmi',
    email: 'umerhashmi987@gmail.com',
    role: 'OWNER',
    organizationId: 'org-agency-root',
    createdAt: new Date().toISOString(),
    passwordHash: 'h_demo123',
  },
  {
    id: 'usr-apex-owner',
    name: 'Dr. Elena Rostova',
    email: 'dr.elena@apexsmile.com',
    role: 'OWNER',
    organizationId: 'org-apex-dental',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    passwordHash: 'h_demo123',
  },
  {
    id: 'usr-apex-admin',
    name: 'Sarah Jenkins',
    email: 'sarah.admin@apexsmile.com',
    role: 'ADMIN',
    organizationId: 'org-apex-dental',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    passwordHash: 'h_demo123',
  },
  {
    id: 'usr-apex-staff',
    name: 'Jessica Vance',
    email: 'jessica.reception@apexsmile.com',
    role: 'STAFF',
    organizationId: 'org-apex-dental',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    passwordHash: 'h_demo123',
  },
];

const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-1',
    organizationId: 'org-apex-dental',
    name: 'Samantha Hughes',
    email: 'samantha.hughes@gmail.com',
    phone: '+1 (555) 902-4411',
    serviceRequested: 'Handcrafted Porcelain Veneers',
    preferredDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    preferredTime: 'Morning (10:00 AM)',
    urgency: 'HIGH',
    notes: 'Bride getting married in November. Looking to correct spacing on 6 upper teeth.',
    status: 'QUALIFIED',
    score: {
      tier: 'HIGH',
      score: 85,
      reasons: [
        '+ Provided direct phone number (+35 pts)',
        '+ Inquired about high-value elective procedure (+30 pts)',
        '+ Immediate timeframe requirement within 30 days (+20 pts)',
      ],
    },
    source: 'Website AI Receptionist',
    estimatedValue: 8400,
    lastContactedAt: new Date(Date.now() - 3600000).toISOString(),
    followupScheduledAt: new Date(Date.now() + 86400000).toISOString(),
    followupCount: 1,
    optedOut: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'lead-2',
    organizationId: 'org-apex-dental',
    name: 'David K. Miller',
    email: 'david.miller@techcorp.io',
    phone: '+1 (555) 432-8819',
    serviceRequested: 'Clear Aligners (Invisalign)',
    preferredDate: new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
    preferredTime: 'Afternoon (3:00 PM)',
    urgency: 'MEDIUM',
    notes: 'Had traditional braces as a teenager, lower front teeth crowded again.',
    status: 'APPOINTMENT_REQUESTED',
    score: {
      tier: 'HIGH',
      score: 80,
      reasons: [
        '+ Provided direct phone number (+35 pts)',
        '+ Inquired about high-value elective procedure (+30 pts)',
      ],
    },
    source: 'Website AI Receptionist',
    estimatedValue: 4800,
    lastContactedAt: new Date(Date.now() - 14400000).toISOString(),
    followupScheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    followupCount: 1,
    optedOut: false,
    createdAt: new Date(Date.now() - 18000000).toISOString(),
    updatedAt: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'lead-3',
    organizationId: 'org-apex-dental',
    name: 'Victoria Morales',
    email: 'vmorales@creativehouse.co',
    phone: '+1 (555) 819-0022',
    serviceRequested: 'Single & Full-Arch Dental Implants',
    urgency: 'HIGH',
    notes: 'Missing upper second molar after root canal fracture. Seeking permanent replacement.',
    status: 'APPOINTMENT_BOOKED',
    score: {
      tier: 'HIGH',
      score: 95,
      reasons: [
        '+ Provided direct phone number (+35 pts)',
        '+ Inquired about high-value elective procedure (+30 pts)',
        '+ Immediate/urgent clinical condition (+20 pts)',
        '+ Confirmed in-clinic consultation booking slot (+10 pts)',
      ],
    },
    source: 'Google Local Search Campaign',
    estimatedValue: 3600,
    lastContactedAt: '2026-09-27T10:00:00.000Z',
    followupScheduledAt: undefined,
    followupCount: 2,
    optedOut: false,
    createdAt: '2026-09-26T18:10:00.000Z',
    updatedAt: '2026-09-27T10:00:00.000Z',
  },
  {
    id: 'lead-4',
    organizationId: 'org-apex-dental',
    name: 'Jonathan Reynolds',
    email: 'jreynolds@gmail.com',
    phone: '',
    serviceRequested: 'In-Office Laser Teeth Whitening',
    urgency: 'LOW',
    notes: 'Asking about sensitivity during Zoom whitening sessions.',
    status: 'NEW',
    score: {
      tier: 'LOW',
      score: 25,
      reasons: [
        '- No direct telephone number supplied (0 pts)',
        '+ Inquired about standard cosmetic care (+15 pts)',
        '+ Standard timeframe (+10 pts)',
      ],
    },
    source: 'Website AI Receptionist',
    estimatedValue: 450,
    followupCount: 0,
    optedOut: false,
    createdAt: '2026-09-30T09:15:00.000Z',
    updatedAt: '2026-09-30T09:15:00.000Z',
  },
  {
    id: 'lead-harborview-1',
    organizationId: 'org-harborview',
    name: 'Protected Harborview Patient',
    email: 'confidential@harborview.example.com',
    phone: '+1 (555) 777-8888',
    serviceRequested: 'Deep Plane Facial Rejuvenation',
    urgency: 'HIGH',
    notes: 'Private surgical candidate. Org A must never see this lead.',
    status: 'QUALIFIED',
    score: {
      tier: 'HIGH',
      score: 90,
      reasons: ['+ High-value surgical candidate'],
    },
    source: 'Harborview AI Widget',
    estimatedValue: 18000,
    followupCount: 1,
    optedOut: false,
    createdAt: '2026-09-25T11:00:00.000Z',
    updatedAt: '2026-09-25T11:00:00.000Z',
  },
];

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    organizationId: 'org-apex-dental',
    leadId: 'lead-3',
    leadName: 'Victoria Morales',
    service: 'Single & Full-Arch Dental Implants',
    dateTime: '2026-10-02T10:00:00.000Z',
    durationMinutes: 60,
    status: 'CONFIRMED',
    providerStaffName: 'Dr. Elena Rostova',
    notes: 'Include 3D CBCT digital volumetric scan.',
    createdAt: '2026-09-27T10:00:00.000Z',
  },
  {
    id: 'apt-2',
    organizationId: 'org-apex-dental',
    leadId: 'lead-2',
    leadName: 'David K. Miller',
    service: 'Clear Aligners (Invisalign)',
    dateTime: '2026-10-08T15:00:00.000Z',
    durationMinutes: 45,
    status: 'REQUESTED',
    providerStaffName: 'Dr. Elena Rostova',
    notes: 'Requested afternoon slot. Awaiting staff phone confirmation.',
    createdAt: '2026-09-28T16:00:00.000Z',
  },
];

const INITIAL_AUTOMATIONS: AutomationRule[] = [
  {
    id: 'rule-1',
    organizationId: 'org-apex-dental',
    name: 'Instant AI Reception Response & SMS Triage',
    description: 'Dispatches instant booking acknowledgement and follow-up track upon new lead intake.',
    trigger: 'lead.created',
    condition: 'always',
    actions: [
      { type: 'send_initial_response', params: {} },
      { type: 'notify_client', params: {} },
    ],
    enabled: true,
    executionCount: 42,
  },
  {
    id: 'rule-2',
    organizationId: 'org-apex-dental',
    name: 'Day 1 Consultation Follow-Up Sequence',
    description: 'Sends automated check-in 24 hours after inquiry if consultation is not yet scheduled.',
    trigger: 'lead.created',
    condition: 'status == NEW',
    actions: [{ type: 'schedule_followup', params: { delayDays: 1 } }],
    enabled: true,
    executionCount: 28,
  },
  {
    id: 'rule-3',
    organizationId: 'org-apex-dental',
    name: 'High-Value Elective Case Triage',
    description: 'Immediately triggers SMS alert to Treatment Coordinator when lead score is HIGH (>=70).',
    trigger: 'lead.qualified',
    condition: 'score.tier == HIGH',
    actions: [{ type: 'notify_client', params: { priority: 'URGENT' } }],
    enabled: true,
    executionCount: 19,
  },
];

const INITIAL_KNOWLEDGE: KnowledgeDocument[] = [
  {
    id: 'kdoc-1',
    organizationId: 'org-apex-dental',
    title: 'Clinic Procedures, Fees & Financing Policy',
    category: 'SERVICES',
    content: `Clear Aligners (Invisalign): Comprehensive treatment from $3,800. Includes initial 3D digital scan, custom aligner trays, and final Vivera retainers. 0% interest payment plans available starting at $129/month through CareCredit.
Porcelain Veneers: Custom layered e.max ceramic veneers at $1,400 per tooth. Requires two appointments: aesthetic design & prep, followed by final bonding.
Dental Implants: Single tooth replacement starting at $2,400 per implant post. Restored with custom ceramic screw-retained crown.
Teeth Whitening: In-office Philips Zoom laser whitening $450. Up to 8 shades lighter in 75 minutes.
Preventive Exam & Prophylaxis: $195 out-of-pocket, or 100% covered by most PPO insurances (Delta Dental, MetLife, Cigna, Guardian, Aetna).`,
    chunks: [
      {
        id: 'chunk-1',
        documentId: 'kdoc-1',
        organizationId: 'org-apex-dental',
        heading: 'Clear Aligners Pricing & Financing',
        content: 'Clear Aligners (Invisalign) start at $3,800 or $129/month with 0% interest CareCredit financing. Includes 3D scan and retainers.',
        keywords: ['invisalign', 'aligners', 'price', 'cost', 'financing', 'braces'],
      },
      {
        id: 'chunk-2',
        documentId: 'kdoc-1',
        organizationId: 'org-apex-dental',
        heading: 'Porcelain Veneers Procedure & Fee',
        content: 'Handcrafted e.max porcelain veneers cost $1,400 per tooth. Two visits required for design and placement.',
        keywords: ['veneers', 'porcelain', 'price', 'smile makeover', 'cost'],
      },
      {
        id: 'chunk-3',
        documentId: 'kdoc-1',
        organizationId: 'org-apex-dental',
        heading: 'Location, Parking & Hours',
        content: 'Apex Smile is at 420 Lexington Avenue, Suite 800, New York, NY 10170. Open Mon-Fri 8am-6pm, Sat 9am-2pm. Dedicated patient parking garage validation provided.',
        keywords: ['location', 'address', 'hours', 'parking', 'open', 'saturday'],
      },
    ],
    updatedAt: '2026-09-20T10:00:00.000Z',
  },
];

const INITIAL_PROSPECTS: Prospect[] = [
  {
    id: 'prsp-1',
    businessName: 'Manhattan Cosmetic Dentistry & Implants',
    website: 'https://manhattancosmetic.example.com',
    industry: 'Cosmetic Dentistry',
    country: 'United States',
    contactName: 'Dr. Gregory Thorne',
    email: 'dr.thorne@manhattancosmetic.example.com',
    phone: '+1 (212) 555-0182',
    stage: 'DEMO',
    identifiedProblem: 'No after-hours inquiry capture; static contact form leads to lost weekend veneer inquiries.',
    verifiedObservations: [
      'Website has a generic 8-field contact form with no after-hours triage',
      'Specializes in high-ticket All-on-4 dental implants ($25,000+ cases)',
    ],
    outreachDraft: {
      subject: 'Quick idea for Manhattan Cosmetic Dentistry',
      body: `Hi Dr. Thorne,

I noticed on Manhattan Cosmetic Dentistry's website that evening and weekend visitors only have a static contact form to submit inquiries.

For high-ticket All-on-4 implant candidates who compare 2-3 practices outside office hours, responding in under 60 seconds captures 78% of consultation bookings.

I generated a 2-minute private demo configured specifically with your implant services to show how LeadFlow AI qualifies and books patients 24/7.

Would you be open to seeing the preview link?

Best regards,
Umer Hashmi
Founder, LeadFlow AI`,
      approvedByHuman: true,
      sentAt: '2026-09-28T14:00:00.000Z',
    },
    estimatedDealValue: 1000,
    lastContactedAt: '2026-09-28T14:00:00.000Z',
    nextFollowupDate: '2026-10-02',
    notes: 'Dr. Thorne opened demo link 3 times. Follow up on Thursday.',
    demoSlug: 'manhattan-implants',
    createdAt: '2026-09-24T10:00:00.000Z',
  },
  {
    id: 'prsp-2',
    businessName: 'Park Avenue Facial Plastic Surgery',
    website: 'https://parkaveplastics.example.com',
    industry: 'Facial Plastic Surgery',
    country: 'United States',
    contactName: 'Jennifer Cole (Practice Director)',
    email: 'jennifer@parkaveplastics.example.com',
    phone: '+1 (212) 555-8841',
    stage: 'PROPOSAL',
    identifiedProblem: 'High inquiry drop-off due to slow staff callback times on rhinoplasty consults.',
    verifiedObservations: [
      'Promotes deep plane facelifts and preservation rhinoplasty',
      'Average patient wait time for phone response exceeds 4 hours',
    ],
    outreachDraft: {
      subject: 'Idea for Park Avenue Facial Plastic Surgery',
      body: 'Hi Jennifer, reviewed your inquiry funnel...',
      approvedByHuman: true,
      sentAt: '2026-09-26T11:00:00.000Z',
    },
    estimatedDealValue: 2000,
    lastContactedAt: '2026-09-29T16:00:00.000Z',
    nextFollowupDate: '2026-10-01',
    notes: 'Sent Growth Tier Proposal ($1,000/mo + $1,000 setup). Review scheduled for Friday.',
    createdAt: '2026-09-22T08:00:00.000Z',
  },
  {
    id: 'prsp-3',
    businessName: 'Skyline Aesthetics & Laser Clinic',
    website: 'https://skylineaesthetics.example.com',
    industry: 'Medical Spa / Aesthetics',
    country: 'United States',
    contactName: 'Chloe Bennett',
    email: 'chloe@skylineaesthetics.example.com',
    phone: '+1 (415) 555-2231',
    stage: 'RESEARCHED',
    identifiedProblem: 'High volume of Instagram DM inquiries going unanswered during clinic procedures.',
    verifiedObservations: [
      'Active social media presence with 24k followers',
      'Zero automated booking funnel on mobile bio link',
    ],
    estimatedDealValue: 500,
    nextFollowupDate: '2026-10-01',
    notes: 'Ready for personalized outreach generation and human review.',
    createdAt: '2026-09-30T09:00:00.000Z',
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-1',
    organizationId: 'org-apex-dental',
    userId: 'usr-apex-owner',
    userName: 'Dr. Elena Rostova',
    action: 'ORGANIZATION_CONFIG_UPDATED',
    entityType: 'Organization',
    entityId: 'org-apex-dental',
    details: 'Updated qualification questions and business hours.',
    timestamp: '2026-09-29T15:00:00.000Z',
  },
  {
    id: 'audit-2',
    organizationId: 'org-apex-dental',
    userId: 'usr-apex-staff',
    userName: 'Jessica Vance',
    action: 'LEAD_STATUS_CHANGED',
    entityType: 'Lead',
    entityId: 'lead-2',
    details: 'Status changed from QUALIFIED to APPOINTMENT_REQUESTED.',
    timestamp: '2026-09-28T16:00:00.000Z',
  },
];

// App State Interface
export interface AppState {
  currentUser: User;
  currentOrg: Organization;
  users: (User & { passwordHash: string })[];
  organizations: Organization[];
  leads: Lead[];
  appointments: Appointment[];
  automations: AutomationRule[];
  automationRuns: AutomationRun[];
  knowledge: KnowledgeDocument[];
  prospects: Prospect[];
  proposals: Proposal[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  systemHealth: SystemHealthState;
  agencySettings: AgencySettings;
}

class AppStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): AppState {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('leadflow_ai_state_v1') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.agencySettings) {
          parsed.agencySettings = {
            agencyName: 'LeadFlow AI Agency',
            ownerName: 'Umer Hashmi',
            ownerEmail: 'umerhashmi987@gmail.com',
            ownerPhone: '+1 (555) 782-9011',
            customDomain: 'leadflow-agency.com',
            stripeStarterLink: '',
            stripeGrowthLink: '',
            stripeProLink: '',
            currency: 'USD',
          };
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse saved state, initializing fresh seed.', e);
      }
    }

    const defaultUser = INITIAL_USERS[0];
    const defaultOrg = INITIAL_ORGS[0];

    return {
      currentUser: defaultUser,
      currentOrg: defaultOrg,
      users: INITIAL_USERS,
      organizations: INITIAL_ORGS,
      leads: INITIAL_LEADS,
      appointments: INITIAL_APPOINTMENTS,
      automations: INITIAL_AUTOMATIONS,
      automationRuns: [],
      knowledge: INITIAL_KNOWLEDGE,
      prospects: INITIAL_PROSPECTS,
      proposals: [],
      notifications: [
        {
          id: 'notif-1',
          organizationId: 'org-apex-dental',
          type: 'LEAD_URGENT',
          title: 'High-Value Lead Intake: Samantha Hughes',
          message: 'Inquired for Porcelain Veneers ($8,400 est. case value). Phone: +1 (555) 902-4411.',
          read: false,
          timestamp: new Date().toISOString(),
        },
      ],
      auditLogs: INITIAL_AUDIT_LOGS,
      systemHealth: {
        database: 'HEALTHY',
        aiGateway: 'HEALTHY',
        geminiApi: 'HEALTHY',
        cloudPlatform: 'HEALTHY',
        automationEngine: 'HEALTHY',
        billing: 'MOCK_HEALTHY',
        emailService: 'MOCK_HEALTHY',
        lastChecked: new Date().toISOString(),
      },
      agencySettings: {
        agencyName: 'LeadFlow AI Agency',
        ownerName: 'Umer Hashmi',
        ownerEmail: 'umerhashmi987@gmail.com',
        ownerPhone: '+1 (555) 782-9011',
        customDomain: 'leadflow-agency.com',
        stripeStarterLink: '',
        stripeGrowthLink: '',
        stripeProLink: '',
        currency: 'USD',
      },
    };
  }

  private saveState() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadflow_ai_state_v1', JSON.stringify(this.state));
    }
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  getState(): AppState {
    return this.state;
  }

  resetToDemoSeed() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('leadflow_ai_state_v1');
    }
    this.state = this.loadState();
    this.saveState();
  }

  clearToCleanSlate() {
    this.state.leads = [];
    this.state.appointments = [];
    this.state.prospects = [];
    this.state.proposals = [];
    this.state.notifications = [];
    this.state.automationRuns = [];
    this.state.auditLogs = [];
    this.saveState();
  }

  clearAllLogs() {
    this.state.automationRuns = [];
    this.state.auditLogs = [];
    this.state.notifications = [];
    this.saveState();
  }

  // --- Auth & Session ---
  switchUser(user: User) {
    const org = this.state.organizations.find((o) => o.id === user.organizationId) || this.state.organizations[0];
    this.state.currentUser = user;
    this.state.currentOrg = org;
    this.saveState();
  }

  registerUser(params: {
    name: string;
    email: string;
    plainPassword: string;
    orgName: string;
    industry: string;
  }): { user: User; organization: Organization } {
    const orgId = `org-${Date.now()}`;
    const userId = `usr-${Date.now()}`;

    const newOrg: Organization = {
      id: orgId,
      name: params.orgName,
      slug: params.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      industry: params.industry,
      status: 'TRIAL',
      planId: 'growth',
      monthlyFee: 1000,
      setupFee: 1000,
      widgetId: `widget-${Math.random().toString(36).substring(7)}`,
      widgetColor: '#0284c7',
      aiGreeting: `Welcome to ${params.orgName}! How can we assist you with our services today?`,
      qualificationQuestions: ['What service are you interested in?', 'When would you like to schedule?'],
      businessHours: 'Mon-Fri: 9:00 AM - 5:00 PM',
      services: [],
      createdAt: new Date().toISOString(),
    };

    const newUser: User & { passwordHash: string } = {
      id: userId,
      name: params.name,
      email: params.email,
      role: 'OWNER',
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      passwordHash: `h_${params.plainPassword}`,
    };

    this.state.organizations.push(newOrg);
    this.state.users.push(newUser);
    this.state.currentUser = newUser;
    this.state.currentOrg = newOrg;

    this.logAudit(orgId, userId, params.name, 'USER_REGISTERED', 'User', userId, 'Created new organization and user account.');
    this.saveState();

    return { user: newUser, organization: newOrg };
  }

  login(email: string, plainPassword: string): User {
    const found = this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      throw new Error('Invalid email or password.');
    }
    // Simple demo password verification
    if (found.passwordHash !== `h_${plainPassword}` && plainPassword !== 'demo123') {
      throw new Error('Invalid email or password.');
    }

    const org = this.state.organizations.find((o) => o.id === found.organizationId);
    if (org) {
      this.state.currentOrg = org;
    }
    this.state.currentUser = found;
    this.saveState();
    return found;
  }

  logout() {
    // Switch to first demo user or viewer
    const guest = this.state.users.find((u) => u.role === 'VIEWER') || this.state.users[0];
    this.switchUser(guest);
  }

  requestPasswordReset(email: string): string {
    const found = this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) {
      throw new Error('No account found with this email address.');
    }
    return `reset_token_${Math.random().toString(36).substring(2)}`;
  }

  resetPassword(email: string, newPlain: string) {
    const found = this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!found) throw new Error('Account not found.');
    found.passwordHash = `h_${newPlain}`;
    this.saveState();
  }

  // --- Tenant-Isolated Data Operations ---

  getLeads(targetOrgId?: string): Lead[] {
    const orgId = targetOrgId || this.state.currentOrg.id;
    assertTenantAccess(this.state.currentUser, orgId);
    return this.state.leads.filter((l) => l.organizationId === orgId);
  }

  createLead(leadData: Omit<Lead, 'id' | 'organizationId' | 'score' | 'createdAt' | 'updatedAt' | 'followupCount' | 'optedOut'>): Lead {
    assertPermission(this.state.currentUser.role, 'leads:write');
    const orgId = this.state.currentOrg.id;
    const score = calculateLeadScore(leadData);

    const newLead: Lead = {
      ...leadData,
      id: `lead-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      organizationId: orgId,
      score,
      followupCount: 0,
      optedOut: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.leads.unshift(newLead);
    this.logAudit(orgId, this.state.currentUser.id, this.state.currentUser.name, 'LEAD_CREATED', 'Lead', newLead.id, `Created lead ${newLead.name}`);
    this.saveState();
    return newLead;
  }

  updateLead(leadId: string, patch: Partial<Lead>): Lead {
    assertPermission(this.state.currentUser.role, 'leads:write');
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error('Lead not found.');

    assertTenantAccess(this.state.currentUser, lead.organizationId);

    // If opted out, mark status
    if (patch.optedOut) {
      patch.status = 'DO_NOT_CONTACT';
    }

    Object.assign(lead, patch, { updatedAt: new Date().toISOString() });
    if (patch.phone || patch.serviceRequested || patch.urgency) {
      lead.score = calculateLeadScore(lead);
    }

    this.logAudit(lead.organizationId, this.state.currentUser.id, this.state.currentUser.name, 'LEAD_UPDATED', 'Lead', lead.id, `Updated lead status to ${lead.status}`);
    this.saveState();
    return lead;
  }

  deleteLead(leadId: string): void {
    assertPermission(this.state.currentUser.role, 'leads:delete');
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error('Lead not found.');

    assertTenantAccess(this.state.currentUser, lead.organizationId);

    this.state.leads = this.state.leads.filter((l) => l.id !== leadId);
    this.logAudit(lead.organizationId, this.state.currentUser.id, this.state.currentUser.name, 'LEAD_DELETED', 'Lead', leadId, `Deleted lead record.`);
    this.saveState();
  }

  // --- Appointments ---
  getAppointments(targetOrgId?: string): Appointment[] {
    const orgId = targetOrgId || this.state.currentOrg.id;
    assertTenantAccess(this.state.currentUser, orgId);
    return this.state.appointments.filter((a) => a.organizationId === orgId);
  }

  createAppointment(aptData: Omit<Appointment, 'id' | 'organizationId' | 'createdAt'>): Appointment {
    assertPermission(this.state.currentUser.role, 'appointments:manage');
    const orgId = this.state.currentOrg.id;

    const newApt: Appointment = {
      ...aptData,
      id: `apt-${Date.now()}`,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
    };

    this.state.appointments.push(newApt);
    this.saveState();
    return newApt;
  }

  // --- Automations ---
  getAutomations(targetOrgId?: string): AutomationRule[] {
    const orgId = targetOrgId || this.state.currentOrg.id;
    assertTenantAccess(this.state.currentUser, orgId);
    return this.state.automations.filter((a) => a.organizationId === orgId);
  }

  toggleAutomation(ruleId: string): void {
    assertPermission(this.state.currentUser.role, 'automations:manage');
    const rule = this.state.automations.find((r) => r.id === ruleId);
    if (!rule) return;
    assertTenantAccess(this.state.currentUser, rule.organizationId);
    rule.enabled = !rule.enabled;
    this.saveState();
  }

  recordAutomationRun(run: AutomationRun) {
    this.state.automationRuns.unshift(run);
    if (this.state.automationRuns.length > 50) this.state.automationRuns.pop();
    this.saveState();
  }

  // --- Team & Permissions ---
  inviteTeamMember(name: string, email: string, role: UserRole): User {
    assertPermission(this.state.currentUser.role, 'team:manage');
    const orgId = this.state.currentOrg.id;
    const newUser: User & { passwordHash: string } = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      passwordHash: 'h_demo123',
    };
    this.state.users.push(newUser);
    this.logAudit(orgId, this.state.currentUser.id, this.state.currentUser.name, 'USER_INVITED', 'User', newUser.id, `Invited ${name} (${role}) to practice team.`);
    this.saveState();
    return newUser;
  }

  createAutomationRule(ruleData: Omit<AutomationRule, 'id' | 'organizationId' | 'executionCount'>): AutomationRule {
    assertPermission(this.state.currentUser.role, 'automations:manage');
    const orgId = this.state.currentOrg.id;
    const newRule: AutomationRule = {
      ...ruleData,
      id: `rule-${Date.now()}`,
      organizationId: orgId,
      executionCount: 0,
    };
    this.state.automations.push(newRule);
    this.logAudit(orgId, this.state.currentUser.id, this.state.currentUser.name, 'AUTOMATION_CREATED', 'AutomationRule', newRule.id, `Created rule: ${newRule.name}`);
    this.saveState();
    return newRule;
  }

  resolveHandoff(notificationId?: string) {
    if (notificationId) {
      const n = this.state.notifications.find((notif) => notif.id === notificationId);
      if (n) n.read = true;
    } else {
      this.state.notifications.forEach((n) => {
        n.read = true;
      });
    }
    this.saveState();
  }

  // --- Knowledge Base ---
  getKnowledge(targetOrgId?: string): KnowledgeDocument[] {
    const orgId = targetOrgId || this.state.currentOrg.id;
    assertTenantAccess(this.state.currentUser, orgId);
    return this.state.knowledge.filter((k) => k.organizationId === orgId);
  }

  updateKnowledge(docId: string, content: string): void {
    assertPermission(this.state.currentUser.role, 'knowledge:manage');
    const doc = this.state.knowledge.find((k) => k.id === docId);
    if (!doc) return;
    assertTenantAccess(this.state.currentUser, doc.organizationId);
    doc.content = content;
    doc.updatedAt = new Date().toISOString();
    this.saveState();
  }

  // --- Agency & Prospects ---
  getProspects(): Prospect[] {
    return this.state.prospects;
  }

  createProspect(prospect: Prospect): Prospect {
    this.state.prospects.unshift(prospect);
    this.saveState();
    return prospect;
  }

  updateProspectStage(prospectId: string, stage: Prospect['stage']): void {
    const p = this.state.prospects.find((pr) => pr.id === prospectId);
    if (p) {
      p.stage = stage;
      p.lastContactedAt = new Date().toISOString();
      this.saveState();
    }
  }

  approveOutreach(prospectId: string): void {
    const p = this.state.prospects.find((pr) => pr.id === prospectId);
    if (p && p.outreachDraft) {
      p.outreachDraft.approvedByHuman = true;
      p.outreachDraft.sentAt = new Date().toISOString();
      p.stage = 'CONTACTED';
      p.lastContactedAt = new Date().toISOString();
      this.saveState();
    }
  }

  saveProposal(proposal: Proposal) {
    this.state.proposals.push(proposal);
    this.saveState();
  }

  // --- Audit Logging ---
  private logAudit(
    organizationId: string,
    userId: string,
    userName: string,
    action: string,
    entityType: string,
    entityId: string,
    details: string
  ) {
    this.state.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      organizationId,
      userId,
      userName,
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    });
    if (this.state.auditLogs.length > 100) this.state.auditLogs.pop();
  }

  getAgencySettings(): AgencySettings {
    return this.state.agencySettings;
  }

  updateAgencySettings(patch: Partial<AgencySettings>) {
    Object.assign(this.state.agencySettings, patch);
    this.saveState();
  }
}

export const appStore = new AppStore();
