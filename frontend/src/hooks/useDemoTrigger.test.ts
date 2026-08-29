import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useDemoTrigger, DEMO_RUNNING_WINDOW_MS } from './useDemoTrigger';
import { ApiError } from '../api/client';

/**
 * spec-demo-three-way-disruption-trigger — useDemoTrigger hook.
 * `fetch` is stubbed via `vi.stubGlobal` (same technique as useKillSwitch.test.ts);
 * no real network.
 */

function stubFetch(impl: (input: unknown, init?: RequestInit) => Promise<unknown>) {
  const spy = vi.fn(impl as () => Promise<Response>);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function okResponse(body = '{"started":true,"primary_incident_id":"inc-A"}') {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(body),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useDemoTrigger', () => {
  it('starts not running, not pending, no error', () => {
    stubFetch(() => Promise.resolve(okResponse()));
    const { result } = renderHook(() => useDemoTrigger());
    expect(result.current.running).toBe(false);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('a resolved trigger() opens the running window and passes primary_incident_id to the callback', async () => {
    stubFetch(() => Promise.resolve(okResponse()));
    const onStarted = vi.fn();

    const { result } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger(onStarted));

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.running).toBe(true);
    expect(result.current.error).toBeNull();
    expect(onStarted).toHaveBeenCalledWith('inc-A');
  });

  it('a throwing onStarted callback does not set `error` and leaves `running` true', async () => {
    stubFetch(() => Promise.resolve(okResponse()));
    const onStarted = vi.fn(() => {
      throw new Error('consumer blew up');
    });

    const { result } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger(onStarted));

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('two synchronous trigger() calls fire fetch exactly once (in-flight guard)', async () => {
    const spy = stubFetch(() => Promise.resolve(okResponse()));

    const { result } = renderHook(() => useDemoTrigger());
    act(() => {
      result.current.trigger();
      result.current.trigger();
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('trigger() while the running window is still open is a no-op', async () => {
    const spy = stubFetch(() => Promise.resolve(okResponse()));

    const { result } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger());
    await waitFor(() => expect(result.current.running).toBe(true));

    act(() => result.current.trigger());
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('the running window closes after DEMO_RUNNING_WINDOW_MS', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      stubFetch(() => Promise.resolve(okResponse()));
      const { result } = renderHook(() => useDemoTrigger());

      act(() => result.current.trigger());
      await vi.waitFor(() => expect(result.current.running).toBe(true));

      await act(async () => {
        vi.advanceTimersByTime(DEMO_RUNNING_WINDOW_MS + 1);
      });
      expect(result.current.running).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a rejected trigger() sets `error` and LEAVES `running` false', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 409,
        text: () => Promise.resolve(''),
      } as Response),
    );

    const { result } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger());

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.running).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it('an AbortError rejection changes neither `error` nor `running`', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );

    const { result } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger());
    await waitFor(() => expect(result.current.pending).toBe(false));

    expect(result.current.running).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('unmount mid-flight → no state update afterwards, controller aborted', async () => {
    let sawAbort = false;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((res) => {
      release = res;
    });

    stubFetch((_input, init) => {
      (init?.signal as AbortSignal | undefined)?.addEventListener('abort', () => {
        sawAbort = true;
      });
      return gate.then(() => okResponse());
    });

    const { result, unmount } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger());
    expect(result.current.pending).toBe(true);

    unmount();
    expect(sawAbort).toBe(true);

    release?.();
    await gate;
    expect(result.current.running).toBe(false);
  });

  it('reset() clears a prior error', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        text: () => Promise.resolve(''),
      } as Response),
    );

    const { result } = renderHook(() => useDemoTrigger());
    act(() => result.current.trigger());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
