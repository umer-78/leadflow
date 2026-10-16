import { AlertTriangle, BookOpen, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { time } from '../format.ts';
import type { Message } from '../types.ts';
import { Badge, cx } from '../ui.tsx';

const SKILL_LABELS: Record<string, string> = {
  knowledge: 'Answered from knowledge base',
  price: 'Price question',
  offer_slots: 'Offered appointment times',
  booked: 'Appointment requested',
  ask_contact: 'Asked for contact details',
  handoff: 'Handed off to the team',
  callback: 'Callback requested',
  urgent_callback: 'Urgent callback requested',
  safety_er: 'Emergency: sent to 911 / ER',
  safety_urgent: 'Urgent dental problem',
  safety_soon: 'Problem to check soon',
  diagnosis_request: 'Declined to diagnose',
  medication_question: 'Declined medication advice',
  opt_out: 'Opted out of follow-ups',
  fallback: "Couldn't answer",
};

/** A conversation with an optional "why did the assistant say this" view. */
export function Transcript({ messages }: { messages: Message[] }) {
  const [explain, setExplain] = useState(false);
  if (!messages.length) return <p className="text-sm text-slate-500">No messages.</p>;
  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={explain} onChange={(e) => setExplain(e.target.checked)} className="accent-teal-700" />
        Show how the assistant decided
      </label>
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={cx('flex flex-col', m.role === 'visitor' ? 'items-end' : 'items-start')}>
            <div
              className={cx(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                m.role === 'visitor' ? 'rounded-br-md bg-teal-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
              )}
            >
              {m.body}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span>{m.role === 'visitor' ? 'Visitor' : 'Assistant'} · {time(m.createdAt)}</span>
              {m.role === 'assistant' && m.meta.safety && (
                <Badge tone="red">
                  <AlertTriangle size={11} /> {m.meta.safetyReason ?? m.meta.safety}
                </Badge>
              )}
              {m.role === 'assistant' && m.meta.unanswered && (
                <Badge tone="amber">
                  <HelpCircle size={11} /> Unanswered
                </Badge>
              )}
            </div>
            {explain && m.role === 'assistant' && (
              <div className="mt-1 max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-[11px] text-slate-600">
                <p>
                  <span className="font-medium">Action:</span> {SKILL_LABELS[m.meta.skill ?? ''] ?? m.meta.skill ?? '—'}
                </p>
                {m.meta.intent && (
                  <p>
                    <span className="font-medium">Understood as:</span> {m.meta.intent.replace(/_/g, ' ')}
                    {m.meta.confidence !== undefined && ` (${Math.round(m.meta.confidence * 100)}% confident)`}
                  </p>
                )}
                {!!m.meta.sources?.length && (
                  <p className="flex flex-wrap items-center gap-1">
                    <BookOpen size={11} /> <span className="font-medium">Sources:</span> {m.meta.sources.map((s) => s.title).join(', ')}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
