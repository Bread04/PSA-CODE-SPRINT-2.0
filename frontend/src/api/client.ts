/**
 * Portwatch Console — Incident API client (Story 2.3).
 *
 * Read-only. This story consumes the list endpoint ONLY:
 *   GET ${API_BASE}/incidents  →  Incident[]
 * No `GET /incidents/{id}`, no write calls — those arrive with stories 2.4–2.9.
 *
 * `API_BASE` comes from `import.meta.env.VITE_API_BASE_URL`; the default `''`
 * means same-origin. Every failure — a network reject, a non-2xx response, a
 * body that is not a JSON array, or a request timeout — is surfaced as a typed
 * `ApiError` so the polling hook can keep the last-good data and never throw
 * into the React render tree. A caller-initiated abort is re-thrown as-is.
 */

import type { Incident } from '../types/incident';

/** API origin + path prefix. `''` (default) → same-origin requests. */
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '';

/** Hard ceiling on a single list request so a hung poll can't stall forever. */
const REQUEST_TIMEOUT_MS = 7500;

/** Thrown by {@link fetchIncidents} on any network, HTTP, parse, or timeout failure. */
export class ApiError extends Error {
  /** HTTP status code when the request completed with a non-2xx response. */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    // Keep `instanceof ApiError` working after TS downlevels `extends Error`.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function isAbortError(err: unknown): boolean {
  return (err as { name?: string } | null | undefined)?.name === 'AbortError';
}

function isTimeoutError(err: unknown): boolean {
  return (err as { name?: string } | null | undefined)?.name === 'TimeoutError';
}

/**
 * GET the incident list. Resolves with the parsed `Incident[]`; rejects with
 * an {@link ApiError} on a network failure, a non-2xx status, a non-array /
 * unparseable body, or the {@link REQUEST_TIMEOUT_MS} timeout. A caller abort
 * rejects with the original `AbortError` (not wrapped).
 *
 * @param signal optional `AbortSignal` so an in-flight poll can be cancelled
 *   on unmount.
 */
export async function fetchIncidents(signal?: AbortSignal): Promise<Incident[]> {
  const url = `${API_BASE.replace(/\/+$/, '')}/incidents`;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, { signal: combined });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ApiError('GET /incidents timed out');
    }
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request to /incidents failed',
    );
  }

  if (!res.ok) {
    throw new ApiError(`GET /incidents failed with ${res.status}`, res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('GET /incidents returned invalid JSON');
  }

  if (!Array.isArray(data)) {
    throw new ApiError('GET /incidents did not return an array');
  }

  return data as Incident[];
}
