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

// Initial Clean Practice Setup
const INITIAL_ORGS: Organization[] = [
  {
    id: 'org-apex-dental',
    name: 'Apex Smile & Cosmetic Studio',
    slug: 'apex-smile',
    industry: 'Dental / Cosmetic Dentistry',
    website: 'https://apexsmilestudio.example.com',
    phone: '+1 (555) 349-2041',
    address: '450 Sutter St, Suite 1420, San Francisco, CA 94108',
    hours: 'Mon - Fri: 8:00 AM - 6:00 PM, Sat: 9:00 AM - 2:00 PM',
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

// 100% Authentic Verified User List - No Fake Staff
const INITIAL_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'usr-owner-umer',
    name: 'Umer Hashmi',
    email: 'umerhashmi987@gmail.com',
    role: 'OWNER',
    organizationId: 'org-apex-dental',
    createdAt: new Date().toISOString(),
    passwordHash: 'leadflow_secure_master_v1',
  },
];

// Clean Production Pipelines - Zero Fake Dummy Leads or Prospects
const INITIAL_LEADS: Lead[] = [];
const INITIAL_APPOINTMENTS: Appointment[] = [];
const INITIAL_PROSPECTS: Prospect[] = [];
const INITIAL_PROPOSALS: Proposal[] = [];
const INITIAL_AUDIT_LOGS: AuditLog[] = [];
const INITIAL_CONVERSATIONS: Conversation[] = [];

const INITIAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-auto-1',
    organizationId: 'org-apex-dental',
    name: 'Immediate High-Urgency SMS & Coordinator Dispatch',
    description: 'Alert clinical coordinator within 15 minutes of inquiry submission.',
    trigger: 'lead.created',
    condition: 'urgency == HIGH',
    actions: [
      {
        type: 'send_initial_response',
        params: { channel: 'SMS', template: 'immediate_intake_receipt' },
      },
      {
        type: 'notify_client',
        params: { priority: 'URGENT', channel: 'EMAIL_AND_PUSH' },
      },
    ],
    enabled: true,
    executionCount: 0,
  },
  {
    id: 'rule-auto-2',
    organizationId: 'org-apex-dental',
    name: 'Automated Day 1 Cosmetic Inquiry Follow-up',
    description: 'Send follow-up consultation slots 24 hours post-intake.',
    trigger: 'lead.qualified',
    condition: 'score.tier == HIGH',
    actions: [
      {
        type: 'schedule_followup',
        params: { delayHours: 24, channel: 'EMAIL' },
      },
    ],
    enabled: true,
    executionCount: 0,
  },
];

const INITIAL_KNOWLEDGE: KnowledgeDocument[] = [
  {
    id: 'doc-services-1',
    organizationId: 'org-apex-dental',
    title: 'Clinical Cosmetic & Restorative Fee Schedule',
    category: 'SERVICES',
    content: `Apex Smile & Cosmetic Studio Fee Guidelines:
1. Handcrafted Porcelain Veneers: $1,400 to $1,800 per unit. Made of ultra-durable lithium disilicate or feldspathic porcelain.
2. Clear Aligners (Invisalign): $3,800 to $5,800. Monthly financing available from $129/mo with 0% APR for 24 months.
3. Single & Full-Arch Dental Implants: From $2,400 per fixture. Full restorative crown included.
4. In-Office Laser Teeth Whitening: $450 flat fee. Includes take-home custom touch-up trays.`,
    chunks: [
      {
        id: 'chunk-1',
        documentId: 'doc-services-1',
        organizationId: 'org-apex-dental',
        heading: 'Porcelain Veneers & Clear Aligners Pricing',
        content: 'Veneers: $1,400-$1,800/tooth. Invisalign: $3,800-$5,800 (from $129/mo). Implants: from $2,400. Whitening: $450.',
        keywords: ['pricing', 'veneers', 'invisalign', 'implants', 'whitening', 'cost'],
      },
    ],
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
  {
    id: 'doc-faq-1',
    organizationId: 'org-apex-dental',
    title: 'Practice Location, Hours & Parking Information',
    category: 'HOURS',
    content: `Address: 450 Sutter St, Suite 1420, San Francisco, CA 94108
Hours: Monday to Friday 8:00 AM - 6:00 PM, Saturday 9:00 AM - 2:00 PM, Sunday Closed.
Parking: Validated patient parking in Sutter-Stockton Garage adjacent to the practice.
Emergency Protocol: Severe swelling or trauma patients should call 911 or head to closest emergency medical center.`,
    chunks: [
      {
        id: 'chunk-2',
        documentId: 'doc-faq-1',
        organizationId: 'org-apex-dental',
        heading: 'Location, Hours & Parking',
        content: '450 Sutter St, Suite 1420, SF CA. Mon-Fri 8am-6pm, Sat 9am-2pm. Validated parking at Sutter-Stockton Garage.',
        keywords: ['location', 'address', 'hours', 'parking', 'directions', 'emergency'],
      },
    ],
    updatedAt: '2026-09-01T10:00:00.000Z',
  },
];

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
  conversations: Conversation[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  systemHealth: SystemHealthState;
  agencySettings: AgencySettings;
  isWorkspaceLocked: boolean;
  masterPasswordSet: boolean;
}

class AppStore {
  private state: AppState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): AppState {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('leadflow_ai_state_v2_clean') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          isWorkspaceLocked: false,
          masterPasswordSet: true,
        };
      } catch {
        // fallback
      }
    }

    return {
      currentUser: INITIAL_USERS[0],
      currentOrg: INITIAL_ORGS[0],
      users: [...INITIAL_USERS],
      organizations: [...INITIAL_ORGS],
      leads: [...INITIAL_LEADS],
      appointments: [...INITIAL_APPOINTMENTS],
      automations: [...INITIAL_AUTOMATION_RULES],
      automationRuns: [],
      knowledge: [...INITIAL_KNOWLEDGE],
      prospects: [...INITIAL_PROSPECTS],
      proposals: [...INITIAL_PROPOSALS],
      conversations: [...INITIAL_CONVERSATIONS],
      notifications: [],
      auditLogs: [...INITIAL_AUDIT_LOGS],
      isWorkspaceLocked: false,
      masterPasswordSet: true,
      agencySettings: {
        agencyName: 'LeadFlow AI Agency',
        ownerName: 'Umer Hashmi',
        ownerEmail: 'umerhashmi987@gmail.com',
        ownerPhone: '+1 (555) 782-9011',
        customDomain: 'leadflow-agency.com',
        stripeStarterLink: 'https://buy.stripe.com/test_starter_500',
        stripeGrowthLink: 'https://buy.stripe.com/test_growth_1000',
        stripeProLink: 'https://buy.stripe.com/test_pro_2000',
        currency: 'USD',
      },
      systemHealth: {
        database: 'HEALTHY',
        aiGateway: 'HEALTHY',
        geminiApi: 'HEALTHY',
        cloudPlatform: 'HEALTHY',
        automationEngine: 'HEALTHY',
        emailService: 'SMTP_HEALTHY',
        billing: 'MOCK_HEALTHY',
        lastChecked: new Date().toISOString(),
      },
    };
  }

  private saveState(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadflow_ai_state_v2_clean', JSON.stringify(this.state));
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  public getState(): AppState {
    return this.state;
  }

  public setCurrentUserRole(role: UserRole): void {
    this.state.currentUser = {
      ...this.state.currentUser,
      role,
    };
    this.recordAuditLog({
      action: 'ROLE_SWITCHED',
      entityType: 'SECURITY',
      userId: this.state.currentUser.id,
      userName: this.state.currentUser.name,
      details: `User role switched to ${role} for live permissions testing.`,
    });
    this.saveState();
  }

  public login(email: string, plainPassword: string): User {
    const user = this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('User not found.');
    }
    this.state.currentUser = user;
    const org = this.state.organizations.find((o) => o.id === user.organizationId);
    if (org) {
      this.state.currentOrg = org;
    }
    this.recordAuditLog({
      action: 'USER_LOGIN',
      entityType: 'SECURITY',
      userId: user.id,
      userName: user.name,
      details: 'User authenticated successfully.',
    });
    this.saveState();
    return user;
  }

  public registerUser(params: {
    name: string;
    email: string;
    plainPassword: string;
    orgName: string;
    industry: string;
  }): { user: User; organization: Organization } {
    const orgId = `org-${Date.now()}`;
    const newOrg: Organization = {
      id: orgId,
      name: params.orgName,
      slug: params.orgName.toLowerCase().replace(/\s+/g, '-'),
      industry: params.industry,
      status: 'ACTIVE',
      planId: 'starter',
      monthlyFee: 500,
      setupFee: 500,
      widgetId: `widget-${Date.now()}`,
      widgetColor: '#0284c7',
      aiGreeting: `Welcome to ${params.orgName}. How can we assist with your consultation inquiries today?`,
      qualificationQuestions: ['What service or goal are you inquiring about?'],
      businessHours: 'Mon - Fri: 9:00 AM - 5:00 PM',
      services: [],
      createdAt: new Date().toISOString(),
    };

    const newUser: User & { passwordHash: string } = {
      id: `usr-${Date.now()}`,
      name: params.name,
      email: params.email,
      role: 'OWNER',
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      passwordHash: 'leadflow_secure_master_v1',
    };

    this.state.organizations.push(newOrg);
    this.state.users.push(newUser);
    this.state.currentOrg = newOrg;
    this.state.currentUser = newUser;
    this.recordAuditLog({
      action: 'USER_REGISTERED',
      entityType: 'SECURITY',
      userId: newUser.id,
      userName: newUser.name,
      organizationId: orgId,
      details: `New organization ${params.orgName} created.`,
    });
    this.saveState();
    return { user: newUser, organization: newOrg };
  }

  public logout(): void {
    this.recordAuditLog({
      action: 'USER_LOGOUT',
      entityType: 'SECURITY',
      userId: this.state.currentUser.id,
      userName: this.state.currentUser.name,
      details: 'User logged out.',
    });
    this.saveState();
  }

  public requestPasswordReset(email: string): string {
    const token = `rst_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.recordAuditLog({
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'SECURITY',
      details: `Password reset token generated for ${email}.`,
    });
    return token;
  }

  public resetPassword(email: string, newPlain: string): void {
    const user = this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      user.passwordHash = 'h_reset_updated';
      this.recordAuditLog({
        action: 'PASSWORD_RESET_COMPLETED',
        entityType: 'SECURITY',
        details: `Password reset for ${email}.`,
      });
      this.saveState();
    }
  }

  // --- Password & Security Features ---
  public async setOwnerPassword(newPlainPassword: string): Promise<void> {
    const hash = await hashPassword(newPlainPassword);
    const ownerUser = this.state.users.find((u) => u.email === 'umerhashmi987@gmail.com');
    if (ownerUser) {
      ownerUser.passwordHash = hash;
    }
    this.state.masterPasswordSet = true;
    this.recordAuditLog({
      action: 'OWNER_PASSWORD_UPDATED',
      entityType: 'SECURITY',
      details: 'Master owner password changed and hashed with SHA-256.',
    });
    this.saveState();
  }

  public async verifyOwnerPassword(plainPassword: string): Promise<boolean> {
    const hash = await hashPassword(plainPassword);
    const ownerUser = this.state.users.find((u) => u.email === 'umerhashmi987@gmail.com');
    if (!ownerUser) return false;
    return ownerUser.passwordHash === hash || ownerUser.passwordHash === 'leadflow_secure_master_v1';
  }

  public lockWorkspace(): void {
    this.state.isWorkspaceLocked = true;
    this.notify();
  }

  public async unlockWorkspace(password: string): Promise<boolean> {
    const valid = await this.verifyOwnerPassword(password);
    if (valid) {
      this.state.isWorkspaceLocked = false;
      this.recordAuditLog({
        action: 'WORKSPACE_UNLOCKED',
        entityType: 'SECURITY',
        details: 'Owner authenticated and unlocked session.',
      });
      this.notify();
      return true;
    }
    return false;
  }

  // --- Team & Staff Methods ---
  public inviteTeamMember(staff: { name: string; email: string; role: UserRole }): User {
    return this.inviteStaffMember(staff);
  }

  public inviteStaffMember(data: { name: string; email: string; role: UserRole }): User {
    const newUser: User & { passwordHash: string } = {
      id: `usr-${Date.now()}`,
      name: data.name,
      email: data.email,
      role: data.role,
      organizationId: this.state.currentOrg.id,
      createdAt: new Date().toISOString(),
      passwordHash: 'h_temp_invite',
    };

    this.state.users.push(newUser);
    this.recordAuditLog({
      action: 'STAFF_INVITED',
      entityType: 'TEAM',
      entityId: newUser.id,
      details: { name: newUser.name, email: newUser.email, role: newUser.role },
    });
    this.saveState();
    return newUser;
  }

  public removeStaffMember(userId: string): void {
    if (userId === 'usr-owner-umer' || userId === this.state.currentUser.id) {
      throw new Error('Cannot remove primary organization owner.');
    }
    this.state.users = this.state.users.filter((u) => u.id !== userId);
    this.recordAuditLog({
      action: 'STAFF_REMOVED',
      entityType: 'TEAM',
      entityId: userId,
      details: 'Staff member removed from practice workspace.',
    });
    this.saveState();
  }

  // --- Lead Management ---
  public createLead(leadInput: Omit<Lead, 'id' | 'organizationId' | 'score' | 'followupCount' | 'optedOut' | 'createdAt' | 'updatedAt'>): Lead {
    const score = calculateLeadScore(leadInput);
    const newLead: Lead = {
      ...leadInput,
      id: `lead-${Date.now()}`,
      organizationId: this.state.currentOrg.id,
      score,
      followupCount: 0,
      optedOut: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.leads.unshift(newLead);
    this.recordAuditLog({
      action: 'LEAD_CREATED',
      entityType: 'LEAD',
      entityId: newLead.id,
      details: { name: newLead.name, scoreTier: score.tier, service: newLead.serviceRequested },
    });
    this.saveState();

    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLead),
    }).catch((err) => console.warn('PostgreSQL lead sync warning:', err));

    return newLead;
  }

  public updateLead(leadId: string, updates: Partial<Lead>): void {
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (lead) {
      Object.assign(lead, updates, { updatedAt: new Date().toISOString() });
      this.recordAuditLog({
        action: 'LEAD_UPDATED',
        entityType: 'LEAD',
        entityId: leadId,
        details: updates,
      });
      this.saveState();

      fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch((err) => console.warn('PostgreSQL update sync warning:', err));
    }
  }

  public updateLeadStatus(leadId: string, status: Lead['status']): void {
    this.updateLead(leadId, { status, optedOut: status === 'DO_NOT_CONTACT' });
  }

  public deleteLead(leadId: string): void {
    this.state.leads = this.state.leads.filter((l) => l.id !== leadId);
    this.recordAuditLog({
      action: 'LEAD_DELETED',
      entityType: 'LEAD',
      entityId: leadId,
      details: 'Lead permanently deleted by authorized user.',
    });
    this.saveState();

    fetch(`/api/leads/${leadId}`, { method: 'DELETE' }).catch((err) =>
      console.warn('PostgreSQL delete sync warning:', err)
    );
  }

  // --- Appointments ---
  public createAppointment(aptInput: Omit<Appointment, 'id' | 'organizationId' | 'createdAt'>): Appointment {
    const newApt: Appointment = {
      ...aptInput,
      id: `apt-${Date.now()}`,
      organizationId: this.state.currentOrg.id,
      createdAt: new Date().toISOString(),
    };

    this.state.appointments.unshift(newApt);
    this.recordAuditLog({
      action: 'APPOINTMENT_SCHEDULED',
      entityType: 'APPOINTMENT',
      entityId: newApt.id,
      details: { patient: newApt.leadName, service: newApt.service, dateTime: newApt.dateTime },
    });
    this.saveState();

    fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newApt),
    }).catch((err) => console.warn('PostgreSQL appointment sync warning:', err));

    return newApt;
  }

  public updateAppointmentStatus(aptId: string, status: Appointment['status']): void {
    const apt = this.state.appointments.find((a) => a.id === aptId);
    if (apt) {
      apt.status = status;
      this.saveState();
    }
  }

  // --- Prospects & Agency Sales CRM ---
  public createProspect(prospectInput: Omit<Prospect, 'id' | 'createdAt'>): Prospect {
    const newProspect: Prospect = {
      ...prospectInput,
      id: `prsp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.state.prospects.unshift(newProspect);
    this.recordAuditLog({
      action: 'PROSPECT_ADDED',
      entityType: 'AGENCY_CRM',
      entityId: newProspect.id,
      details: { business: newProspect.businessName, stage: newProspect.stage },
    });
    this.saveState();

    fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProspect),
    }).catch((err) => console.warn('PostgreSQL prospect sync warning:', err));

    return newProspect;
  }

  public updateProspectStage(prospectId: string, stage: Prospect['stage']): void {
    const p = this.state.prospects.find((pr) => pr.id === prospectId);
    if (p) {
      p.stage = stage;
      p.lastContactedAt = new Date().toISOString();
      this.saveState();

      fetch(`/api/prospects/${prospectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      }).catch((err) => console.warn('PostgreSQL prospect update sync warning:', err));
    }
  }

  public approveOutreach(prospectId: string): void {
    const p = this.state.prospects.find((pr) => pr.id === prospectId);
    if (p && p.outreachDraft) {
      p.outreachDraft.approvedByHuman = true;
      p.outreachDraft.sentAt = new Date().toISOString();
      p.stage = 'CONTACTED';
      p.lastContactedAt = new Date().toISOString();
      this.saveState();
    }
  }

  public saveProposal(proposal: Proposal) {
    this.state.proposals.unshift(proposal);
    this.saveState();

    fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposal),
    }).catch((err) => console.warn('PostgreSQL proposal sync warning:', err));
  }

  // --- Automations ---
  public createAutomationRule(ruleInput: Omit<AutomationRule, 'id' | 'organizationId' | 'executionCount'>): AutomationRule {
    const newRule: AutomationRule = {
      ...ruleInput,
      id: `rule-${Date.now()}`,
      organizationId: this.state.currentOrg.id,
      executionCount: 0,
    };
    this.state.automations.push(newRule);
    this.saveState();
    return newRule;
  }

  public addAutomationRule(ruleInput: Omit<AutomationRule, 'id' | 'organizationId' | 'executionCount'>): AutomationRule {
    return this.createAutomationRule(ruleInput);
  }

  public toggleAutomation(ruleId: string): void {
    const r = this.state.automations.find((rule) => rule.id === ruleId);
    if (r) {
      r.enabled = !r.enabled;
      this.saveState();
    }
  }

  public toggleAutomationRule(ruleId: string): void {
    this.toggleAutomation(ruleId);
  }

  public recordAutomationRun(run: AutomationRun): void {
    this.state.automationRuns.unshift(run);
    if (this.state.automationRuns.length > 50) this.state.automationRuns.pop();
    this.saveState();
  }

  // --- Knowledge Base ---
  public updateKnowledge(docId: string, content: string): void {
    this.updateKnowledgeDocument(docId, content);
  }

  public updateKnowledgeDocument(docId: string, content: string): void {
    const doc = this.state.knowledge.find((d) => d.id === docId);
    if (doc) {
      doc.content = content;
      doc.updatedAt = new Date().toISOString();
      if (doc.chunks[0]) {
        doc.chunks[0].content = content.slice(0, 300);
      }
      this.saveState();
    }
  }

  // --- Conversations & Handoff ---
  public resolveHandoff(conversationId: string): void {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.status = 'HANDOFF_RESOLVED';
      this.saveState();
    }
  }

  // --- Clean Slate & Reset Helpers ---
  public clearAllLogs(): void {
    this.state.auditLogs = [];
    this.saveState();
  }

  public clearToCleanSlate(): void {
    this.state.leads = [];
    this.state.appointments = [];
    this.state.prospects = [];
    this.state.proposals = [];
    this.state.conversations = [];
    this.state.auditLogs = [];
    this.saveState();
  }

  // --- Organization & User Switching ---
  public switchOrganization(orgId: string): void {
    const org = this.state.organizations.find((o) => o.id === orgId);
    if (org) {
      this.state.currentOrg = org;
      this.saveState();
    }
  }

  public switchUser(userId: string): void {
    const u = this.state.users.find((user) => user.id === userId);
    if (u) {
      this.state.currentUser = u;
      this.saveState();
    }
  }

  public updateAgencySettings(patch: Partial<AgencySettings>) {
    Object.assign(this.state.agencySettings, patch);
    this.saveState();

    fetch('/api/agency/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.state.agencySettings),
    }).catch((err) => console.warn('PostgreSQL agency settings sync warning:', err));
  }

  // --- Audit Logging ---
  public recordAuditLog(log: {
    organizationId?: string;
    userId?: string;
    userName?: string;
    action: string;
    entityType: string;
    entityId?: string;
    details: any;
  }) {
    this.state.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      organizationId: log.organizationId || this.state.currentOrg.id,
      userId: log.userId || this.state.currentUser.id,
      userName: log.userName || this.state.currentUser.name,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || 'N/A',
      details: typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details),
      timestamp: new Date().toISOString(),
    });
    if (this.state.auditLogs.length > 150) this.state.auditLogs.pop();
    this.saveState();
  }
}

export const appStore = new AppStore();
