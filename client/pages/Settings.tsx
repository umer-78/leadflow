import { Check, Copy, ExternalLink, KeyRound, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PageProps } from '../App.tsx';
import { api, useApi } from '../api.ts';
import { money, timeAgo } from '../format.ts';
import { navigate } from '../router.ts';
import type { DayKey, Plan, Role, Settings, TeamMember, WeeklyHours } from '../types.ts';
import { Badge, Button, Card, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Textarea, Toggle, cx, useAction } from '../ui.tsx';

const TABS = [
  { key: 'clinic', label: 'Clinic' },
  { key: 'hours', label: 'Hours & booking' },
  { key: 'assistant', label: 'Assistant' },
  { key: 'widget', label: 'Website chat' },
  { key: 'team', label: 'Team' },
  { key: 'billing', label: 'Plan' },
  { key: 'profile', label: 'My account' },
];

export function SettingsPage(props: PageProps & { tab?: string; onOrgChanged: () => void }) {
  const tab = TABS.some((t) => t.key === props.tab) ? props.tab! : 'clinic';
  const settings = useApi<Settings>('/settings');
  const save = useSaver(settings.setData, props.onOrgChanged);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`#/settings/${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={cx('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium', tab === t.key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >
            {t.label}
          </a>
        ))}
      </div>
      {settings.error && <ErrorNote error={settings.error} onRetry={settings.reload} />}
      {!settings.data ? (
        !settings.error && <Loading />
      ) : (
        <>
          {tab === 'clinic' && <ClinicTab s={settings.data} save={save} canEdit={props.can('ADMIN')} />}
          {tab === 'hours' && <HoursTab s={settings.data} save={save} canEdit={props.can('ADMIN')} />}
          {tab === 'assistant' && <AssistantTab s={settings.data} save={save} canEdit={props.can('ADMIN')} />}
          {tab === 'widget' && <WidgetTab s={settings.data} canRotate={props.can('OWNER')} onRotated={(s) => { settings.setData(() => s); props.onOrgChanged(); }} />}
          {tab === 'team' && <TeamTab {...props} />}
          {tab === 'billing' && <BillingTab {...props} />}
          {tab === 'profile' && <ProfileTab {...props} />}
        </>
      )}
    </>
  );
}

type Saver = (patch: Partial<Settings>) => Promise<boolean>;
function useSaver(setData: (fn: (p: Settings | undefined) => Settings | undefined) => void, onOrgChanged: () => void): { busy: boolean; save: Saver } {
  const { busy, run } = useAction();
  const save: Saver = async (patch) => {
    const updated = await run(() => api<Settings>('/settings', { method: 'PATCH', body: patch }), 'Settings saved');
    if (!updated) return false;
    setData((p) => ({ ...p, ...updated }));
    onOrgChanged();
    return true;
  };
  return { busy, save };
}

function Section({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="mb-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
      {footer && <div className="mt-5 flex justify-end">{footer}</div>}
    </Card>
  );
}

function useForm<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (k: keyof T) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return { form, setForm, set, dirty };
}

function ClinicTab({ s, save, canEdit }: { s: Settings; save: { busy: boolean; save: Saver }; canEdit: boolean }) {
  const initial = { name: s.name, phone: s.phone ?? '', email: s.email ?? '', notificationEmail: s.notificationEmail ?? '', website: s.website ?? '', address: s.address ?? '', timezone: s.timezone };
  const { form, set, dirty } = useForm(initial);
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [s.timezone];
    }
  }, [s.timezone]);
  return (
    <Section
      title="Clinic details"
      description="The assistant uses these to tell patients how to reach you and where you are."
      footer={canEdit && <Button variant="primary" disabled={!dirty} loading={save.busy} onClick={() => void save.save(form)}>Save changes</Button>}
    >
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Clinic name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Public email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Send new-lead alerts to" hint="Emergencies, callbacks and appointment requests are emailed here.">
          {(id) => <Input id={id} type="email" value={form.notificationEmail} onChange={set('notificationEmail')} />}
        </Field>
        <Field label="Website">{(id) => <Input id={id} type="url" value={form.website} onChange={set('website')} placeholder="https://" />}</Field>
        <Field label="Time zone">
          {(id) => (
            <Select id={id} value={form.timezone} onChange={set('timezone')}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Address" className="sm:col-span-2">{(id) => <Input id={id} value={form.address} onChange={set('address')} />}</Field>
      </fieldset>
    </Section>
  );
}

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

function HoursTab({ s, save, canEdit }: { s: Settings; save: { busy: boolean; save: Saver }; canEdit: boolean }) {
  const [hours, setHours] = useState<WeeklyHours>(s.hours);
  const [booking, setBooking] = useState({ slotMinutes: s.slotMinutes, minNoticeHours: s.minNoticeHours });
  const dirty = JSON.stringify(hours) !== JSON.stringify(s.hours) || booking.slotMinutes !== s.slotMinutes || booking.minNoticeHours !== s.minNoticeHours;
  const invalid = DAYS.some((d) => hours[d.key].some(([a, b]) => !a || !b || a >= b));
  const setDay = (day: DayKey, value: [string, string][]) => setHours((h) => ({ ...h, [day]: value }));

  return (
    <>
      <Section title="Opening hours" description="The assistant answers hours questions and only offers appointment times inside these hours.">
        <fieldset disabled={!canEdit} className="divide-y divide-slate-100">
          {DAYS.map((d) => {
            const intervals = hours[d.key];
            const open = intervals.length > 0;
            return (
              <div key={d.key} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-28 text-sm font-medium text-slate-700">{d.label}</span>
                <Toggle checked={open} disabled={!canEdit} label={`${d.label} open`} onChange={(v) => setDay(d.key, v ? [['09:00', '17:00']] : [])} />
                {open ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {intervals.map(([a, b], i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <Input aria-label={`${d.label} opens`} type="time" value={a} className="w-28" onChange={(e) => setDay(d.key, intervals.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} />
                        <span className="text-slate-400">–</span>
                        <Input aria-label={`${d.label} closes`} type="time" value={b} className="w-28" onChange={(e) => setDay(d.key, intervals.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} />
                        {intervals.length > 1 && (
                          <button type="button" className="text-xs text-slate-500 hover:text-red-700" onClick={() => setDay(d.key, intervals.filter((_, j) => j !== i))}>
                            Remove
                          </button>
                        )}
                      </span>
                    ))}
                    {intervals.length < 2 && canEdit && (
                      <button type="button" className="text-xs font-medium text-teal-700 hover:underline" onClick={() => setDay(d.key, [...intervals, ['14:00', '18:00']])}>
                        Add a second shift
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Closed</span>
                )}
              </div>
            );
          })}
        </fieldset>
      </Section>
      <Section
        title="Online booking"
        description="Visitors can request any free slot inside your hours. Requests arrive as Requested for you to confirm."
        footer={
          canEdit && (
            <Button variant="primary" disabled={!dirty || invalid} loading={save.busy} onClick={() => void save.save({ hours, ...booking })}>
              Save hours & booking
            </Button>
          )
        }
      >
        <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Appointment length">
            {(id) => (
              <Select id={id} value={booking.slotMinutes} onChange={(e) => setBooking((b) => ({ ...b, slotMinutes: Number(e.target.value) }))}>
                {[15, 20, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Minimum notice">
            {(id) => (
              <Select id={id} value={booking.minNoticeHours} onChange={(e) => setBooking((b) => ({ ...b, minNoticeHours: Number(e.target.value) }))}>
                {[0, 1, 2, 4, 12, 24, 48].map((h) => (
                  <option key={h} value={h}>
                    {h === 0 ? 'None' : `${h} hour${h > 1 ? 's' : ''}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </fieldset>
        {invalid && <p className="mt-3 text-sm text-red-700">Each shift needs an opening time before its closing time.</p>}
      </Section>
    </>
  );
}

function AssistantTab({ s, save, canEdit }: { s: Settings; save: { busy: boolean; save: Saver }; canEdit: boolean }) {
  const { form, setForm, set, dirty } = useForm({ greeting: s.greeting ?? '', emergencyInstructions: s.emergencyInstructions ?? '', followupsEnabled: s.followupsEnabled });
  return (
    <Section
      title="Assistant behaviour"
      description="The assistant runs entirely on your server: no outside AI service sees your patients' messages."
      footer={canEdit && <Button variant="primary" disabled={!dirty} loading={save.busy} onClick={() => void save.save(form)}>Save changes</Button>}
    >
      <fieldset disabled={!canEdit} className="grid gap-4">
        <Field label="Opening message" hint="Leave empty for the default introduction.">
          {(id) => <Textarea id={id} value={form.greeting} onChange={set('greeting')} placeholder={`Hi! I'm the virtual assistant for ${s.name}. I can answer questions about treatments, costs and insurance, or book you in. How can I help?`} />}
        </Field>
        <Field label="Out-of-hours emergency instructions" hint="Shown with urgent dental problems when you're closed, e.g. an on-call number.">
          {(id) => <Textarea id={id} value={form.emergencyInstructions} onChange={set('emergencyInstructions')} />}
        </Field>
        <div className="flex items-start gap-3">
          <Toggle checked={form.followupsEnabled} disabled={!canEdit} onChange={(v) => setForm((f) => ({ ...f, followupsEnabled: v }))} label="Automatic follow-ups" />
          <div className="text-sm">
            <p className="font-medium text-slate-800">Automatic follow-up emails</p>
            <p className="text-slate-500">Leads who leave an email get helpful follow-ups after 0, 1, 3 and 7 days. They stop as soon as the lead books, replies, opts out or you mark them contacted elsewhere.</p>
          </div>
        </div>
      </fieldset>
    </Section>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input aria-label={label} readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function WidgetTab({ s, canRotate, onRotated }: { s: Settings; canRotate: boolean; onRotated: (s: Settings) => void }) {
  const origin = s.publicUrl ?? location.origin;
  const snippet = `<script src="${origin}/widget.js" data-key="${s.publicKey}" async></script>`;
  const link = `${origin}/chat.html?key=${s.publicKey}`;
  const { busy, run } = useAction();
  const [preview, setPreview] = useState(0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <Section title="Add the chat to your website" description="Paste this just before </body> on every page (or in your site builder's custom code / footer scripts area). A chat button appears in the bottom-right corner.">
          <CopyField value={snippet} label="Website snippet" />
        </Section>
        <Section title="Direct chat link" description="Use it in emails, social profiles, Google Business Profile or a QR code at the front desk.">
          <CopyField value={link} label="Chat link" />
          <a href={link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline">
            Open the chat <ExternalLink size={14} />
          </a>
        </Section>
        {canRotate && (
          <Section title="Widget key" description="Replace the key if the snippet was copied somewhere it shouldn't be. Update your website afterwards.">
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                if (!confirm('Generate a new key? The current snippet stops working until you update your website.')) return;
                const updated = await run(() => api<Settings>('/settings/rotate-key', { method: 'POST' }), 'New key generated');
                if (updated) {
                  onRotated(updated);
                  setPreview((p) => p + 1);
                }
              }}
            >
              <KeyRound size={14} /> Generate a new key
            </Button>
          </Section>
        )}
      </div>
      <Card title="Live preview" actions={<Button size="sm" variant="ghost" onClick={() => setPreview((p) => p + 1)}>Restart</Button>} padded={false}>
        <iframe key={`${preview}-${s.publicKey}`} title="Chat preview" src={`/chat.html?key=${s.publicKey}`} className="h-[560px] w-full" />
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">This is the real chat: conversations started here are saved like any other.</p>
      </Card>
    </div>
  );
}

const ROLE_HELP: Record<Role, string> = {
  OWNER: 'Everything, including billing and owners',
  ADMIN: 'Settings, knowledge base and team',
  STAFF: 'Leads, conversations and appointments',
  VIEWER: 'Read-only',
};

function TeamTab({ me, can }: PageProps) {
  const team = useApi<{ items: TeamMember[] }>('/team');
  const [adding, setAdding] = useState(false);
  const { run } = useAction();
  const admin = can('ADMIN');
  return (
    <Section
      title="Team"
      description="Everyone here can sign in to this clinic's dashboard."
      footer={
        admin && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add team member
          </Button>
        )
      }
    >
      {team.error && <ErrorNote error={team.error} onRetry={team.reload} />}
      {!team.data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-slate-100">
          {team.data.items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {u.name} {u.id === me.user.id && <Badge>You</Badge>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {u.email} · {u.lastLoginAt ? `last signed in ${timeAgo(u.lastLoginAt)}` : 'never signed in'}
                </p>
              </div>
              <Select
                aria-label={`Role for ${u.name}`}
                value={u.role}
                disabled={!admin || u.id === me.user.id || (u.role === 'OWNER' && !can('OWNER'))}
                className="w-56"
                onChange={async (e) => {
                  const updated = await run(() => api<TeamMember>(`/team/${u.id}`, { method: 'PATCH', body: { role: e.target.value } }), 'Role updated');
                  if (updated) team.reload();
                }}
              >
                {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
                  <option key={r} value={r} disabled={r === 'OWNER' && !can('OWNER')}>
                    {r.charAt(0) + r.slice(1).toLowerCase()} — {ROLE_HELP[r]}
                  </option>
                ))}
              </Select>
              {admin && u.id !== me.user.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${u.name}`}
                  onClick={async () => {
                    if (!confirm(`Remove ${u.name}? They will no longer be able to sign in.`)) return;
                    if (await run(() => api(`/team/${u.id}`, { method: 'DELETE' }), 'Removed')) team.reload();
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <AddMemberModal
          canAddOwner={can('OWNER')}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            team.reload();
          }}
        />
      )}
    </Section>
  );
}

function AddMemberModal({ canAddOwner, onClose, onAdded }: { canAddOwner: boolean; onClose: () => void; onAdded: () => void }) {
  const { form, set } = useForm({ name: '', email: '', password: '', role: 'STAFF' });
  const { busy, run } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title="Add a team member"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={async () => (await run(() => api('/team', { body: form }), 'Team member added')) && onAdded()}>
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Temporary password" hint="At least 8 characters. Share it securely; they can change it under My account.">
          {(id) => <Input id={id} type="text" value={form.password} onChange={set('password')} autoComplete="new-password" />}
        </Field>
        <Field label="Role">
          {(id) => (
            <Select id={id} value={form.role} onChange={set('role')}>
              {(Object.keys(ROLE_HELP) as Role[])
                .filter((r) => r !== 'OWNER' || canAddOwner)
                .map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()} — {ROLE_HELP[r]}
                  </option>
                ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

function BillingTab({ can }: PageProps) {
  const billing = useApi<{ enabled: boolean; plans: Record<string, Plan>; current: { plan: string; status: string } }>('/billing/config');
  const { busy, run } = useAction();
  const status = new URLSearchParams(location.hash.split('?')[1] ?? '').get('billing');
  useEffect(() => {
    if (status) setTimeout(() => navigate('/settings/billing'), 4000);
  }, [status]);
  if (billing.error) return <ErrorNote error={billing.error} onRetry={billing.reload} />;
  if (!billing.data) return <Loading />;
  const { plans, current, enabled } = billing.data;
  return (
    <>
      {status === 'success' && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Thank you! Your subscription is being activated.</div>}
      <p className="mb-4 text-sm text-slate-600">
        Current plan: <span className="font-medium text-slate-900">{current.plan}</span> <Badge tone={current.status === 'active' ? 'green' : 'gray'}>{current.status}</Badge>
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.values(plans).map((p) => (
          <Card key={p.id} title={p.name}>
            <p className="text-2xl font-semibold text-slate-900">
              {money(p.monthlyFee)}
              <span className="text-sm font-normal text-slate-500"> / month</span>
            </p>
            <p className="text-xs text-slate-500">+ {money(p.setupFee)} one-time setup</p>
            <p className="mt-3 text-sm text-slate-600">{p.description}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check size={16} className="mt-0.5 flex-none text-teal-700" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              {current.plan === p.id && current.status === 'active' ? (
                <Badge tone="green">Your plan</Badge>
              ) : enabled && can('OWNER') ? (
                <Button
                  variant="primary"
                  loading={busy}
                  className="w-full"
                  onClick={async () => {
                    const r = await run(() => api<{ url: string }>('/billing/checkout', { body: { planId: p.id } }));
                    if (r?.url) location.href = r.url;
                  }}
                >
                  Choose {p.name}
                </Button>
              ) : (
                <p className="text-xs text-slate-500">{enabled ? 'Only an owner can change the plan.' : 'Online payment is not enabled on this server.'}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function ProfileTab({ me }: PageProps) {
  const { form, set, setForm } = useForm({ name: me.user.name, currentPassword: '', newPassword: '' });
  const { busy, run } = useAction();
  return (
    <Section
      title="My account"
      footer={
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            const body: Record<string, string> = { name: form.name };
            if (form.newPassword) Object.assign(body, { currentPassword: form.currentPassword, newPassword: form.newPassword });
            if (await run(() => api('/me', { method: 'PATCH', body }), form.newPassword ? 'Password changed' : 'Saved')) setForm((f) => ({ ...f, currentPassword: '', newPassword: '' }));
          }}
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} value={form.name} onChange={set('name')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} value={me.user.email} disabled />}</Field>
        <Field label="Current password">{(id) => <Input id={id} type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />}</Field>
        <Field label="New password" hint="Leave empty to keep your password.">
          {(id) => <Input id={id} type="password" value={form.newPassword} onChange={set('newPassword')} autoComplete="new-password" />}
        </Field>
      </div>
    </Section>
  );
}
