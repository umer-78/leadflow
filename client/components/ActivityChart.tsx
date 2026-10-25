import { useState } from 'react';

/**
 * 14-day grouped columns: conversations vs. leads captured per day.
 * Colors are the validated categorical slots 1 and 2 (blue, orange);
 * text stays in neutral ink; one shared count axis.
 */
const SERIES = [
  { key: 'conversations', label: 'Conversations', color: '#2a78d6' },
  { key: 'leads', label: 'Leads captured', color: '#eb6834' },
] as const;

type Point = { day: string; conversations: number; leads: number };

const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T00:00:00Z`));

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n / 4)! * pow;
  return Math.ceil(n / step) * step;
}

export function ActivityChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.conversations, d.leads])));
  const ticks = [max, max / 2, 0];
  const total = data.reduce((s, d) => ({ c: s.c + d.conversations, l: s.l + d.leads }), { c: 0, l: 0 });

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600" aria-hidden="true">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2" aria-hidden="true">
        <div className="flex h-40 flex-col justify-between pb-0 text-right text-[11px] tabular-nums text-slate-400">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" />
            <div className="absolute inset-x-0 bottom-0 border-t border-slate-300" />
          </div>
          <div className="relative flex h-40 items-end">
            {data.map((d, i) => (
              <div
                key={d.day}
                className="group relative flex h-full flex-1 items-end justify-center gap-[2px] outline-none"
                tabIndex={0}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              >
                <div className={`absolute inset-y-0 inset-x-[2px] rounded-md ${hover === i ? 'bg-slate-100' : ''}`} />
                {SERIES.map((s) => {
                  const v = d[s.key];
                  return (
                    <div
                      key={s.key}
                      className="relative w-[min(12px,32%)] rounded-t-[4px]"
                      style={{ height: v ? `max(2px, ${(v / max) * 100}%)` : 0, background: s.color }}
                    />
                  );
                })}
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="font-medium text-slate-800">{dayLabel(d.day, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    {SERIES.map((s) => (
                      <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-slate-600">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                        {s.label}: <span className="font-medium tabular-nums text-slate-900">{d[s.key]}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex text-[11px] text-slate-400">
            {data.map((d, i) => (
              <span key={d.day} className="flex-1 whitespace-nowrap text-center">
                {(data.length - 1 - i) % 3 === 0 ? dayLabel(d.day, { month: 'short', day: 'numeric' }) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        Last {data.length} days: {total.c} conversations and {total.l} leads captured.
      </figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            <th>Conversations</th>
            <th>Leads captured</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.conversations}</td>
              <td>{d.leads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
