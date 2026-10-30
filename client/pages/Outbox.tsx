import { Mail } from 'lucide-react';
import { useState } from 'react';
import type { PageProps } from '../App.tsx';
import { useApi } from '../api.ts';
import { dateTime, outboundLabel } from '../format.ts';
import type { Outbound } from '../types.ts';
import { Button, Card, EmptyState, ErrorNote, Loading, Modal, OutboundStatusBadge, PageHeader } from '../ui.tsx';

const KIND = (o: Outbound) => outboundLabel(o);

export function OutboxPage(_: PageProps) {
  const [offset, setOffset] = useState(0);
  const list = useApi<{ items: Outbound[]; total: number; emailLive: boolean }>(`/outbox?limit=50&offset=${offset}`);
  const [open, setOpen] = useState<Outbound>();

  return (
    <>
      <PageHeader title="Emails" subtitle="Follow-ups to patients, appointment confirmations and alerts to your team." />
      {list.data && !list.data.emailLive && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Email sending isn't connected yet, so messages are written and logged here instead of sent. Set <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> and{' '}
          <code className="rounded bg-amber-100 px-1">EMAIL_FROM</code> on the server to deliver them.
        </div>
      )}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.items.length ? (
          <EmptyState icon={<Mail size={28} />} title="No emails yet" text="Follow-ups start when a lead leaves an email address. Alerts go to your notification email." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">To</th>
                  <th className="px-4 py-2.5 font-medium">Subject</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(o)}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{dateTime(o.sentAt ?? o.scheduledFor)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{KIND(o)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">{o.leadName ? `${o.leadName} · ` : ''}{o.toAddress || '—'}</td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-slate-900">{o.body ? o.subject : <span className="text-slate-400">Written when sent</span>}</td>
                    <td className="px-4 py-3">
                      <OutboundStatusBadge status={o.status} reason={o.statusReason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {list.data && list.data.total > 50 && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
            Newer
          </Button>
          <Button size="sm" disabled={offset + 50 >= list.data.total} onClick={() => setOffset(offset + 50)}>
            Older
          </Button>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(undefined)} title={open ? KIND(open) : ''} wide>
        {open && (
          <div className="space-y-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-slate-500">
              To {open.toAddress || '—'} <OutboundStatusBadge status={open.status} /> {open.statusReason && <span className="text-xs">{open.statusReason}</span>}
            </p>
            {open.body ? (
              <>
                <p className="font-medium text-slate-900">{open.subject}</p>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-slate-800">{open.body}</pre>
              </>
            ) : (
              <p className="text-slate-500">Scheduled for {dateTime(open.scheduledFor)}. The content is written when it is sent, from the lead's latest details and your knowledge base.</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
