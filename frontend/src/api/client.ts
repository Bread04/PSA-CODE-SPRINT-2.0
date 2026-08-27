/**
 * Portwatch Console — Incident API client.
 *
 * Story 2.3 added the read path — the incident list endpoint:
 *   GET ${API_BASE}/incidents  →  Incident[]
 * Story 2.4 adds the ONE write path the console has — the approval action:
 *   POST ${API_BASE}/incidents/{id}/approval  (body: {@link ApprovalAction})
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

// ---------------------------------------------------------------------------
// Write path (Story 2.4) — the approval action, AD-11.
// ---------------------------------------------------------------------------

/**
 * The exact shape `POST /incidents/{id}/approval` accepts (AD-11). Exactly one
 * of three commands; `select_alternative` is the only one that carries a second
 * key, `option_id`. No free-form plan edit is ever expressible here.
 */
export type ApprovalAction =
  | { action: 'approve' }
  | { action: 'reject' }
  | { action: 'select_alternative'; option_id: string };

/**
 * POST an operator decision for a held Tier-3 (or kill-switch-blocked)
 * incident. The request body is serialised to EXACTLY the allowed keys — for
 * `approve` / `reject` just `{ action }`, for `select_alternative`
 * `{ action, option_id }` and nothing else. A `select_alternative` with a
 * missing / empty `option_id` throws an {@link ApiError} synchronously, before
 * any `fetch`.
 *
 * Same failure discipline as {@link fetchIncidents}: a network reject, a non-2xx
 * status, an unparseable body, or the {@link REQUEST_TIMEOUT_MS} timeout all
 * surface as an {@link ApiError}; a caller-initiated abort re-throws as-is.
 *
 * @param incidentId the incident to act on.
 * @param body one of the three {@link ApprovalAction} commands.
 * @param signal optional `AbortSignal` so an in-flight submit can be cancelled.
 */
export async function postApproval(
  incidentId: string,
  body: ApprovalAction,
  signal?: AbortSignal,
): Promise<unknown> {
  let payload: Record<string, string>;
  if (body.action === 'select_alternative') {
    if (typeof body.option_id !== 'string' || body.option_id.trim() === '') {
      throw new ApiError(
        "select_alternative requires a non-empty 'option_id'",
      );
    }
    payload = { action: 'select_alternative', option_id: body.option_id };
  } else {
    payload = { action: body.action };
  }

  const url = `${API_BASE.replace(/\/+$/, '')}/incidents/${encodeURIComponent(
    incidentId,
  )}/approval`;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: combined,
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new ApiError('POST /incidents/{id}/approval timed out');
    }
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiError(
      err instanceof Error
        ? err.message
        : 'Network request to /incidents/{id}/approval failed',
    );
  }

  if (!res.ok) {
    throw new ApiError(
      `POST /incidents/${incidentId}/approval failed with ${res.status}`,
      res.status,
    );
  }

  // A 2xx approval may legitimately return an empty body; tolerate that, wrap
  // any genuinely malformed JSON as an ApiError (never let a raw SyntaxError
  // escape into the caller / render tree).
  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new ApiError('POST /incidents/{id}/approval returned an unreadable body');
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('POST /incidents/{id}/approval returned invalid JSON');
  }
}
