/**
 * Portwatch Console — AskPortwatch submit hook (Story 2.6).
 *
 * Wraps the read-only query path ({@link fetchQuery}) in a small, render-safe
 * state machine, modelled on {@link useApproval}:
 *   - `submit(q, incidentId?)` fires the GET. A call made while one is already
 *     in flight is ignored (serialised, not queued).
 *   - `submitting` is `true` from the moment a submit starts until its GET
 *     settles.
 *   - `answer` holds the last successful answer string, or `null`. A successful
 *     submit sets `answer` and clears `error`; a failed submit sets `error` and
 *     leaves the previous `answer` untouched.
 *   - `error` holds the last failure as an {@link ApiError}; a submit never
 *     throws into the render tree.
 *   - `reset()` clears both `answer` and `error`.
 *   - the in-flight request is aborted on unmount and no state is set after
 *     unmount.
 *
 * This hook does NO polling; it fires once per explicit `submit`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, fetchQuery } from '../api/client';

export interface UseAskPortwatchResult {
  /** Fire a query GET. No-ops if a submit is already in flight. */
  submit: (q: string, incidentId?: string) => void;
  /** The last successful answer string, or `null`. */
  answer: string | null;
  /** `true` while a GET is in flight. */
  submitting: boolean;
  /** The last submit failure, or `null`. Never thrown to render. */
  error: ApiError | null;
  /** Clear `answer` and `error`. */
  reset: () => void;
}

export function useAskPortwatch(): UseAskPortwatchResult {
  const [answer, setAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Refs so `submit` stays referentially stable and re-entrancy is caught
  // synchronously (a state flag would lag a burst of clicks).
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const submit = useCallback((q: string, incidentId?: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    void (async () => {
      try {
        const { answer: next } = await fetchQuery(q, incidentId, controller.signal);
        if (!mountedRef.current) return;
        setAnswer(next);
        setError(null);
      } catch (err) {
        if (!mountedRef.current) return;
        if ((err as { name?: string } | undefined)?.name === 'AbortError') return;
        setError(
          err instanceof ApiError
            ? err
            : new ApiError(err instanceof Error ? err.message : 'Query failed'),
        );
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setSubmitting(false);
      }
    })();
  }, []);

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setAnswer(null);
      setError(null);
    }
  }, []);

  return { submit, answer, submitting, error, reset };
}
