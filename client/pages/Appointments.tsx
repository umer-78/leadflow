import { CalendarDays, Plus } from 'lucide-react';
import { useState } from 'react';
import type { PageProps } from '../App.tsx';
import { api, useApi } from '../api.ts';
import { dayKey, dayLabel, phone, time } from '../format.ts';
import type { Appointment, AppointmentStatus } from '../types.ts';
import { ApptStatusBadge, Button, Card, EmptyState, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Textarea, Toggle, useAction } from '../ui.tsx';

const ACTIONS: { to: AppointmentStatus; label: string; from: AppointmentStatus[] }[] = [
  { to: 'CONFIRMED', label: 'Confirm', from: ['REQUESTED'] },
  { to: 'COMPLETED', label: 'Completed', from: ['CONFIRMED', 'REQUESTED'] },
  { to: 'NO_SHOW', label: 'No-show', from: ['CONFIRMED', 'REQUESTED'] },
  { to: 'CANCELLED', label: 'Cancel', from: ['REQUESTED', 'CONFIRMED'] },
];

export function AppointmentsPage({ can }: PageProps) {
  const [showPast, setShowPast] = useState(false);
  const [creating, setCreating] = useState(false);
  const from = new Date(Date.now() - (showPast ? 60 : 1) * 86_400_000).toISOString();
  const list = useApi<{ items: Appointment[] }>(`/appointments?from=${encodeURIComponent(from)}`);
  const { run } = useAction();

  async function setStatus(a: Appointment, status: AppointmentStatus) {
    const updated = await run(() => api<Appointment>(`/appointments/${a.id}`, { method: 'PATCH', body: { status } }), 'Appointment updated');
    if (updated) list.setData((d) => (d ? { items: d.items.map((x) => (x.id === a.id ? { ...x, ...updated } : x)) } : d));
  }

  const items = (list.data?.items ?? []).filter((a) => showPast || (a.status !== 'CANCELLED' && new Date(a.endsAt).getTime() > Date.now() - 86_400_000));
  const groups = new Map<string, Appointment[]>();
  for (const a of items) groups.set(dayKey(a.startsAt), [...(groups.get(dayKey(a.startsAt)) ?? []), a]);

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Requests from the assistant arrive as Requested. Confirm them with the patient, then mark the outcome."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Toggle checked={showPast} onChange={setShowPast} label="Show past and cancelled" /> Past & cancelled
            </label>
            {can('STAFF') && (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={16} /> New appointment
              </Button>
            )}
          </>
        }
      />
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data ? (
        <Loading />
      ) : groups.size === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays size={28} />} title="No appointments" text="When a visitor picks a time in the chat, the request shows up here." />
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groups].map(([day, appts]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{dayLabel(appts[0].startsAt)}</h2>
              <Card padded={false}>
                <ul className="divide-y divide-slate-100">
                  {appts.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="w-20 flex-none text-sm font-semibold tabular-nums text-slate-900">{time(a.startsAt)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {a.leadId ? <a href={`#/leads/${a.leadId}`} className="hover:underline">{a.leadName ?? 'Patient'}</a> : (a.leadName ?? 'Patient')} · {a.service}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {[phone(a.leadPhone), a.leadEmail].filter(Boolean).join(' · ') || 'No contact details'}
                          {a.source === 'AI_RECEPTIONIST' ? ' · booked by the assistant' : ''}
                          {a.patientConfirmedAt && ['REQUESTED', 'CONFIRMED'].includes(a.status) ? ' · patient confirmed ✓' : ''}
                        </p>
                      </div>
                      <ApptStatusBadge status={a.status} />
                      {can('STAFF') && (
                        <div className="flex gap-1">
                          {ACTIONS.filter((x) => x.from.includes(a.status)).map((x) => (
                            <Button key={x.to} size="sm" variant={x.to === 'CONFIRMED' ? 'primary' : 'ghost'} onClick={() => void setStatus(a, x.to)}>
                              {x.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
      {creating && (
        <NewAppointmentModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            list.reload();
          }}
        />
      )}
    </>
  );
}

function NewAppointmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', service: 'Consultation', date: '', time: '09:00', notes: '', status: 'CONFIRMED' });
  const { busy, run } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal
      open
      onClose={onClose}
      title="New appointment"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!form.date || !form.name}
            onClick={async () => {
              // Date and time are in the clinic's time zone; the server converts them.
              const ok = await run(() => api('/appointments', { body: form }), 'Appointment added');
              if (ok) onCreated();
            }}
          >
            Add appointment
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Patient name">{(id) => <Input id={id} required value={form.name} onChange={set('name')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Treatment">{(id) => <Input id={id} value={form.service} onChange={set('service')} />}</Field>
        <Field label="Date">{(id) => <Input id={id} type="date" required value={form.date} onChange={set('date')} />}</Field>
        <Field label="Time">{(id) => <Input id={id} type="time" required value={form.time} onChange={set('time')} />}</Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={set('status')}>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REQUESTED">Requested</option>
            </Select>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.notes} onChange={set('notes')} />}</Field>
      </div>
    </Modal>
  );
}
