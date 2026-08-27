import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useApproval } from './useApproval';
import * as client from '../api/client';
import { ApiError } from '../api/client';

/**
 * Story 2.4 — useApproval submit hook.
 * (Retro item 3: the hook shipped with no test.)
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useApproval', () => {
  it('submit() POSTs the AD-11 body and calls onSuccess', async () => {
    const post = vi.spyOn(client, 'postApproval').mockResolvedValue({ ok: true });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApproval(onSuccess));

    act(() => result.current.submit('inc-1', { action: 'approve' }));
    expect(result.current.submitting).toBe(true);

    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(post).toHaveBeenCalledWith(
      'inc-1',
      { action: 'approve' },
      expect.anything(),
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('a second submit while one is in flight is ignored', async () => {
    const post = vi
      .spyOn(client, 'postApproval')
      .mockImplementation(
        () => new Promise((r) => setTimeout(() => r({ ok: true }), 20)),
      );
    const { result } = renderHook(() => useApproval());

    act(() => {
      result.current.submit('inc-1', { action: 'approve' });
      result.current.submit('inc-1', { action: 'reject' });
    });
    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('a failed POST sets error (an ApiError) and never throws into render', async () => {
    vi.spyOn(client, 'postApproval').mockRejectedValue(new ApiError('nope', 500));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useApproval(onSuccess));

    act(() => result.current.submit('inc-1', { action: 'approve' }));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.error?.status).toBe(500);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reset() clears the error', async () => {
    vi.spyOn(client, 'postApproval').mockRejectedValue(new ApiError('nope'));
    const { result } = renderHook(() => useApproval());

    act(() => result.current.submit('inc-1', { action: 'approve' }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.reset());
    expect(result.current.error).toBeNull();
  });

  it('does not set state after unmount', async () => {
    vi.spyOn(client, 'postApproval').mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ ok: true }), 10)),
    );
    const { result, unmount } = renderHook(() => useApproval());
    act(() => result.current.submit('inc-1', { action: 'approve' }));
    unmount();
    await new Promise((r) => setTimeout(r, 30));
    // no act() warning / no throw = pass
  });
});
