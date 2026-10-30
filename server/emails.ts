/**
 * Email content: patient follow-ups (written from the clinic's own knowledge
 * base, so every email carries real information), appointment confirmations
 * and staff alerts.
 */
import { SearchIndex, formatPhone } from '../packages/localbrain/src/index.ts';
import type { KnowledgeArticle, Lead, Organization } from './db/schema.ts';
import { SYNONYMS } from './knowledge/library.ts';

export interface RenderedEmail {
  subject: string;
  text: string;
}

export interface FollowupContext {
  org: Organization;
  lead: Lead;
  /** Article for the lead's service of interest, if any. */
  article?: KnowledgeArticle;
  financing?: KnowledgeArticle;
  insurance?: KnowledgeArticle;
  /** Link to the clinic's chat for booking. */
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

/** Days after capture at which follow-ups go out. */
export const FOLLOWUP_STEPS = [0, 1, 3, 7] as const;

const first = (name?: string | null) => name?.split(' ')[0] || 'there';
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function answers(article: KnowledgeArticle, question: string, n = 1): string[] {
  const index = new SearchIndex({ synonyms: SYNONYMS });
  index.add({ id: article.id, title: article.title, tags: article.tags, body: `${article.summary}\n${article.body}` });
  return index.passages(`${article.summary}\n${article.body}`, question, n, article, { fallback: false, minRatio: 0.6 });
}

function footer(c: FollowupContext): string {
  const { org } = c;
  const lines = [org.name, [org.address, org.phone ? formatPhone(org.phone) : null].filter(Boolean).join(' · ')].filter(Boolean);
  if (c.unsubscribeUrl) lines.push(`Don't want these emails? Unsubscribe: ${c.unsubscribeUrl}`);
  return lines.join('\n');
}

function nextStep(c: FollowupContext): string {
  const phone = c.org.phone ? formatPhone(c.org.phone) : undefined;
  const ways = [
    c.bookingUrl ? `pick a time online: ${c.bookingUrl}` : undefined,
    phone ? `call us on ${phone}` : undefined,
    'or simply reply to this email',
  ].filter(Boolean);
  return `When you're ready, ${ways.join(', ')}.`;
}

export function renderFollowup(step: number, c: FollowupContext): RenderedEmail {
  const { org, lead, article } = c;
  const service = lead.serviceInterest ?? undefined;
  const topic = service ? lowerFirst(service) : 'your visit';
  const hi = `Hi ${first(lead.name)},`;
  let subject: string;
  const body: string[] = [hi];

  if (step === 0) {
    subject = `Thanks for reaching out to ${org.name}`;
    body.push(`Thanks for chatting with us${service ? ` about ${topic}` : ''}. Here's a quick recap so you have it handy.`);
    if (article) body.push(article.summary);
    body.push(nextStep(c));
  } else if (step === 1) {
    subject = service ? `Your questions about ${topic}, answered` : `Any questions we can answer?`;
    body.push(`People thinking about ${topic} usually ask a couple of things:`);
    if (article) {
      const howLong = answers(article, 'how long does it take months visits')[0];
      const comfort = answers(article, 'does it hurt pain discomfort numb')[0];
      if (howLong) body.push(`How long does it take? ${howLong}`);
      if (comfort && comfort !== howLong) body.push(`Is it uncomfortable? ${comfort}`);
      if (!howLong && !comfort) body.push(article.body.split('\n')[0] ?? article.summary);
    } else {
      body.push('What happens at the first visit, how long treatment takes, and what it costs. Our team is happy to go through all of it with you.');
    }
    body.push(nextStep(c));
  } else if (step === 3) {
    subject = `Ready to book${service ? ` your ${topic} consultation` : ' your visit'}?`;
    body.push(`Just checking in about ${topic}. A consultation is the best way to get a clear plan and an exact quote for your situation.`);
    if (c.financing) body.push(c.financing.summary);
    if (c.insurance) body.push(c.insurance.summary);
    body.push(nextStep(c));
  } else {
    subject = `Should we keep your enquiry open?`;
    body.push(
      `We haven't heard back from you about ${topic}, so this is our last check-in. If now isn't the right time, no problem at all — we're here whenever you're ready.`
    );
    body.push(nextStep(c));
  }
  body.push(`Warm regards,\nThe team at ${org.name}`);
  body.push(footer(c));
  return { subject, text: body.join('\n\n') };
}

export function renderConfirmation(org: Organization, lead: Lead, service: string, label: string, unsubscribeUrl?: string): RenderedEmail {
  const phone = org.phone ? formatPhone(org.phone) : undefined;
  return {
    subject: `We've received your appointment request — ${label}`,
    text: [
      `Hi ${first(lead.name)},`,
      `Thanks for requesting ${service === 'Consultation' ? 'a consultation' : `an appointment for ${lowerFirst(service)}`} on ${label}. Our team will confirm the time with you shortly.`,
      org.address ? `Where: ${org.address}` : '',
      `If you need to change anything${phone ? `, call us on ${phone} or` : ','} reply to this email.`,
      `See you soon,\nThe team at ${org.name}`,
      footer({ org, lead, unsubscribeUrl }),
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

// ---------------------------------------------------------------- reminders and follow-ups (see automations.ts)

export interface PatientEmailContext {
  org: Organization;
  lead: Lead;
  /** Link to the clinic's chat for booking. */
  bookingUrl?: string;
  unsubscribeUrl?: string;
}

const visitFor = (service: string) => (service === 'Consultation' ? 'consultation' : `${lowerFirst(service)} appointment`);

function signOff(c: PatientEmailContext, closing = 'See you soon'): string[] {
  return [`${closing},\nThe team at ${c.org.name}`, footer(c)];
}

export function renderReminder(
  c: PatientEmailContext & { service: string; label: string; when: 'today' | 'tomorrow' | 'soon'; manageUrl?: string; confirmed: boolean }
): RenderedEmail {
  const phone = c.org.phone ? formatPhone(c.org.phone) : undefined;
  const day = c.when === 'soon' ? '' : ` ${c.when}`;
  const body = [`Hi ${first(c.lead.name)},`, `This is a reminder of your ${visitFor(c.service)} at ${c.org.name}${day}: ${c.label}.`];
  if (c.org.address) body.push(`Where: ${c.org.address}`);
  if (c.manageUrl) {
    body.push(c.confirmed ? `Need to reschedule or cancel? You can do it here: ${c.manageUrl}` : `Please confirm you can make it, or let us know if you can't: ${c.manageUrl}`);
  }
  body.push(`If anything changes${phone ? `, call us on ${phone} or` : ','} reply to this email.`);
  return { subject: `Reminder: your appointment${day} — ${c.label}`, text: [...body, ...signOff(c)].join('\n\n') };
}

export function renderRecall(c: PatientEmailContext & { months: number }): RenderedEmail {
  return {
    subject: `Time for your next check-up at ${c.org.name}`,
    text: [
      `Hi ${first(c.lead.name)},`,
      `It's been about ${c.months} months since your last visit, so you're due for a check-up and cleaning. Regular visits catch small problems early, while they're quicker and easier to treat.`,
      nextStep(c),
      ...signOff(c, 'Warm regards'),
    ].join('\n\n'),
  };
}

export function renderNoShow(c: PatientEmailContext & { service: string; label: string }): RenderedEmail {
  return {
    subject: 'We missed you today',
    text: [
      `Hi ${first(c.lead.name)},`,
      `We're sorry we missed you at your ${visitFor(c.service)} (${c.label}). These things happen — if you'd still like to come in, we'd be glad to find you another time.`,
      nextStep(c),
      ...signOff(c, 'Warm regards'),
    ].join('\n\n'),
  };
}

export function renderReviewRequest(c: PatientEmailContext & { reviewUrl: string }): RenderedEmail {
  return {
    subject: `How was your visit to ${c.org.name}?`,
    text: [
      `Hi ${first(c.lead.name)},`,
      `Thank you for visiting us. If you have a minute, we'd really appreciate a short review — it helps other patients find a dentist they can trust: ${c.reviewUrl}`,
      `If anything wasn't right, just reply to this email and tell us. We read every message.`,
      ...signOff(c, 'Thank you'),
    ].join('\n\n'),
  };
}

export function renderReactivation(c: PatientEmailContext & { article?: KnowledgeArticle; financing?: KnowledgeArticle }): RenderedEmail {
  const service = c.lead.serviceInterest ?? undefined;
  const topic = service ? lowerFirst(service) : undefined;
  const body = [
    `Hi ${first(c.lead.name)},`,
    topic
      ? `A while ago you asked us about ${topic}. If it's still on your mind, we're happy to answer any questions or find you a time that suits you.`
      : `A while ago you got in touch with us. If you're still looking for a dentist, we'd be glad to help.`,
  ];
  if (c.article) body.push(c.article.summary);
  if (c.financing) body.push(c.financing.summary);
  body.push(nextStep(c));
  return { subject: topic ? `Still thinking about ${topic}?` : `Still looking for a dentist?`, text: [...body, ...signOff(c, 'Warm regards')].join('\n\n') };
}

export function renderWaitlistOffer(c: PatientEmailContext & { label: string }): RenderedEmail {
  const phone = c.org.phone ? formatPhone(c.org.phone) : undefined;
  const ways = [c.bookingUrl ? `book it here: ${c.bookingUrl}` : undefined, phone ? `call us on ${phone}` : undefined, 'or reply to this email'].filter(Boolean);
  return {
    subject: `An earlier appointment just opened up: ${c.label}`,
    text: [
      `Hi ${first(c.lead.name)},`,
      `Good news — an appointment just opened up on ${c.label}. You asked to hear about earlier times, so we're letting you know first. Openings go quickly; if it suits you, ${ways.join(', ')}.`,
      `If it doesn't work for you, no problem: you'll stay on our waitlist.`,
      ...signOff(c, 'Warm regards'),
    ].join('\n\n'),
  };
}

export interface DigestInput {
  org: Organization;
  /** "Thursday, October 29" — the day the numbers cover. */
  dayLabel: string;
  leads: { total: number; high: number; top: { name: string; service: string | null; tier: string }[] };
  conversations: { total: number; handled: number; unanswered: number };
  bookings: number;
  attention: { name: string; reason: string }[];
  today: { time: string; name: string; service: string; status: string }[];
  emails: { sent: number; failed: number };
  link?: string;
}

export function renderDigest(d: DigestInput): RenderedEmail {
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const lines: string[] = [`Here's how ${d.dayLabel} went, and what's on today.`];
  const leadLine = [`New leads: ${d.leads.total}${d.leads.high ? ` (${d.leads.high} high intent)` : ''}`];
  for (const l of d.leads.top) leadLine.push(`  • ${l.name}${l.service ? ` — ${l.service}` : ''} (${l.tier.toLowerCase()})`);
  lines.push(leadLine.join('\n'));
  lines.push(
    [
      `Website chats: ${d.conversations.total}${d.conversations.total ? ` (${d.conversations.handled} handled by the assistant without the team)` : ''}`,
      `Appointment requests: ${d.bookings}`,
      d.conversations.unanswered ? `Questions the assistant couldn't answer: ${d.conversations.unanswered} — add answers in the AI Center` : undefined,
      d.emails.sent || d.emails.failed ? `Emails sent: ${d.emails.sent}${d.emails.failed ? `, ${d.emails.failed} failed` : ''}` : undefined,
    ]
      .filter(Boolean)
      .join('\n')
  );
  if (d.attention.length) lines.push([`Needs a reply (${d.attention.length}):`, ...d.attention.map((a) => `  • ${a.name} — ${a.reason}`)].join('\n'));
  lines.push(
    d.today.length
      ? [`Today's appointments (${d.today.length}):`, ...d.today.map((a) => `  • ${a.time} ${a.name} — ${a.service}${a.status === 'REQUESTED' ? ' (not confirmed yet)' : ''}`)].join('\n')
      : 'No appointments booked for today yet.'
  );
  if (d.link) lines.push(`Open LeadFlow: ${d.link}`);
  return {
    subject: `${d.org.name}: ${plural(d.leads.total, 'new lead')}, ${plural(d.bookings, 'booking')} — ${d.dayLabel}`,
    text: lines.join('\n\n'),
  };
}

export interface AlertInput {
  org: Organization;
  kind: 'NEW_LEAD' | 'APPOINTMENT' | 'ER' | 'URGENT' | 'HANDOFF' | 'CANCELLED';
  lead?: Lead | null;
  reason?: string;
  detail?: string;
  transcript: { role: string; body: string }[];
  link?: string;
}

export function renderStaffAlert(a: AlertInput): RenderedEmail {
  const who = a.lead?.name ?? 'A website visitor';
  const service = a.lead?.serviceInterest ? ` (${a.lead.serviceInterest})` : '';
  const subject = {
    NEW_LEAD: `New ${a.lead?.tier.toLowerCase() ?? ''} intent lead: ${who}${service}`.replace('  ', ' '),
    APPOINTMENT: `Appointment request: ${who}${a.detail ? ` — ${a.detail}` : ''}`,
    ER: `Possible medical emergency in website chat`,
    URGENT: `Urgent: ${a.reason ?? 'dental problem'} — ${who}`,
    HANDOFF: `Callback requested: ${who}`,
    CANCELLED: `Appointment cancelled by the patient: ${who}${a.detail ? ` — ${a.detail}` : ''}`,
  }[a.kind];
  const lines: string[] = [];
  if (a.kind === 'ER') {
    lines.push(`The assistant told the visitor to call 911 / go to the emergency room (${a.reason}). Please follow up if you can reach them.`);
  } else if (a.reason) {
    lines.push(`Reason: ${a.reason}`);
  }
  if (a.detail) lines.push(a.detail);
  if (a.lead) {
    lines.push(
      [
        `Name: ${a.lead.name ?? '—'}`,
        `Phone: ${a.lead.phone ? formatPhone(a.lead.phone) : '—'}`,
        `Email: ${a.lead.email ?? '—'}`,
        `Interested in: ${a.lead.serviceInterest ?? '—'}`,
        `Score: ${a.lead.score} (${a.lead.tier})`,
      ].join('\n')
    );
  }
  const recent = a.transcript.slice(-8).map((m) => `${m.role === 'visitor' ? 'Visitor' : 'Assistant'}: ${m.body}`);
  if (recent.length) lines.push(`Recent conversation:\n${recent.join('\n')}`);
  if (a.link) lines.push(`Open in LeadFlow: ${a.link}`);
  return { subject, text: lines.join('\n\n') };
}
