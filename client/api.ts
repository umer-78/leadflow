import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Call the LeadFlow API. Throws ApiError with the server's message on failure. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? (init.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('leadflow:signed-out'));
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status}).`);
  }
  return data as T;
}

export interface Loadable<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
  setData: (fn: (prev: T | undefined) => T | undefined) => void;
}

/** Fetch `path` (or nothing when null) and re-fetch on reload() or when the path changes. */
export function useApi<T>(path: string | null): Loadable<T> {
  const [data, setDataState] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(!!path);
  const [version, setVersion] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const id = ++current.current;
    setLoading(true);
    setError(undefined);
    api<T>(path)
      .then((d) => id === current.current && setDataState(d))
      .catch((e: unknown) => id === current.current && setError(e instanceof Error ? e.message : 'Something went wrong.'))
      .finally(() => id === current.current && setLoading(false));
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((fn: (prev: T | undefined) => T | undefined) => setDataState((p) => fn(p)), []);
  return { data, error, loading, reload, setData };
}
