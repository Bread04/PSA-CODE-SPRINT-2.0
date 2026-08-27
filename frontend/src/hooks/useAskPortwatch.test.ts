import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useAskPortwatch } from './useAskPortwatch';
import { ApiError } from '../api/client';

/**
 * Story 2.6 — useAskPortwatch hook.
 * `fetch` is stubbed via `vi.stubGlobal` (same technique as client.test.ts);
 * no real network.
 */

function stubFetch(impl: (input: unknown, init?: RequestInit) => Promise<unknown>) {
  const spy = vi.fn(impl as () => Promise<Response>);
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonResponse(answer: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ answer }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAskPortwatch', () => {
  it('a resolved query sets `answer` and leaves `error` null', async () => {
    stubFetch(() => Promise.resolve(jsonResponse('MSC Anna: berth B3.')));

    const { result } = renderHook(() => useAskPortwatch());
    act(() => result.current.submit('where is MSC Anna'));

    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(result.current.answer).toBe('MSC Anna: berth B3.');
    expect(result.current.error).toBeNull();
  });

  it('a rejected query sets `error` and keeps a previously-set `answer` intact', async () => {
    const spy = stubFetch(() => Promise.resolve(jsonResponse('first answer')));

    const { result } = renderHook(() => useAskPortwatch());
    act(() => result.current.submit('q1'));
    await waitFor(() => expect(result.current.answer).toBe('first answer'));

    spy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response),
    );
    act(() => result.current.submit('q2'));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.answer).toBe('first answer');
  });

  it('two synchronous submit() calls fire fetch exactly once (in-flight guard)', async () => {
    const spy = stubFetch(() => Promise.resolve(jsonResponse('ok')));

    const { result } = renderHook(() => useAskPortwatch());
    act(() => {
      result.current.submit('q');
      result.current.submit('q again');
    });

    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unmount while a request is in flight → no state update afterwards, controller aborted', async () => {
    let sawAbort = false;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((res) => {
      release = res;
    });

    stubFetch((_input, init) => {
      (init?.signal as AbortSignal | undefined)?.addEventListener('abort', () => {
        sawAbort = true;
      });
      return gate.then(() => jsonResponse('late answer'));
    });

    const { result, unmount } = renderHook(() => useAskPortwatch());
    act(() => result.current.submit('q'));
    expect(result.current.submitting).toBe(true);

    unmount();
    expect(sawAbort).toBe(true);

    release?.();
    await gate;
    // No act() warning and no post-unmount state change (answer never set).
    expect(result.current.answer).toBeNull();
  });

  it('an AbortError rejection changes neither `error` nor `answer`', async () => {
    stubFetch(() => Promise.resolve(jsonResponse('kept')));
    const { result } = renderHook(() => useAskPortwatch());
    act(() => result.current.submit('q1'));
    await waitFor(() => expect(result.current.answer).toBe('kept'));

    stubFetch(() =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );
    act(() => result.current.submit('q2'));
    await waitFor(() => expect(result.current.submitting).toBe(false));

    expect(result.current.answer).toBe('kept');
    expect(result.current.error).toBeNull();
  });
});
