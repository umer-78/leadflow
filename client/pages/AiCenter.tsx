import { AlertTriangle, CheckCircle2, Globe, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { PageProps } from '../App.tsx';
import { api, useApi } from '../api.ts';
import { outboundLabel, timeAgo } from '../format.ts';
import type { OutboundKind } from '../types.ts';
import { Badge, Button, Card, EmptyState, ErrorNote, Loading, PageHeader, Select, cx, useAction } from '../ui.tsx';

interface Activity {
  workload: {
    days: number;
    conversations: number;
    visitorMessages: number;
    handledAlone: number;
    escalations: { reason: string; count: number }[];
    bookings: number;
    leads: number;
    afterHours: number;
    byHour: number[];
    byDay: { date: string; conversations: number; messages: number }[];
    emails: { kind: OutboundKind; sent: number; skipped: number; failed: number; scheduled: number }[];
    claude: { answers: number; unanswered: number; tokens: { input: number; output: number; cacheRead: number; cacheWrite: number }; cost: number | null };
  };
  quality: {
    answered: number;
    unanswered: number;
    complaints: number;
    safety: { er: number; urgent: number; soon: number };
    topics: { slug: string; title: string; count: number }[];
    gaps: { question: string; count: number; lastAsked: string; conversationId: string }[];
    corrections: { question: string; answer: string; reply: string; at: string; conversationId: string }[];
  };
}

interface Check {
  id: string;
  area: string;
  status: 'ok' | 'warn' | 'fail';
  title: string;
  detail: string;
  fix?: { label: string; href: string };
}

interface Probe {
  id: string;
  question: string;
  ok: boolean;
  problem?: string;
  reply: string;
  skill: string;
}

interface Updates {
  version: string;
  articles: number;
  upToDate: number;
  pending: number;
  available: number;
  removed: number;
  edited: { id: string; title: string; changed: boolean }[];
  checkedAt: string;
}

const TABS = [
  { key: 'workload', label: 'Workload' },
  { key: 'quality', label: 'Answer quality' },
  { key: 'checks', label: 'Checks' },
  { key: 'updates', label: 'Updates' },
];

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** One series of columns with a labelled peak; values are in each column's tooltip and the table below for screen readers. */
function Columns({ values, labels, caption }: { values: number[]; labels: string[]; caption: string }) {
  const max = Math.max(1, ...values);
  const peak = values.indexOf(Math.max(...values));
  return (
    <figure>
      <div className="flex h-32 items-end gap-[3px]" aria-hidden="true">
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={`${labels[i]}: ${v}`}>
            <div className={cx('w-full rounded-t-[3px]', v ? 'bg-[#2a78d6]' : 'bg-slate-100')} style={{ height: `${v ? Math.max(4, (v / max) * 100) : 2}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500" aria-hidden="true">
        <span>{labels[0]}</span>
        {values[peak] > 0 && <span>Busiest: {labels[peak]}</span>}
        <span>{labels[labels.length - 1]}</span>
      </div>
      <figcaption className="sr-only">
        {caption}: {values.map((v, i) => `${labels[i]} ${v}`).join(', ')}
      </figcaption>
    </figure>
  );
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const shortDate = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

function Workload({ a }: { a: Activity }) {
  const w = a.workload;
  const q = a.quality;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Conversations" value={w.conversations} hint={`${w.visitorMessages} patient messages`} />
        <Stat label="Handled without the team" value={pct(w.handledAlone, w.conversations)} hint={`${w.handledAlone} of ${w.conversations} chats`} />
        <Stat label="After hours" value={pct(w.afterHours, w.conversations)} hint={`${w.afterHours} chats while you were closed`} />
        <Stat label="Questions answered" value={pct(q.answered, q.answered + q.unanswered)} hint={`${q.unanswered} not answered`} />
        <Stat label="Leads captured" value={w.leads} />
        <Stat label="Appointments booked in chat" value={w.bookings} />
        <Stat label="Handed to the team" value={w.conversations - w.handledAlone} hint="urgent, callbacks, complaints" />
        <Stat label="Emails sent" value={w.emails.reduce((s, e) => s + e.sent, 0)} hint="follow-ups, reminders, alerts" />
      </div>
      {w.claude.answers > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Answers written by Claude" value={w.claude.answers} hint={`${w.claude.unanswered} it couldn't answer from your knowledge`} />
          <Stat
            label="Claude tokens"
            value={(w.claude.tokens.input + w.claude.tokens.output + w.claude.tokens.cacheRead + w.claude.tokens.cacheWrite).toLocaleString('en-US')}
            hint={`${w.claude.tokens.cacheRead.toLocaleString('en-US')} read from the prompt cache`}
          />
          <Stat label="Estimated Claude cost" value={w.claude.cost === null ? '—' : `$${w.claude.cost.toFixed(2)}`} hint={`about $${w.claude.cost && w.claude.answers ? (w.claude.cost / w.claude.answers).toFixed(3) : '0'} per answer`} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Chats per day">
          <Columns values={w.byDay.map((d) => d.conversations)} labels={w.byDay.map((d) => shortDate(d.date))} caption="Conversations per day" />
        </Card>
        <Card title="When patients chat (clinic time)">
          <Columns values={w.byHour} labels={w.byHour.map((_, h) => hourLabel(h))} caption="Conversations by hour of day" />
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Why chats were handed to the team" padded={false}>
          {w.escalations.length ? (
            <ul className="divide-y divide-slate-100">
              {w.escalations.map((e) => (
                <li key={e.reason} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{e.reason}</span>
                  <span className="tabular-nums text-slate-500">{e.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing needed the team" text="Urgent problems, callback requests and complaints show up here." />
          )}
        </Card>
        <Card title="Automated emails" padded={false}>
          {w.emails.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 text-right font-medium">Sent</th>
                  <th className="px-2 py-2 text-right font-medium">Skipped</th>
                  <th className="px-4 py-2 text-right font-medium">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {w.emails.map((e) => (
                  <tr key={e.kind}>
                    <td className="px-4 py-2 text-slate-800">{outboundLabel({ kind: e.kind, step: null }).replace(/ · .*/, '')}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{e.sent}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{e.skipped}</td>
                    <td className={cx('px-4 py-2 text-right tabular-nums', e.failed ? 'text-red-700' : 'text-slate-500')}>{e.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No emails yet" text="Follow-ups, reminders and alerts appear here once they go out." />
          )}
        </Card>
      </div>
    </div>
  );
}

function Quality({ a }: { a: Activity }) {
  const q = a.quality;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Answered" value={pct(q.answered, q.answered + q.unanswered)} hint={`${q.answered} answers`} />
        <Stat label="Couldn't answer" value={q.unanswered} hint="add answers below" />
        <Stat label='"That’s not what I asked"' value={q.complaints} hint="patients correcting the assistant" />
        <Stat label="Urgent problems spotted" value={q.safety.er + q.safety.urgent} hint={`${q.safety.er} sent to the ER · ${q.safety.soon} to be seen soon`} />
      </div>
      <Card title="Questions the assistant couldn't answer" padded={false}>
        {q.gaps.length ? (
          <ul className="divide-y divide-slate-100">
            {q.gaps.map((g) => (
              <li key={g.question} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-900">“{g.question}”</p>
                  <p className="text-xs text-slate-500">
                    {g.count > 1 ? `Asked ${g.count} times · ` : ''}last {timeAgo(g.lastAsked)} ·{' '}
                    <a className="hover:underline" href={`#/conversations/${g.conversationId}`}>
                      see the chat
                    </a>
                  </p>
                </div>
                <a href={`#/knowledge?new=${encodeURIComponent(g.question)}`} className="flex-none text-xs font-medium text-teal-700 hover:underline">
                  Teach an answer
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<HelpCircle size={28} />} title="Every question answered" text="Questions the assistant couldn't answer show up here, most-asked first, so you can teach it." />
        )}
      </Card>
      <Card title="Answers patients said were wrong" padded={false}>
        {q.corrections.length ? (
          <ul className="divide-y divide-slate-100">
            {q.corrections.map((c) => (
              <li key={`${c.conversationId}-${c.at}`} className="space-y-1 px-4 py-3 text-sm">
                <p className="text-slate-900">
                  <span className="text-slate-500">Asked:</span> “{c.question}”
                </p>
                <p className="line-clamp-2 text-slate-600">
                  <span className="text-slate-500">Assistant:</span> {c.answer}
                </p>
                <p className="text-slate-900">
                  <span className="text-slate-500">Patient:</span> “{c.reply}” · <span className="text-xs text-slate-500">{timeAgo(c.at)}</span>
                </p>
                <div className="flex gap-3 text-xs font-medium">
                  <a className="text-teal-700 hover:underline" href={`#/knowledge?new=${encodeURIComponent(c.question)}`}>
                    Teach the right answer
                  </a>
                  <a className="text-slate-600 hover:underline" href={`#/conversations/${c.conversationId}`}>
                    Open the chat
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No corrections" text="When a patient says an answer missed the point, it shows up here." />
        )}
      </Card>
      <Card title="What patients ask about" padded={false}>
        {q.topics.length ? (
          <ul className="divide-y divide-slate-100">
            {q.topics.map((t) => (
              <li key={t.slug} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-slate-800">{t.title}</span>
                <span className="tabular-nums text-slate-500">{t.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No answers yet" text="The articles the assistant answers from most often show up here." />
        )}
      </Card>
    </div>
  );
}

const STATUS_ICON = {
  ok: <CheckCircle2 size={18} className="flex-none text-emerald-600" aria-label="OK" />,
  warn: <AlertTriangle size={18} className="flex-none text-amber-600" aria-label="Warning" />,
  fail: <XCircle size={18} className="flex-none text-red-600" aria-label="Needs fixing" />,
};

function Checks({ can }: { can: PageProps['can'] }) {
  const checks = useApi<{ checks: Check[] }>('/ai/checks');
  const { busy, run } = useAction();
  const [test, setTest] = useState<{ probes: Probe[]; ranAt: string }>();
  const order = { fail: 0, warn: 1, ok: 2 };
  const list = [...(checks.data?.checks ?? [])].sort((x, y) => order[x.status] - order[y.status]);
  const failing = list.filter((c) => c.status !== 'ok').length;
  return (
    <div className="space-y-6">
      <Card title={checks.data ? (failing ? `${failing} thing${failing === 1 ? '' : 's'} to fix` : 'Everything is set up') : 'Setup checks'} padded={false}>
        {checks.error && <ErrorNote error={checks.error} onRetry={checks.reload} />}
        {!checks.data ? (
          !checks.error && <Loading />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                {STATUS_ICON[c.status]}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-slate-900">
                    {c.title} <span className="ml-1 text-xs font-normal text-slate-400">{c.area}</span>
                  </p>
                  <p className="text-slate-600">{c.detail}</p>
                </div>
                {c.fix && (
                  <a href={c.fix.href} className="flex-none text-xs font-medium text-teal-700 hover:underline">
                    {c.fix.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card
        title="Self-test"
        actions={
          can('STAFF') && (
            <Button size="sm" variant="primary" loading={busy} onClick={async () => setTest((await run(() => api<{ probes: Probe[]; ranAt: string }>('/ai/self-test', { method: 'POST' }))) ?? test)}>
              <RefreshCw size={14} /> {test ? 'Run again' : 'Run self-test'}
            </Button>
          )
        }
        padded={false}
      >
        {!test ? (
          <p className="px-4 py-4 text-sm text-slate-600">
            Asks the assistant what patients ask most (hours, prices, insurance, emergencies, booking) using your own knowledge and settings, and checks each answer. Nothing is saved and no one is contacted.
          </p>
        ) : (
          <>
            <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
              {test.probes.filter((p) => p.ok).length} of {test.probes.length} passed · {timeAgo(test.ranAt)}
            </p>
            <ul className="divide-y divide-slate-100">
              {test.probes.map((p) => (
                <li key={p.id} className="px-4 py-3 text-sm">
                  <details>
                    <summary className="flex cursor-pointer list-none items-start gap-3">
                      {p.ok ? STATUS_ICON.ok : STATUS_ICON.fail}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-900">“{p.question}”</span>
                        {p.problem && <span className="block text-red-700">{p.problem}</span>}
                      </span>
                      <span className="flex-none text-xs text-slate-400">Show answer</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-slate-700">{p.reply}</p>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function UpdatesTab({ can }: { can: PageProps['can'] }) {
  const updates = useApi<Updates>('/ai/updates');
  const { busy, run } = useAction();
  const u = updates.data;
  if (updates.error) return <ErrorNote error={updates.error} onRetry={updates.reload} />;
  if (!u) return <Loading />;
  const waiting = u.pending + u.available;
  const changedEdits = u.edited.filter((e) => e.changed);
  return (
    <div className="space-y-6">
      <Card
        title="Built-in dental library"
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={updates.reload}>
              <RefreshCw size={14} /> Check now
            </Button>
            {can('ADMIN') && waiting > 0 && (
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                onClick={async () => {
                  const r = await run(() => api<{ status: Updates }>('/ai/updates/apply', { method: 'POST' }), 'Library updated');
                  if (r) updates.setData(() => r.status);
                }}
              >
                Apply {waiting} update{waiting === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex items-start gap-3">
          {waiting ? STATUS_ICON.warn : STATUS_ICON.ok}
          <div className="text-sm">
            <p className="font-medium text-slate-900">{waiting ? `${waiting} update${waiting === 1 ? '' : 's'} available` : 'Up to date'}</p>
            <p className="text-slate-600">
              {u.articles} researched articles (version {u.version}), each citing its sources. {u.upToDate} of your library articles are current
              {u.pending ? `, ${u.pending} have corrections waiting` : ''}
              {u.available ? `, and ${u.available} new topic${u.available === 1 ? ' is' : 's are'} ready to add` : ''}. Library updates arrive with LeadFlow updates and are applied automatically when the server starts; your prices, publishing choices and your own wording are never changed.
            </p>
            <p className="mt-1 text-xs text-slate-500">Checked {timeAgo(u.checkedAt)}{u.removed ? ` · ${u.removed} topic${u.removed === 1 ? '' : 's'} you deleted stay deleted` : ''}</p>
          </div>
        </div>
      </Card>
      <Card title="Articles you rewrote" padded={false}>
        {u.edited.length ? (
          <>
            {changedEdits.length > 0 && (
              <p className="border-b border-slate-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                The library has been updated for {changedEdits.length} of these since you rewrote them. Open one to compare and restore the latest version if you like.
              </p>
            )}
            <ul className="divide-y divide-slate-100">
              {u.edited.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{e.title}</span>
                  <span className="flex flex-none items-center gap-3">
                    {e.changed ? <Badge tone="amber">Newer version available</Badge> : <Badge tone="gray">Your wording</Badge>}
                    <a className="text-xs font-medium text-teal-700 hover:underline" href={`#/knowledge?edit=${e.id}`}>
                      Open
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState title="No rewritten articles" text="If you reword a library article, it keeps your wording and is listed here." />
        )}
      </Card>
      <Card title="Your website">
        <div className="flex items-start gap-3 text-sm">
          <Globe size={18} className="flex-none text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-slate-600">Changed prices or policies on your website? Scan it again and review what's different before anything is changed.</p>
            <a href="#/knowledge?import=1" className="mt-1 inline-block text-xs font-medium text-teal-700 hover:underline">
              Check your website for changes
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AiCenterPage(props: PageProps & { tab?: string }) {
  const tab = TABS.some((t) => t.key === props.tab) ? props.tab! : 'workload';
  const [days, setDays] = useState(30);
  const activity = useApi<Activity>(`/ai/activity?days=${days}`);
  const needsActivity = tab === 'workload' || tab === 'quality';
  return (
    <>
      <PageHeader
        title="AI Center"
        subtitle="What the assistant is doing, how well it's answering, and what it needs from you."
        actions={
          needsActivity && (
            <Select aria-label="Period" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-auto">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
          )
        }
      />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`#/ai/${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={cx('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >
            {t.label}
          </a>
        ))}
      </div>
      {needsActivity && activity.error && <ErrorNote error={activity.error} onRetry={activity.reload} />}
      {needsActivity && !activity.data && !activity.error && <Loading />}
      {tab === 'workload' && activity.data && <Workload a={activity.data} />}
      {tab === 'quality' && activity.data && <Quality a={activity.data} />}
      {tab === 'checks' && <Checks can={props.can} />}
      {tab === 'updates' && <UpdatesTab can={props.can} />}
    </>
  );
}
