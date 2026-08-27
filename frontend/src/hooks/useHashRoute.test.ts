import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { parseHashRoute, useHashRoute } from './useHashRoute';

/**
 * Story 2.9 — useHashRoute hook + parseHashRoute helper.
 *
 * Covers the Route matrix rows: default (empty hash) → 'live', '#/archive' →
 * 'archive', a live hashchange re-render, and listener cleanup on unmount.
 */

function setHash(hash: string) {
  window.location.hash = hash;
}

afterEach(() => {
  setHash('');
  vi.restoreAllMocks();
});

describe('parseHashRoute', () => {
  it.each([
    ['', 'live'],
    ['#/', 'live'],
    ['#/live', 'live'],
    ['#/incidents', 'live'],
    ['#/archive', 'archive'],
    ['#archive', 'archive'],
    ['#/archive/', 'archive'],
    ['#/ARCHIVE', 'archive'],
    ['#Archive', 'archive'],
    ['#//archive', 'archive'],
    ['#/archive//', 'archive'],
    ['#/archive?x=1', 'archive'],
    ['#/archive/detail', 'archive'],
  ] as const)('parses %j → %s', (hash, expected) => {
    expect(parseHashRoute(hash)).toBe(expected);
  });
});

describe('useHashRoute', () => {
  it('defaults to "live" when the hash is empty', () => {
    setHash('');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe('live');
  });

  it('reads "archive" from an initial #/archive hash', () => {
    setHash('#/archive');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe('archive');
  });

  it('re-renders with the new route when the hash changes while mounted', () => {
    setHash('');
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe('live');

    act(() => {
      window.location.hash = '#/archive';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current).toBe('archive');
  });

  it('removes its hashchange listener on unmount (same handler reference)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useHashRoute());

    const added = addSpy.mock.calls.find((c) => c[0] === 'hashchange');
    expect(added).toBeDefined();
    const handler = added![1];

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('hashchange', handler);
  });
});
