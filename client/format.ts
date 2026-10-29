/** Display formatting. Dates are shown in the clinic's time zone. */

let clinicTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function setClinicTimeZone(tz: string) {
  clinicTimeZone = tz;
}

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: clinicTimeZone, ...opts }).format(new Date(iso));

export const dateTime = (iso: string) => fmt(iso, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const dayLabel = (iso: string) => fmt(iso, { weekday: 'long', month: 'long', day: 'numeric' });
export const shortDay = (iso: string) => fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
export const time = (iso: string) => fmt(iso, { hour: 'numeric', minute: '2-digit' });
/** YYYY-MM-DD in the clinic's zone (for grouping). */
export const dayKey = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return parts;
};

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`;
    if (f < 86_400) return `in ${Math.round(f / 3600)} h`;
    return `in ${Math.round(f / 86_400)} d`;
  }
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  if (s < 30 * 86_400) return `${Math.round(s / 86_400)} d ago`;
  return fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function phone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
}

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function priceRange(min: number | null, max: number | null, unit?: string | null): string {
  const r = min != null && max != null ? (min === max ? money(min) : `${money(min)}–${money(max)}`) : min != null ? `from ${money(min)}` : max != null ? `up to ${money(max)}` : '';
  return r ? `${r}${unit ? ` ${unit}` : ''}` : '';
}
