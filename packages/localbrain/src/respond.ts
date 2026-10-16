/**
 * Small helpers for writing natural replies.
 */
import { hash } from './text.ts';

/** Pick one option deterministically from a seed (varied but reproducible replies). */
export function choose<T>(options: readonly T[], seed: string): T {
  return options[hash(seed) % options.length];
}

/** Fill {{placeholders}}; missing values become empty strings. */
export function render(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** ["a", "b", "c"] -> "a, b and c" */
export function joinList(items: readonly string[], conjunction = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Trim to at most `max` characters on a word boundary, adding an ellipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,;:\s]+$/, '') + '…';
}
