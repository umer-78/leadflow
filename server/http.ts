/**
 * HTTP helpers: typed errors, async route wrapper and small input validators.
 */
import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async route so rejected promises reach the error middleware. */
export const route =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }
  console.error('[http] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}

// ---------------------------------------------------------------- validation

type Body = Record<string, unknown>;

export function body(req: Request): Body {
  return req.body && typeof req.body === 'object' ? (req.body as Body) : {};
}

export function str(b: Body, key: string, opts: { required?: boolean; max?: number; min?: number } = {}): string | undefined {
  const v = b[key];
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    if (opts.required) throw new HttpError(400, `${key} is required.`);
    return undefined;
  }
  if (typeof v !== 'string') throw new HttpError(400, `${key} must be text.`);
  const s = v.trim();
  if (opts.min && s.length < opts.min) throw new HttpError(400, `${key} must be at least ${opts.min} characters.`);
  if (s.length > (opts.max ?? 5000)) throw new HttpError(400, `${key} is too long.`);
  return s;
}

/** Like str(), but distinguishes "absent" (undefined) from "cleared" (null). */
export function nullableStr(b: Body, key: string, max = 5000): string | null | undefined {
  if (!(key in b)) return undefined;
  const v = b[key];
  if (v === null || (typeof v === 'string' && v.trim() === '')) return null;
  return str(b, key, { max });
}

export function int(b: Body, key: string, opts: { min?: number; max?: number } = {}): number | null | undefined {
  if (!(key in b)) return undefined;
  const v = b[key];
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, `${key} must be a whole number.`);
  if (opts.min !== undefined && n < opts.min) throw new HttpError(400, `${key} must be at least ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new HttpError(400, `${key} must be at most ${opts.max}.`);
  return n;
}

export function bool(b: Body, key: string): boolean | undefined {
  if (!(key in b)) return undefined;
  if (typeof b[key] !== 'boolean') throw new HttpError(400, `${key} must be true or false.`);
  return b[key] as boolean;
}

export function oneOf<T extends string>(b: Body, key: string, allowed: readonly T[]): T | undefined {
  const v = str(b, key);
  if (v === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(v)) throw new HttpError(400, `${key} must be one of: ${allowed.join(', ')}.`);
  return v as T;
}

export function email(b: Body, key: string, required = false): string | undefined {
  const v = str(b, key, { required, max: 254 });
  if (v === undefined) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, `${key} must be a valid email address.`);
  return v.toLowerCase();
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function uuidParam(req: Request, name = 'id'): string {
  const v = req.params[name];
  if (!v || !isUuid(v)) throw new HttpError(404, 'Not found.');
  return v;
}
