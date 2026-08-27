import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ApiError, fetchIncidents } from '../api/client';
import type { Incident } from '../types/incident';
import {
  tier1Resolved,
  tier2Resolved,
  tier3PendingNewer,
} from '../test/fixtures/incidents';
import {
  POLL_INTERVAL_MS,
  STALE_AFTER_MS,
  useIncidents,
} from './useIncidents';

/**
 * Story 2.3 — useIncidents polling hook.
 *
 * `fetchIncidents` is module-mocked; fake timers drive the poll + staleness
 * clock (`vi.useFakeTimers()` also fakes `Date`, so `Date.now()` is
 * deterministic here).
 */

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return { ...actual, fetchIncidents: vi.fn() };
});

const mockFetch = vi.mocked(fetchIncidents);

/** Flush the pending poll microtask(s) without advancing wall time. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIncidents', () => {
  it('poll success populates incidents, lastUpdatedAt, clears error, not stale', async () => {
    mockFetch.mockResolvedValue([tier1Resolved]);

    const { result } = renderHook(() => useIncidents());
    await flush();

    expect(result.current.incidents).toEqual([tier1Resolved]);
    expect(result.current.lastUpdatedAt).toBeTypeOf('number');
    expect(result.current.isStale).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('polls again on the interval', async () => {
    mockFetch.mockResolvedValue([tier1Resolved]);
    renderHook(() => useIncidents());
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('a failed poll after a success keeps the last-good list and sets error', async () => {
    mockFetch.mockResolvedValueOnce([tier1Resolved, tier3PendingNewer]);
    const { result } = renderHook(() => useIncidents());
    await flush();
    expect(result.current.incidents).toHaveLength(2);

    mockFetch.mockRejectedValueOnce(new ApiError('backend down', 500));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // last-good list is untouched — never cleared to empty
    expect(result.current.incidents).toEqual([tier1Resolved, tier3PendingNewer]);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(500);
  });

  it('flips isStale once the last success is older than STALE_AFTER_MS', async () => {
    mockFetch.mockResolvedValueOnce([tier1Resolved]);
    const { result } = renderHook(() => useIncidents());
    await flush();
    expect(result.current.isStale).toBe(false);

    // every later poll fails, so lastUpdatedAt never refreshes
    mockFetch.mockRejectedValue(new ApiError('still down'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STALE_AFTER_MS + 1500);
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.incidents).toEqual([tier1Resolved]);
  });

  it('a slow poll cannot clobber a newer result that already committed', async () => {
    const slow = deferred<Incident[]>();
    mockFetch
      .mockReturnValueOnce(slow.promise) // mount poll — hangs
      .mockResolvedValueOnce([tier1Resolved]) // interval poll — resolves first
      .mockResolvedValue([tier1Resolved]);

    const { result } = renderHook(() => useIncidents());
    // mount poll still in flight; fire + resolve the next interval poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
    expect(result.current.incidents).toEqual([tier1Resolved]);

    // the slow mount poll now resolves LATE with stale data
    await act(async () => {
      slow.resolve([tier2Resolved, tier1Resolved]);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.incidents).toEqual([tier1Resolved]); // not clobbered
  });

  it('refetch() issues an immediate out-of-band poll and updates state', async () => {
    mockFetch.mockResolvedValueOnce([tier1Resolved]);
    const { result } = renderHook(() => useIncidents());
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValueOnce([tier1Resolved, tier3PendingNewer]);
    await act(async () => {
      result.current.refetch();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.current.incidents).toHaveLength(2);
  });

  it('clears its timers on unmount — no further polls, no post-unmount update', async () => {
    mockFetch.mockResolvedValue([tier1Resolved]);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useIncidents());
    await flush();
    const callsAtUnmount = mockFetch.mock.calls.length;

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
    });

    expect(mockFetch.mock.calls.length).toBe(callsAtUnmount);
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
