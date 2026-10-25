import { AlertTriangle, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import type { PageProps } from '../App.tsx';
import { api, useApi } from '../api.ts';
import { Transcript } from '../components/Transcript.tsx';
import { dateTime, phone, timeAgo } from '../format.ts';
import { navigate } from '../router.ts';
import type { Conversation, Lead, Message } from '../types.ts';
import { Badge, Button, Card, Drawer, EmptyState, ErrorNote, Loading, PageHeader, TierBadge, cx, useAction } from '../ui.tsx';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'leads', label: 'Became leads' },
];

export function ConversationsPage({ can, conversationId }: PageProps & { conversationId?: string }) {
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const list = useApi<{ items: Conversation[]; total: number }>(`/conversations?filter=${filter}&limit=25&offset=${offset}`);

  return (
    <>
      <PageHeader title="Conversations" subtitle="Every chat on your website, with what the assistant understood and why it answered the way it did." />
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm sm:inline-flex" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => {
              setFilter(f.key);
              setOffset(0);
            }}
            className={cx('flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium', filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      <Card padded={false}>
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data?.items.length ? (
          <EmptyState icon={<MessagesSquare size={28} />} title="No conversations here yet" text="Chats from your website widget appear here in real time." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.data.items.map((c) => (
              <li key={c.id}>
                <a href={`#/conversations/${c.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                  {c.needsAttention ? (
                    <AlertTriangle size={18} className="mt-0.5 flex-none text-red-600" aria-label="Needs attention" />
                  ) : (
                    <MessagesSquare size={18} className="mt-0.5 flex-none text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">“{c.preview || '…'}”</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span>{c.leadName ?? (c.leadId ? 'Lead' : 'Anonymous visitor')}</span>
                      <span>· {c.messageCount} messages</span>
                      <span>· {timeAgo(c.lastMessageAt)}</span>
                      {c.attentionReason && c.needsAttention && <Badge tone="red">{c.attentionReason}</Badge>}
                      {c.leadTier && <TierBadge tier={c.leadTier} />}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {list.data && list.data.total > 25 && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>
            Previous
          </Button>
          <Button size="sm" disabled={offset + 25 >= list.data.total} onClick={() => setOffset(offset + 25)}>
            Next
          </Button>
        </div>
      )}
      {conversationId && <ConversationPanel id={conversationId} can={can} onChanged={list.reload} onClose={() => navigate('/conversations')} />}
    </>
  );
}

function ConversationPanel({ id, can, onClose, onChanged }: { id: string; can: PageProps['can']; onClose: () => void; onChanged: () => void }) {
  const detail = useApi<{ conversation: Conversation; lead: Lead | null; messages: Message[] }>(`/conversations/${id}`);
  const { busy, run } = useAction();
  const c = detail.data?.conversation;

  async function patch(body: Record<string, unknown>, message: string) {
    const updated = await run(() => api<Partial<Conversation>>(`/conversations/${id}`, { method: 'PATCH', body }), message);
    if (updated) {
      detail.setData((d) => (d ? { ...d, conversation: { ...d.conversation, ...updated } } : d));
      onChanged();
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Conversation</h2>
          {c && <p className="text-xs text-slate-500">Started {dateTime(c.createdAt)}{c.pageUrl ? ` · ${c.pageUrl}` : ''}</p>}
        </div>
      }
    >
      {detail.error && <ErrorNote error={detail.error} onRetry={detail.reload} />}
      {!detail.data || !c ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          {c.needsAttention && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <span className="flex items-center gap-2">
                <AlertTriangle size={16} /> {c.attentionReason ?? 'Needs attention'}
              </span>
              {can('STAFF') && (
                <Button size="sm" loading={busy} onClick={() => void patch({ needsAttention: false }, 'Marked as handled')}>
                  Mark as handled
                </Button>
              )}
            </div>
          )}
          {detail.data.lead ? (
            <a href={`#/leads/${detail.data.lead.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50">
              <span>
                <span className="font-medium text-slate-900">{detail.data.lead.name ?? 'Lead'}</span>
                <span className="text-slate-500"> · {phone(detail.data.lead.phone) || detail.data.lead.email}</span>
              </span>
              <TierBadge tier={detail.data.lead.tier} score={detail.data.lead.score} />
            </a>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">This visitor hasn't shared contact details.</p>
          )}
          <Transcript messages={detail.data.messages} />
          {can('STAFF') && (
            <div className="flex justify-end">
              <Button size="sm" loading={busy} onClick={() => void patch({ status: c.status === 'CLOSED' ? 'OPEN' : 'CLOSED' }, c.status === 'CLOSED' ? 'Reopened' : 'Closed')}>
                {c.status === 'CLOSED' ? 'Reopen' : 'Close conversation'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
