/** API response shapes (dates arrive as ISO strings). */

export type Role = 'OWNER' | 'ADMIN' | 'STAFF' | 'VIEWER';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'BOOKED' | 'WON' | 'LOST' | 'DO_NOT_CONTACT';
export type Tier = 'HIGH' | 'MEDIUM' | 'LOW';
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type OutboundStatus = 'PENDING' | 'SENDING' | 'SENT' | 'LOGGED' | 'SKIPPED' | 'FAILED';
export type Category = 'PROCEDURE' | 'CONDITION' | 'EMERGENCY' | 'AFTERCARE' | 'FAQ' | 'POLICY';
export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type WeeklyHours = Record<DayKey, [string, string][]>;

export interface Me {
  user: { id: string; email: string; name: string; role: Role };
  org: { id: string; name: string; publicKey: string; isDemo: boolean; plan: string; planStatus: string; timezone: string };
}

export interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  serviceInterest: string | null;
  status: LeadStatus;
  score: number;
  tier: Tier;
  scoreReasons: string[];
  estimatedValue: number;
  urgent: boolean;
  source: string;
  notes: string | null;
  optedOut: boolean;
  /** Wants an earlier appointment if one opens up. */
  waitlist: boolean;
  lastActivityAt: string;
  createdAt: string;
}

export interface MessageMeta {
  intent?: string;
  confidence?: number;
  skill?: string;
  sources?: { slug: string; title: string }[];
  safety?: string;
  safetyReason?: string;
  unanswered?: boolean;
  suggestions?: string[];
  /** Set when Claude wrote the answer: the model and what the built-in engine had drafted. */
  llm?: { model: string; ms: number; answered: boolean; builtin?: string };
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'visitor' | 'assistant';
  body: string;
  meta: MessageMeta;
  createdAt: string;
}

export interface Conversation {
  id: string;
  status: 'OPEN' | 'ESCALATED' | 'CLOSED';
  needsAttention: boolean;
  attentionReason: string | null;
  messageCount: number;
  createdAt: string;
  lastMessageAt: string;
  pageUrl: string | null;
  leadId: string | null;
  leadName?: string | null;
  leadTier?: Tier | null;
  preview?: string;
}

export interface Appointment {
  id: string;
  leadId: string | null;
  startsAt: string;
  endsAt: string;
  service: string;
  status: AppointmentStatus;
  notes: string | null;
  source: string;
  /** When the patient confirmed from a reminder email. */
  patientConfirmedAt: string | null;
  createdAt: string;
  leadName?: string | null;
  leadPhone?: string | null;
  leadEmail?: string | null;
}

export type OutboundKind = 'FOLLOWUP' | 'STAFF_ALERT' | 'CONFIRMATION' | 'REMINDER' | 'RECALL' | 'NO_SHOW' | 'REVIEW' | 'REACTIVATION' | 'WAITLIST' | 'DIGEST';

export interface Automations {
  reminders: { enabled: boolean; hoursBefore: number[] };
  recall: { enabled: boolean; months: number };
  noShow: { enabled: boolean };
  reviews: { enabled: boolean; url: string | null; delayHours: number };
  reactivation: { enabled: boolean; afterDays: number };
  waitlist: { enabled: boolean };
  digest: { enabled: boolean; hour: number };
}

export interface Outbound {
  id: string;
  leadId: string | null;
  kind: OutboundKind;
  step: number | null;
  toAddress: string;
  subject: string;
  body: string;
  status: OutboundStatus;
  statusReason: string | null;
  scheduledFor: string;
  sentAt: string | null;
  leadName?: string | null;
}

export interface Article {
  id: string;
  slug: string;
  category: Category;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  service: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  caseValue: number | null;
  published: boolean;
  /** library: kept up to date automatically; edited: a library article the clinic reworded; custom: the clinic's own. */
  source: 'library' | 'edited' | 'custom';
  references: { name: string; url: string }[];
  updatedAt: string;
}

export interface Settings {
  id: string;
  name: string;
  slug: string;
  publicKey: string;
  phone: string | null;
  email: string | null;
  notificationEmail: string | null;
  website: string | null;
  address: string | null;
  timezone: string;
  hours: WeeklyHours;
  slotMinutes: number;
  minNoticeHours: number;
  greeting: string | null;
  emergencyInstructions: string | null;
  followupsEnabled: boolean;
  /** Let Claude answer open questions (only takes effect when the server has Claude). */
  claudeEnabled: boolean;
  /** Present when the server has an Anthropic API key. */
  claude?: { model: string } | null;
  automations: Automations;
  plan: string;
  planStatus: string;
  isDemo: boolean;
  emailLive?: boolean;
  publicUrl?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Overview {
  days: number;
  kpis: {
    conversations: number;
    leads: number;
    highIntent: number;
    appointmentsRequested: number;
    bookingRate: number;
    pipelineValue: number;
    followupsSent: number;
    answerRate: number;
  };
  series: { day: string; conversations: number; leads: number }[];
  attention: {
    id: string;
    status: string;
    reason: string | null;
    lastMessageAt: string;
    leadId: string | null;
    leadName: string | null;
    leadPhone: string | null;
  }[];
  recentLeads: Lead[];
  upcoming: Appointment[];
  unanswered: { conversationId: string; question: string; createdAt: string }[];
}

export interface Plan {
  id: string;
  name: string;
  monthlyFee: number;
  setupFee: number;
  description: string;
  features: string[];
}
