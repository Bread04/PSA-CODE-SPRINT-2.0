/**
 * Portwatch Console — demo-trigger hook (spec-demo-three-way-disruption-trigger).
 *
 * Wraps the dev-only demo write path ({@link postDemoTrigger}) in a small,
 * render-safe state machine, modelled on {@link useKillSwitch}:
 *   - `trigger(onStarted?)` fires the POST. It no-ops while a POST is already in
 *     flight or while the `running` window is still open (re-entrancy guard).
 *   - `pending` is `true` from the moment a POST starts until it settles.
 *   - on success `running` opens for a ~30s window (`setTimeout`, cleared on
 *     unmount) and `onStarted` is called with `primary_incident_id` so the
 *     caller can select the incident and refetch; `error` is cleared.
 *   - on failure `error` is set and `running` is LEFT UNCHANGED.
 *   - `reset()` clears `error`.
 *   - the in-flight request is aborted on unmount and no state is set afterwards.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, postDemoTrigger } from '../api/client';

/** How long the "Demo running…" window stays open after a successful trigger. */
export const DEMO_RUNNING_WINDOW_MS = 30_000;

export interface UseDemoTriggerResult {
  /** `true` for ~30s after a successful trigger — the run is on screen. */
  running: boolean;
  /** `true` while the trigger POST is in flight. */
  pending: boolean;
  /** The last POST failure, or `null`. Never thrown to render. */
  error: ApiError | null;
  /** Fire the demo trigger. No-ops while `pending` or `running`. */
  trigger: (onStarted?: (primaryIncidentId: string | null) => void) => void;
  /** Clear `error`. */
  reset: () => void;
}

export function useDemoTrigger(): UseDemoTriggerResult {
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Refs so `trigger` stays referentially stable and the re-entrancy no-op is
  // caught synchronously (a state flag would lag a burst of clicks).
  const inFlightRef = useRef(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      if (timerRef.current != null) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(
    (onStarted?: (primaryIncidentId: string | null) => void) => {
      if (inFlightRef.current || runningRef.current) return;
      inFlightRef.current = true;
      setPending(true);
      setError(null);

      const controller = new AbortController();
      controllerRef.current = controller;

      void (async () => {
        // `onStarted` is a caller-supplied callback — a throw from it must NOT
        // land in the `catch` below and set `error` while `running` is already
        // true. Fire it once, after the try/catch/finally has settled cleanly.
        let succeeded = false;
        let startedId: string | null = null;
        try {
          const { primary_incident_id } = await postDemoTrigger(controller.signal);
          if (!mountedRef.current) return;

          runningRef.current = true;
          setRunning(true);
          if (timerRef.current != null) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            runningRef.current = false;
            timerRef.current = null;
            if (mountedRef.current) setRunning(false);
          }, DEMO_RUNNING_WINDOW_MS);

          succeeded = true;
          startedId = primary_incident_id;
        } catch (err) {
          if (!mountedRef.current) return;
          if ((err as { name?: string } | undefined)?.name === 'AbortError') return;
          // Leave `running` unchanged — the trigger did not take effect.
          setError(
            err instanceof ApiError
              ? err
              : new ApiError(
                  err instanceof Error ? err.message : 'Demo trigger failed',
                ),
          );
        } finally {
          inFlightRef.current = false;
          if (mountedRef.current) setPending(false);
        }

        if (succeeded) {
          try {
            onStarted?.(startedId);
          } catch {
            // A consumer callback throwing is not the hook's failure — the run
            // did start. Swallow it so it neither sets `error` nor surfaces as
            // an unhandled rejection.
          }
        }
      })();
    },
    [],
  );

  const reset = useCallback(() => {
    if (mountedRef.current) setError(null);
  }, []);

  return { running, pending, error, trigger, reset };
}
