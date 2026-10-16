import { AlertTriangle, CalendarDays, CheckCircle2, Circle, HelpCircle, Users } from 'lucide-react';
import { useState } from 'react';
import type { PageProps } from '../App.tsx';
import { useApi } from '../api.ts';
import { ActivityChart } from '../components/ActivityChart.tsx';
import { dateTime, money, phone, timeAgo } from '../format.ts';
import type { Article, Overview, Settings } from '../types.ts';
import { Card, EmptyState, ErrorNote, LeadStatusBadge, Loading, PageHeader, Select, TierBadge, ApptStatusBadge } from '../ui.tsx';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function SetupChecklist({ conversations }: { conversations: number }) {
  const settings = useApi<Settings>('/settings');
  const knowledge = useApi<{ items: Article[] }>('/knowledge');
  if (!settings.data || !knowledge.data) return null;
  const s = settings.data;
  const articles = knowledge.data.items;
  const policies = articles.filter((a) => a.category === 'POLICY');
  const policiesDone = policies.filter((a) => a.published && !/\[[^\]]{3,}\]/.test(a.summary)).length;
  const priced = articles.some((a) => a.priceMin != null || a.priceMax != null);
  const items = [
    { done: !!(s.phone && s.address), label: 'Add your phone number and address', href: '#/settings/clinic' },
    { done: !!s.notificationEmail, label: 'Choose where new-lead alerts are emailed', href: '#/settings/clinic' },
    { done: policiesDone === policies.length && policies.length > 0, label: `Fill in your clinic policies (${policiesDone}/${policies.length} done)`, href: '#/knowledge' },
    { done: priced, label: 'Add price ranges the assistant may quote', href: '#/knowledge' },
    { done: conversations > 0, label: 'Add the chat to your website', href: '#/settings/widget' },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  return (
    <Card title={`Finish setting up (${done}/${items.length})`} className="mb-6">
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            {i.done ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-slate-300" />}
            {i.done ? (
              <span className="text-slate-500 line-through">{i.label}</span>
            ) : (
              <a href={i.href} className="font-medium text-teal-800 hover:underline">
                {i.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function OverviewPage({ me }: PageProps) {
  const [days, setDays] = useState(30);
  const { data, error, loading, reload } = useApi<Overview>(`/overview?days=${days}`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${me.user.name.split(' ')[0]}`}
        subtitle="Here's what your assistant has been doing."
        actions={
          <Select aria-label="Time range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />
      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && (
        <>
          {!me.org.isDemo && <SetupChecklist conversations={data.kpis.conversations} />}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Conversations" value={data.kpis.conversations} />
            <Stat label="Leads captured" value={data.kpis.leads} />
            <Stat label="High-intent leads" value={data.kpis.highIntent} />
            <Stat label="Appointment requests" value={data.kpis.appointmentsRequested} />
            <Stat label="Leads booked" value={`${data.kpis.bookingRate}%`} hint="of leads captured" />
            <Stat label="Open pipeline" value={money(data.kpis.pipelineValue)} hint="estimated case value" />
            <Stat label="Questions answered" value={`${data.kpis.answerRate}%`} hint="by the assistant" />
            <Stat label="Follow-ups delivered" value={data.kpis.followupsSent} />
          </div>

          <Card title="Last 14 days" className="mt-6">
            <ActivityChart data={data.series} />
          </Card>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card title="Needs attention" padded={false}>
              {data.attention.length === 0 ? (
                <EmptyState icon={<CheckCircle2 size={28} />} title="Nothing urgent" text="Emergencies, urgent problems and callback requests show up here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.attention.map((a) => (
                    <li key={a.id}>
                      <a href={`#/conversations/${a.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                        <AlertTriangle size={18} className="mt-0.5 flex-none text-red-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{a.reason ?? 'Needs a follow-up'}</p>
                          <p className="text-xs text-slate-500">
                            {a.leadName ?? 'Anonymous visitor'}
                            {a.leadPhone ? ` · ${phone(a.leadPhone)}` : ''} · {timeAgo(a.lastMessageAt)}
                          </p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Upcoming appointments" padded={false} actions={<a href="#/appointments" className="text-xs font-medium text-teal-700 hover:underline">View all</a>}>
              {data.upcoming.length === 0 ? (
                <EmptyState icon={<CalendarDays size={28} />} title="No upcoming appointments" text="Appointments the assistant books appear here for you to confirm." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.upcoming.map((a) => (
                    <li key={a.id}>
                      <a href={a.leadId ? `#/leads/${a.leadId}` : '#/appointments'} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{a.leadName ?? 'Patient'} · {a.service}</p>
                          <p className="text-xs text-slate-500">{dateTime(a.startsAt)}</p>
                        </div>
                        <ApptStatusBadge status={a.status} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Newest leads" padded={false} actions={<a href="#/leads" className="text-xs font-medium text-teal-700 hover:underline">View all</a>}>
              {data.recentLeads.length === 0 ? (
                <EmptyState icon={<Users size={28} />} title="No leads yet" text="When a visitor shares their phone or email, they become a lead here." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentLeads.map((l) => (
                    <li key={l.id}>
                      <a href={`#/leads/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{l.name ?? l.email ?? phone(l.phone)}</p>
                          <p className="truncate text-xs text-slate-500">
                            {l.serviceInterest ?? 'General enquiry'} · {timeAgo(l.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-none items-center gap-2">
                          <TierBadge tier={l.tier} score={l.score} />
                          <LeadStatusBadge status={l.status} />
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Questions the assistant couldn't answer" padded={false}>
              {data.unanswered.length === 0 ? (
                <EmptyState icon={<HelpCircle size={28} />} title="All questions answered" text="Unanswered questions show up here so you can teach the assistant." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.unanswered.map((q) => (
                    <li key={`${q.conversationId}-${q.createdAt}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-900">“{q.question}”</p>
                        <p className="text-xs text-slate-500">{timeAgo(q.createdAt)}</p>
                      </div>
                      <a href={`#/knowledge?new=${encodeURIComponent(q.question)}`} className="flex-none text-xs font-medium text-teal-700 hover:underline">
                        Teach an answer
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
