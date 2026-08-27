import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  API_BASE,
  ApiError,
  fetchIncidents,
  fetchQuery,
  postKillSwitch,
} from './client';

/**
 * Story 2.3 — Incident API client.
 * `fetch` is stubbed via `vi.stubGlobal`; no real network.
 */

function stubFetch(impl: () => Promise<unknown>) {
  const spy = vi.fn(impl as () => Promise<Response>);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchIncidents', () => {
  it('happy path: resolves with the parsed incident array', async () => {
    const payload = [
      { incident_id: 'a', status: 'open' },
      { incident_id: 'b', status: 'resolved' },
    ];
    const spy = stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response),
    );

    await expect(fetchIncidents()).resolves.toEqual(payload);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GETs `${API_BASE}/incidents` with an AbortSignal', async () => {
    const spy = stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      } as Response),
    );
    const controller = new AbortController();
    await fetchIncidents(controller.signal);

    expect(spy).toHaveBeenCalledWith(
      `${API_BASE}/incidents`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('non-array 200 body → ApiError', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ incidents: [] }),
      } as Response),
    );

    const err = await fetchIncidents().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBeUndefined();
    expect((err as ApiError).message).toMatch(/array/i);
  });

  it('unparseable 200 body → ApiError', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
      } as Response),
    );

    const err = await fetchIncidents().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/invalid json/i);
  });

  it('non-2xx → ApiError carrying the status code', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      } as Response),
    );

    const err = await fetchIncidents().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
  });

  it('network reject → ApiError with no status', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const err = await fetchIncidents().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBeUndefined();
  });

  it('re-throws an AbortError as-is (not wrapped in ApiError)', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );

    const err = await fetchIncidents().catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as DOMException).name).toBe('AbortError');
  });

  it('API_BASE defaults to same-origin (empty string)', () => {
    // No VITE_API_BASE_URL is set in the test env.
    expect(API_BASE).toBe('');
  });
});

describe('fetchQuery', () => {
  function okAnswer(answer: unknown) {
    return () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ answer }),
      } as Response);
  }

  /** Stub fetch and capture the URL string of the first call. */
  function stubAndCapture(answer: unknown): { url: () => string } {
    let captured = '';
    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) => {
        if (captured === '') captured = String(input);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ answer }),
        } as Response);
      }),
    );
    return { url: () => captured };
  }

  it('happy path: resolves with { answer } from the parsed body', async () => {
    const spy = stubFetch(okAnswer('MSC Anna: berth B3.'));
    await expect(fetchQuery('where is MSC Anna')).resolves.toEqual({
      answer: 'MSC Anna: berth B3.',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('GETs `${API_BASE}/incidents/query?q=…` with no incident_id when the hint is omitted', async () => {
    const cap = stubAndCapture('ok');
    await fetchQuery('where is MSC Anna');

    expect(cap.url()).toBe(`${API_BASE}/incidents/query?q=where+is+MSC+Anna`);
    expect(cap.url()).not.toContain('incident_id');
  });

  it('passes a combined AbortSignal to fetch', async () => {
    const spy = stubFetch(okAnswer('ok'));
    await fetchQuery('q');
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('appends &incident_id when a non-empty hint is given', async () => {
    const cap = stubAndCapture('ok');
    await fetchQuery('status?', 'inc-42');

    expect(cap.url()).toContain('q=status');
    expect(cap.url()).toContain('incident_id=inc-42');
  });

  it('omits incident_id when the hint is blank / whitespace-only', async () => {
    const cap = stubAndCapture('ok');
    await fetchQuery('q', '   ');

    expect(cap.url()).not.toContain('incident_id');
  });

  it('percent/`+`-encodes a question containing &, = and spaces (URLSearchParams round-trip)', async () => {
    const cap = stubAndCapture('ok');
    const raw = 'berth A & B = where?';
    await fetchQuery(raw);

    const url = cap.url();
    // The raw `&` / `=` must NOT leak into the query string unescaped.
    expect(url).not.toContain('& B =');
    expect(url).toContain('q=berth+A+%26+B+%3D+where%3F');

    // And it round-trips back to the original via URLSearchParams.
    const qs = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    expect(qs.get('q')).toBe(raw);
  });

  it('timeout branch → ApiError whose message mentions "timed out"', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('timeout', 'TimeoutError')),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/timed out/i);
  });

  it('200 body with an empty / whitespace `answer` → ApiError', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ answer: '   ' }),
      } as Response),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/empty answer/i);
  });

  it('throws ApiError synchronously for an empty / whitespace question, with no fetch', async () => {
    const spy = stubFetch(okAnswer('ok'));

    expect(() => fetchQuery('   ')).toThrow(ApiError);
    try {
      fetchQuery('   ');
    } catch (e) {
      expect((e as ApiError).message).toMatch(/question/i);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('non-2xx → ApiError carrying the status code', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it('200 body with no string `answer` → ApiError mentioning answer', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/answer/i);
  });

  it('non-object 200 body → ApiError', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve('just a string'),
      } as Response),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('unparseable 200 body → ApiError', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('bad json')),
      } as Response),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/invalid json/i);
  });

  it('network reject → ApiError with no status', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBeUndefined();
  });

  it('re-throws an AbortError as-is (not wrapped in ApiError)', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );

    const err = await fetchQuery('q').catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as DOMException).name).toBe('AbortError');
  });
});

describe('postKillSwitch', () => {
  function okBody(body?: string) {
    return () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(body ?? ''),
      } as Response);
  }

  it('POST shape: hits `${API_BASE}/kill-switch` with body {"enabled":true} and no other keys', async () => {
    const spy = stubFetch(okBody());
    await expect(postKillSwitch(true)).resolves.toEqual({ enabled: true });

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API_BASE}/kill-switch`);
    expect(init.method).toBe('POST');
    expect(
      new Headers(init.headers).get('Content-Type'),
    ).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ enabled: true });
    expect(Object.keys(JSON.parse(init.body as string))).toEqual(['enabled']);
  });

  it('non-boolean `enabled` throws ApiError synchronously, with no fetch', async () => {
    const spy = stubFetch(okBody());
    await expect(postKillSwitch('yes' as unknown as boolean)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('empty 2xx body resolves { enabled } echoing the request', async () => {
    stubFetch(okBody(''));
    await expect(postKillSwitch(false)).resolves.toEqual({ enabled: false });
  });

  it('a well-formed 2xx body is the source of truth for the resolved value', async () => {
    stubFetch(okBody('{"enabled":true}'));
    await expect(postKillSwitch(true)).resolves.toEqual({ enabled: true });
  });

  it('timeout branch → ApiError whose message mentions "timed out"', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('timeout', 'TimeoutError')),
    );

    const err = await postKillSwitch(true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toMatch(/timed out/i);
  });

  it('a real caller AbortSignal aborted mid-flight re-throws the AbortError as-is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      ),
    );

    const controller = new AbortController();
    const pending = postKillSwitch(true, controller.signal);
    controller.abort();

    const err = await pending.catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as DOMException).name).toBe('AbortError');
  });

  it('non-2xx → ApiError carrying the status code', async () => {
    stubFetch(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      } as Response),
    );

    const err = await postKillSwitch(true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(500);
  });

  it('a 2xx body without a boolean `enabled` → ApiError', async () => {
    stubFetch(okBody('{"ok":1}'));

    const err = await postKillSwitch(true).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('re-throws a caller AbortError as-is (not wrapped in ApiError)', async () => {
    stubFetch(() =>
      Promise.reject(new DOMException('The operation was aborted.', 'AbortError')),
    );

    const err = await postKillSwitch(true).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect((err as DOMException).name).toBe('AbortError');
  });
});
