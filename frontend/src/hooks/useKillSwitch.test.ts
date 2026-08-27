import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useKillSwitch } from './useKillSwitch';
import { ApiError } from '../api/client';

/**
 * Story 2.8 — useKillSwitch hook.
 * `fetch` is stubbed via `vi.stubGlobal` (same technique as client.test.ts);
 * no real network.
 */

function stubFetch(impl: (input: unknown, init?: RequestInit) => Promise<unknown>) {
  const spy = vi.fn(impl as () => Promise<Response>);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useKillSwitch', () => {
  it('starts disengaged, not pending, no error', () => {
    stubFetch(() => Promise.resolve(okResponse()));
    const { result } = renderHook(() => useKillSwitch());
    expect(result.current.engaged).toBe(false);
    expect(result.current.pending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('a resolved setEngaged(true) flips `engaged` and leaves `error` null', async () => {
    stubFetch(() => Promise.resolve(okResponse()));

    const { result } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(true));

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.engaged).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('stores the SERVER-confirmed value, not the requested one', async () => {
    // The POST for setEngaged(true) comes back saying the switch is actually off.
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"enabled":false}'),
      } as Response),
    );

    const { result } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(true));

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.engaged).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('a rejected setEngaged(true) sets `error` and LEAVES `engaged` false', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      } as Response),
    );

    const { result } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(true));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.engaged).toBe(false);
    expect(result.current.pending).toBe(false);
  });

  it('two synchronous setEngaged(true) calls fire fetch exactly once (in-flight guard)', async () => {
    const spy = stubFetch(() => Promise.resolve(okResponse()));

    const { result } = renderHook(() => useKillSwitch());
    act(() => {
      result.current.setEngaged(true);
      result.current.setEngaged(true);
    });

    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('setEngaged(false) when already false fires no fetch and changes nothing', () => {
    const spy = stubFetch(() => Promise.resolve(okResponse()));

    const { result } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(false));

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.engaged).toBe(false);
    expect(result.current.pending).toBe(false);
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

    const { result, unmount } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(true));
    expect(result.current.pending).toBe(true);

    unmount();
    expect(sawAbort).toBe(true);

    release?.();
    await gate;
    expect(result.current.engaged).toBe(false);
  });

  it('an AbortError rejection changes neither `error` nor `engaged`', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );

    const { result } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(true));
    await waitFor(() => expect(result.current.pending).toBe(false));

    expect(result.current.engaged).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reset() clears a prior error', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        text: () => Promise.resolve(''),
      } as Response),
    );

    const { result } = renderHook(() => useKillSwitch());
    act(() => result.current.setEngaged(true));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });
});
