/**
 * Portwatch Console — approval submit hook (Story 2.4).
 *
 * Wraps the one write path ({@link postApproval}) in a small, render-safe state
 * machine:
 *   - `submit(incidentId, body)` fires the POST. A call made while one is
 *     already in flight is ignored (serialised, not queued).
 *   - `submitting` is `true` from the moment a submit starts until its POST
 *     settles.
 *   - `error` holds the last failure as an {@link ApiError}; a submit never
 *     throws into the render tree. A subsequent successful submit clears it.
 *   - `onSuccess` (optional) is called after a POST resolves — the integration
 *     wires it to `useIncidents().refetch` so the feed/detail reflect the new
 *     approval state on the next poll. This hook itself does NO polling.
 *   - `reset()` clears `error` on demand.
 *   - the in-flight request is aborted on unmount and no state is set after
 *     unmount (no act() warning).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, postApproval } from '../api/client';
import type { ApprovalAction } from '../api/client';

export interface UseApprovalResult {
  /** Fire an approval POST. No-ops if a submit is already in flight. */
  submit: (incidentId: string, body: ApprovalAction) => void;
  /** `true` while a POST is in flight. */
  submitting: boolean;
  /** The last submit failure, or `null`. Never thrown to render. */
  error: ApiError | null;
  /** Clear `error`. */
  reset: () => void;
}

export function useApproval(onSuccess?: () => void): UseApprovalResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Refs so `submit` stays referentially stable and re-entrancy is caught
  // synchronously (a state flag would lag a burst of clicks).
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const submit = useCallback((incidentId: string, body: ApprovalAction) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    void (async () => {
      try {
        await postApproval(incidentId, body, controller.signal);
        if (!mountedRef.current) return;
        setError(null);
        onSuccessRef.current?.();
      } catch (err) {
        if (!mountedRef.current) return;
        if ((err as { name?: string } | undefined)?.name === 'AbortError') return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(err instanceof Error ? err.message : 'Approval submit failed'),
        );
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setSubmitting(false);
      }
    })();
  }, []);

  const reset = useCallback(() => {
    if (mountedRef.current) setError(null);
  }, []);

  return { submit, submitting, error, reset };
}
