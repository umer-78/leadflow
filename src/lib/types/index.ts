/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string;
  website?: string;
  phone?: string;
  address?: string;
  status: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED';
  planId: 'starter' | 'growth' | 'pro';
  monthlyFee: number;
  setupFee: number;
  widgetId: string;
  widgetColor: string;
  aiGreeting: string;
  qualificationQuestions: string[];
  businessHours: string;
  services: ServiceItem[];
  createdAt: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: string;
  price: string;
  duration: string;
  description: string;
  highValue: boolean;
}

export type LeadStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'CONTACTED'
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_BOOKED'
  | 'WON'
  | 'LOST'
  | 'DO_NOT_CONTACT';

export type LeadScoreTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LeadScore {
  tier: LeadScoreTier;
  score: number;
  reasons: string[];
}

export interface Lead {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  serviceRequested: string;
  preferredDate?: string;
  preferredTime?: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  notes: string;
  status: LeadStatus;
  score: LeadScore;
  source: string;
  assignedStaffId?: string;
  estimatedValue: number;
  lastContactedAt?: string;
  followupScheduledAt?: string;
  followupCount: number;
  optedOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  organizationId: string;
  eventType: 'CREATED' | 'QUALIFIED' | 'CONTACTED' | 'APPOINTMENT_REQUESTED' | 'FOLLOWUP_SENT' | 'NOTE_ADDED' | 'STATUS_CHANGED';
  description: string;
  actor: 'AI' | 'STAFF' | 'SYSTEM';
  timestamp: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'VISITOR' | 'AI' | 'STAFF';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    extractedLeadInfo?: Partial<Lead>;
    confidenceScore?: number;
    requiresHandoff?: boolean;
    sourcesUsed?: string[];
  };
}

export interface Conversation {
  id: string;
  organizationId: string;
  leadId?: string;
  visitorName?: string;
  status: 'ACTIVE' | 'HANDOFF_REQUESTED' | 'HANDOFF_RESOLVED' | 'CLOSED';
  messages: Message[];
  startedAt: string;
  lastMessageAt: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'FRUSTRATED';
}

export interface KnowledgeDocument {
  id: string;
  organizationId: string;
  title: string;
  category: 'SERVICES' | 'PRICING' | 'FAQS' | 'POLICIES' | 'PROCEDURES' | 'HOURS';
  content: string;
  chunks: KnowledgeChunk[];
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  organizationId: string;
  heading: string;
  content: string;
  keywords: string[];
}

export type AutomationTrigger =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.qualified'
  | 'lead.replied'
  | 'appointment.requested'
  | 'appointment.booked'
  | 'message.failed'
  | 'subscription.created'
  | 'subscription.cancelled';

export type AutomationActionType =
  | 'send_initial_response'
  | 'schedule_followup'
  | 'notify_client'
  | 'update_lead'
  | 'create_appointment_request';

export interface AutomationRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  condition: string;
  actions: {
    type: AutomationActionType;
    params: Record<string, any>;
  }[];
  enabled: boolean;
  executionCount: number;
}

export interface AutomationRun {
  id: string;
  ruleId: string;
  ruleName: string;
  organizationId: string;
  targetLeadId?: string;
  targetLeadName?: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED';
  actionTaken: string;
  timestamp: string;
  details?: string;
}

export interface Appointment {
  id: string;
  organizationId: string;
  leadId: string;
  leadName: string;
  service: string;
  dateTime: string;
  durationMinutes: number;
  status: 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  providerStaffName?: string;
  createdAt: string;
}

export type ProspectStage =
  | 'PROSPECT'
  | 'RESEARCHED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'DEMO'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'WON'
  | 'LOST';

export interface Prospect {
  id: string;
  organizationId?: string;
  businessName: string;
  website: string;
  industry: string;
  country: string;
  contactName: string;
  email: string;
  phone: string;
  stage: ProspectStage;
  identifiedProblem: string;
  verifiedObservations: string[];
  outreachDraft?: {
    subject: string;
    body: string;
    approvedByHuman: boolean;
    sentAt?: string;
  };
  estimatedDealValue: number;
  lastContactedAt?: string;
  nextFollowupDate?: string;
  notes: string;
  demoSlug?: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  prospectId: string;
  businessName: string;
  contactName: string;
  packageTier: 'STARTER' | 'GROWTH' | 'PRO';
  setupFee: number;
  monthlyFee: number;
  targetPainPoints: string[];
  deliverables: string[];
  status: 'DRAFT' | 'REVIEWED' | 'SENT' | 'ACCEPTED' | 'DECLINED';
  validUntil: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  type: 'LEAD_URGENT' | 'HANDOFF' | 'APPOINTMENT' | 'AUTOMATION_ALERT' | 'BILLING';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface SystemHealthState {
  database: 'HEALTHY' | 'DEGRADED' | 'ERROR';
  aiGateway: 'HEALTHY' | 'DEGRADED' | 'FALLBACK_ACTIVE';
  geminiApi: 'HEALTHY' | 'NOT_CONFIGURED' | 'ERROR';
  cloudPlatform: 'HEALTHY' | 'DEGRADED';
  automationEngine: 'HEALTHY' | 'DEGRADED' | 'ERROR';
  billing: 'MOCK_HEALTHY' | 'PRODUCTION_ACTIVE' | 'ERROR';
  emailService: 'MOCK_HEALTHY' | 'SMTP_HEALTHY' | 'ERROR';
  lastChecked: string;
}

export interface AgencySettings {
  agencyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  customDomain: string;
  stripeStarterLink: string;
  stripeGrowthLink: string;
  stripeProLink: string;
  currency: string;
}

