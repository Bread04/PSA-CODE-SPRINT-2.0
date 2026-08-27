/**
 * Portwatch Console — incident polling hook (Story 2.3).
 *
 * Polls `GET /incidents` on mount and every `POLL_INTERVAL_MS`. Behaviour the
 * feed depends on:
 *   - a failed poll NEVER clears `incidents` — the last successful list stays,
 *     and `error` is exposed instead (no empty-list flash).
 *   - overlapping / out-of-order polls can't clobber a newer result: each poll
 *     carries a monotonic sequence token and only a response newer than the
 *     last committed one commits state.
 *   - `isStale` flips true once `Date.now() - lastUpdatedAt` exceeds
 *     `STALE_AFTER_MS`; a single re-armed timeout (not a permanent interval)
 *     crosses that threshold.
 *   - `refetch()` issues an immediate out-of-band poll (Story 2.4 will trigger
 *     one right after an approve / reject).
 *   - the in-flight request is aborted and every timer is cleared on unmount,
 *     and no state is set after unmount (no act() warning).
 *
 * Read-only: list endpoint only, no websocket/SSE, no state library.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, fetchIncidents } from '../api/client';
import type { Incident } from '../types/incident';

export const POLL_INTERVAL_MS = 2500;
export const STALE_AFTER_MS = 8000;

export interface UseIncidentsResult {
  /** Last successfully fetched list; `[]` until the first poll resolves. */
  incidents: Incident[];
  /** `Date.now()` of the last successful poll, or `null` if none has succeeded. */
  lastUpdatedAt: number | null;
  /** True once the last success is older than `STALE_AFTER_MS`. */
  isStale: boolean;
  /** The most recent poll failure, or `null` while polling is healthy. */
  error: ApiError | null;
  /** Trigger an immediate out-of-band poll (does not disturb the interval). */
  refetch: () => void;
}

export function useIncidents(): UseIncidentsResult {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Stable handle to the current effect's poll fn, swapped in on mount and
  // nulled on unmount so `refetch` can never fire after teardown.
  const pollRef = useRef<() => void>(() => {});
  const refetch = useCallback(() => pollRef.current(), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let seq = 0; // next request-sequence token
    let committed = 0; // highest seq whose response has already committed state

    const poll = async (): Promise<void> => {
      const mySeq = ++seq;
      try {
        const next = await fetchIncidents(controller.signal);
        if (cancelled || mySeq <= committed) return;
        committed = mySeq;
        setIncidents(Array.isArray(next) ? next : []);
        setLastUpdatedAt(Date.now());
        setError(null);
      } catch (err) {
        if (cancelled) return;
        if ((err as { name?: string } | undefined)?.name === 'AbortError') return;
        if (mySeq <= committed) return;
        committed = mySeq;
        // Keep the last-good `incidents` untouched — only surface the error.
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(err instanceof Error ? err.message : 'poll failed'),
        );
      }
    };

    pollRef.current = () => void poll();

    void poll();
    const pollId = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(pollId);
      pollRef.current = () => {};
    };
  }, []);

  // Staleness threshold crossing: re-arm a single timeout for the time left
  // until the last success goes stale. Once past the threshold `isStale` is
  // already true and stable, so no further ticking is needed (P20).
  useEffect(() => {
    if (lastUpdatedAt === null) return;
    const remaining = STALE_AFTER_MS - (Date.now() - lastUpdatedAt);
    if (remaining <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), remaining + 50);
    return () => clearTimeout(id);
  }, [lastUpdatedAt, now]);

  const isStale =
    lastUpdatedAt !== null && now - lastUpdatedAt > STALE_AFTER_MS;

  return { incidents, lastUpdatedAt, isStale, error, refetch };
}
