import { AlertTriangle, Plus, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PageProps } from '../App.tsx';
import { api, useApi } from '../api.ts';
import { Transcript } from '../components/Transcript.tsx';
import { dateTime, money, outboundLabel, phone, timeAgo } from '../format.ts';
import { navigate } from '../router.ts';
import type { Appointment, Conversation, Lead, LeadStatus, Message, Outbound } from '../types.ts';
import {
  ApptStatusBadge,
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  LEAD_STATUS,
  LeadStatusBadge,
  Loading,
  Modal,
  OutboundStatusBadge,
  PageHeader,
  Select,
  Textarea,
  Toggle,
  TierBadge,
  useAction,
} from '../ui.tsx';

const PAGE = 25;

export function LeadsPage({ can, leadId }: PageProps & { leadId?: string }) {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [sort, setSort] = useState('recent');
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setOffset(0), [search, status, tier, sort]);

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset), sort: sort === 'score' ? 'score' : 'recent' });
  if (search) params.set('q', search);
  if (status) params.set('status', status);
  if (tier) params.set('tier', tier);
  const list = useApi<{ items: Lead[]; total: number }>(`/leads?${params}`);

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Everyone who shared their contact details, scored by how likely they are to book."
        actions={
          can('STAFF') && (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Plus size={16} /> Add lead
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search leads" placeholder="Search name, email, phone or treatment" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          {Object.entries(LEAD_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Intent" value={tier} onChange={(e) => setTier(e.target.value)} className="w-36">
          <option value="">All intent</option>
          <option value="HIGH">High intent</option>
          <option value="MEDIUM">Medium intent</option>
          <option value="LOW">Low intent</option>
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="w-36">
          <option value="recent">Newest first</option>
          <option value="score">Highest score</option>
        </Select>
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={<Users size={28} />}
            title={search || status || tier ? 'No leads match these filters' : 'No leads yet'}
            text={search || status || tier ? 'Try clearing the filters.' : 'Leads appear here as soon as a website visitor shares a phone number or email with the assistant.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Lead</th>
                  <th className="px-4 py-2.5 font-medium">Interested in</th>
                  <th className="px-4 py-2.5 font-medium">Intent</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Contact</th>
                  <th className="px-4 py-2.5 font-medium">Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/leads/${l.id}`)}>
                    <td className="px-4 py-3">
                      <a href={`#/leads/${l.id}`} className="flex items-center gap-1.5 font-medium text-slate-900" onClick={(e) => e.stopPropagation()}>
                        {l.urgent && <AlertTriangle size={14} className="text-red-600" aria-label="Urgent" />}
                        {l.name ?? 'Unnamed lead'}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.serviceInterest ?? '—'}</td>
                    <td className="px-4 py-3">
                      <TierBadge tier={l.tier} score={l.score} />
                    </td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="truncate">{phone(l.phone) || l.email || '—'}</div>
                      {l.phone && l.email && <div className="truncate text-xs text-slate-400">{l.email}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{timeAgo(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {list.data && list.data.total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <span>
            {offset + 1}–{Math.min(offset + PAGE, list.data.total)} of {list.data.total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Previous
            </Button>
            <Button size="sm" disabled={offset + PAGE >= list.data.total} onClick={() => setOffset(offset + PAGE)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <AddLeadModal open={adding} onClose={() => setAdding(false)} onCreated={(l) => { setAdding(false); list.reload(); navigate(`/leads/${l.id}`); }} />
      {leadId && <LeadPanel id={leadId} can={can} onChanged={list.reload} onClose={() => navigate('/leads')} />}
    </>
  );
}

function AddLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (l: Lead) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', serviceInterest: '', notes: '' });
  const { busy, run } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a lead"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              const lead = await run(() => api<Lead>('/leads', { body: form }), 'Lead added');
              if (lead) {
                setForm({ name: '', email: '', phone: '', serviceInterest: '', notes: '' });
                onCreated(lead);
              }
            }}
          >
            Add lead
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Interested in">{(id) => <Input id={id} value={form.serviceInterest} onChange={set('serviceInterest')} placeholder="e.g. Dental implants" />}</Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.notes} onChange={set('notes')} />}</Field>
      </div>
    </Modal>
  );
}

interface LeadDetail {
  lead: Lead;
  conversations: (Conversation & { messages: Message[] })[];
  appointments: Appointment[];
  outbound: Outbound[];
  activity: { id: string; action: string; createdAt: string; details: Record<string, unknown> }[];
}

const STEP_LABEL = (o: Outbound) => outboundLabel(o);

function LeadPanel({ id, can, onClose, onChanged }: { id: string; can: PageProps['can']; onClose: () => void; onChanged: () => void }) {
  const detail = useApi<LeadDetail>(`/leads/${id}`);
  const { busy, run } = useAction();
  const [notes, setNotes] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<Outbound>();
  const lead = detail.data?.lead;
  const editable = can('STAFF');

  async function update(patch: Partial<Lead>, message?: string) {
    const updated = await run(() => api<Lead>(`/leads/${id}`, { method: 'PATCH', body: patch }), message);
    if (updated) {
      detail.setData((d) => (d ? { ...d, lead: updated } : d));
      onChanged();
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        lead ? (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-slate-900">{lead.name ?? 'Unnamed lead'}</h2>
            <TierBadge tier={lead.tier} score={lead.score} />
            {lead.urgent && <Badge tone="red">Urgent</Badge>}
            {lead.optedOut && <Badge tone="gray">Opted out</Badge>}
            {lead.waitlist && <Badge tone="blue">Waitlist</Badge>}
          </div>
        ) : (
          <span className="text-sm text-slate-500">Lead</span>
        )
      }
    >
      {detail.error && <ErrorNote error={detail.error} onRetry={detail.reload} />}
      {!detail.data ? (
        <Loading />
      ) : (
        lead && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                {(fid) => (
                  <Select id={fid} value={lead.status} disabled={!editable || busy} onChange={(e) => void update({ status: e.target.value as LeadStatus }, 'Status updated')}>
                    {Object.entries(LEAD_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="text-sm">
                <p className="mb-1 font-medium text-slate-700">Contact</p>
                <p className="text-slate-900">{lead.phone ? <a href={`tel:${lead.phone}`} className="hover:underline">{phone(lead.phone)}</a> : 'No phone'}</p>
                <p className="truncate text-slate-900">{lead.email ? <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a> : 'No email'}</p>
                {editable && (
                  <button type="button" className="mt-1 text-xs font-medium text-teal-700 hover:underline" onClick={() => setEditing(true)}>
                    Edit details
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <Toggle
                checked={lead.waitlist}
                disabled={!editable || busy || lead.optedOut}
                onChange={(v) => void update({ waitlist: v }, v ? 'Added to the waitlist' : 'Removed from the waitlist')}
                label="Waitlist"
              />
              <div>
                <p className="font-medium text-slate-800">Waitlist for an earlier time</p>
                <p className="text-slate-500">When an appointment is cancelled, the first three patients on the waitlist are emailed the opening.</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">Interested in</dt>
                <dd className="font-medium text-slate-900">{lead.serviceInterest ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Est. value</dt>
                <dd className="font-medium text-slate-900">{lead.estimatedValue ? money(lead.estimatedValue) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Source</dt>
                <dd className="font-medium text-slate-900">{lead.source === 'WEB_CHAT' ? 'Website chat' : 'Added manually'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Captured</dt>
                <dd className="font-medium text-slate-900">{dateTime(lead.createdAt)}</dd>
              </div>
            </dl>

            <Card title={`Why this lead scores ${lead.score}`}>
              {lead.scoreReasons.length ? (
                <ul className="space-y-1 text-sm text-slate-700">
                  {lead.scoreReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Scores are calculated from website conversations.</p>
              )}
            </Card>

            <Card title="Notes">
              <Textarea
                aria-label="Notes"
                value={notes ?? lead.notes ?? ''}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!editable}
                placeholder="Call notes, treatment plans, preferences…"
              />
              {editable && notes !== undefined && notes !== (lead.notes ?? '') && (
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="primary" loading={busy} onClick={() => void update({ notes }, 'Notes saved').then(() => setNotes(undefined))}>
                    Save notes
                  </Button>
                </div>
              )}
            </Card>

            <Card title="Appointments" padded={false}>
              {detail.data.appointments.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No appointments.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {detail.data.appointments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span>
                        <span className="font-medium text-slate-900">{a.service}</span>
                        <span className="text-slate-500"> · {dateTime(a.startsAt)}</span>
                      </span>
                      <ApptStatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Emails" padded={false}>
              {detail.data.outbound.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">{lead.email ? 'No emails yet.' : 'No email address, so no automated follow-ups.'}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {detail.data.outbound.map((o) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => setViewing(o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">{STEP_LABEL(o)}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {o.sentAt ? `Processed ${dateTime(o.sentAt)}` : `Scheduled ${dateTime(o.scheduledFor)}`}
                            {o.statusReason && o.status === 'SKIPPED' ? ` · ${o.statusReason}` : ''}
                          </span>
                        </span>
                        <OutboundStatusBadge status={o.status} reason={o.statusReason} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {detail.data.conversations.map((c) => (
              <Card key={c.id} title={`Website chat · ${dateTime(c.createdAt)}`}>
                <Transcript messages={c.messages} />
              </Card>
            ))}

            {can('ADMIN') && (
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (!confirm('Delete this lead and its follow-ups? Conversations are kept.')) return;
                    if (await run(() => api(`/leads/${id}`, { method: 'DELETE' }), 'Lead deleted')) {
                      onChanged();
                      onClose();
                    }
                  }}
                >
                  <Trash2 size={14} /> Delete lead
                </Button>
              </div>
            )}

            {editing && <EditLeadModal lead={lead} onClose={() => setEditing(false)} onSave={async (patch) => { await update(patch, 'Lead updated'); setEditing(false); }} />}
            <Modal open={!!viewing} onClose={() => setViewing(undefined)} title={viewing ? STEP_LABEL(viewing) : ''} wide>
              {viewing && (
                <div className="space-y-3 text-sm">
                  <p className="text-slate-500">
                    To {viewing.toAddress} · <OutboundStatusBadge status={viewing.status} />
                    {viewing.statusReason && <span className="ml-2 text-xs">{viewing.statusReason}</span>}
                  </p>
                  {viewing.body ? (
                    <>
                      <p className="font-medium text-slate-900">{viewing.subject}</p>
                      <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-slate-800">{viewing.body}</pre>
                    </>
                  ) : (
                    <p className="text-slate-500">This follow-up is written when it is sent, using the lead's latest details and your knowledge base.</p>
                  )}
                </div>
              )}
            </Modal>
          </div>
        )
      )}
    </Drawer>
  );
}

function EditLeadModal({ lead, onClose, onSave }: { lead: Lead; onClose: () => void; onSave: (patch: Partial<Lead>) => Promise<void> }) {
  const [form, setForm] = useState({ name: lead.name ?? '', phone: lead.phone ?? '', email: lead.email ?? '', serviceInterest: lead.serviceInterest ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit lead"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(form);
              setBusy(false);
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Interested in">{(id) => <Input id={id} value={form.serviceInterest} onChange={set('serviceInterest')} />}</Field>
      </div>
    </Modal>
  );
}
