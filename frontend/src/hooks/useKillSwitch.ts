/**
 * Portwatch Console — kill-switch hook (Story 2.8).
 *
 * Wraps the one kill-switch write path ({@link postKillSwitch}) in a small,
 * render-safe state machine, modelled on {@link useApproval}:
 *   - `engaged` starts `false` and only moves after a POST this session
 *     confirmed. AD-7 exposes no read endpoint, so there is nothing to
 *     rehydrate on load.
 *   - `setEngaged(next)` fires the POST. It no-ops if a POST is already in
 *     flight (serialised, not queued) or if `next === engaged` already.
 *   - `pending` is `true` from the moment a POST starts until it settles.
 *   - on success `engaged` becomes `next` and `error` is cleared; on failure
 *     `error` is set and `engaged` is LEFT UNCHANGED — the switch never shows a
 *     state the backend did not accept.
 *   - `reset()` clears `error`.
 *   - the in-flight request is aborted on unmount and no state is set after
 *     unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, postKillSwitch } from '../api/client';

export interface UseKillSwitchResult {
  /** `true` once a POST has confirmed the switch is engaged. Starts `false`. */
  engaged: boolean;
  /** `true` while a kill-switch POST is in flight. */
  pending: boolean;
  /** The last POST failure, or `null`. Never thrown to render. */
  error: ApiError | null;
  /** Request a new switch state. No-ops while `pending` or if `next === engaged`. */
  setEngaged: (next: boolean) => void;
  /** Clear `error`. */
  reset: () => void;
}

export function useKillSwitch(): UseKillSwitchResult {
  const [engaged, setEngagedState] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Refs so `setEngaged` stays referentially stable and re-entrancy / the
  // `next === engaged` no-op are caught synchronously (a state flag would lag a
  // burst of clicks).
  const inFlightRef = useRef(false);
  const engagedRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const setEngaged = useCallback((next: boolean) => {
    if (inFlightRef.current) return;
    if (next === engagedRef.current) return;
    inFlightRef.current = true;
    setPending(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    void (async () => {
      try {
        const { enabled: confirmed } = await postKillSwitch(
          next,
          controller.signal,
        );
        if (!mountedRef.current) return;
        // Trust the server-confirmed value, not the request (the client's
        // empty-body path already echoes `next`, so the agree-case is a no-op).
        engagedRef.current = confirmed;
        setEngagedState(confirmed);
        setError(null);
      } catch (err) {
        if (!mountedRef.current) return;
        if ((err as { name?: string } | undefined)?.name === 'AbortError') return;
        // Leave `engaged` unchanged — the toggle did not take effect.
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(
                err instanceof Error ? err.message : 'Kill switch update failed',
              ),
        );
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setPending(false);
      }
    })();
  }, []);

  const reset = useCallback(() => {
    if (mountedRef.current) setError(null);
  }, []);

  return { engaged, pending, error, setEngaged, reset };
}
