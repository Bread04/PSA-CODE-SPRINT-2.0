import { test, expect, request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { API_BASE, SEED } from './fixtures';

/**
 * Out-of-process API contract checks (bmad-qa-generate-e2e-tests, pass 2).
 *
 * Validates the RESPONSE STRUCTURE — not just status codes — of every endpoint
 * `frontend/src/api/client.ts` calls, against the field shape
 * `frontend/src/types/incident.ts` says the console consumes. Runs against the
 * real uvicorn instance `playwright.config.ts` boots (base URL from
 * `./fixtures.ts`); no browser. Sorts first alphabetically so it sees the
 * pristine seed. Ports and seed ids come from `./fixtures.ts`.
 *
 * Non-mutating: the one approval call targets `SEED.inProgressId` (Tier 2, not
 * blocked) — the endpoint returns the incident unchanged for a non-approvable
 * incident. The kill-switch toggle restores itself.
 */

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL: API_BASE });
});
test.afterAll(async () => {
  await api.dispose();
});

/** Assert one object matches the frontend `Incident` interface. */
function assertIncidentShape(inc: Record<string, unknown>) {
  expect(typeof inc.incident_id).toBe('string');
  expect(['open', 'resolved']).toContain(inc.status);
  expect(Array.isArray(inc.entity_refs)).toBe(true);
  expect([1, 2, 3, null]).toContain(inc.tier);
  expect(typeof inc.confidence).toBe('number');
  expect(
    inc.recommended_option_id === null ||
      typeof inc.recommended_option_id === 'string',
  ).toBe(true);
  expect(['n/a', 'pending', 'approved', 'rejected']).toContain(
    inc.approval_status,
  );
  expect(typeof inc.blocked_by_kill_switch).toBe('boolean');
  expect(typeof inc.created_at).toBe('string');
  expect(typeof inc.last_signal_at).toBe('string');

  expect(Array.isArray(inc.options)).toBe(true);
  for (const opt of inc.options as Record<string, unknown>[]) {
    expect(typeof opt.option_id).toBe('string');
    expect(typeof opt.description).toBe('string');
    expect(typeof opt.reversible).toBe('boolean');
    expect(typeof opt.dg_involved).toBe('boolean');
    const impact = opt.predicted_impact as Record<string, unknown>;
    expect(typeof impact.delay_min).toBe('number');
    expect(['low', 'medium', 'high']).toContain(impact.cost);
    expect(['low', 'medium', 'high']).toContain(impact.risk);
    expect(typeof impact.yard_impact).toBe('string');
  }

  expect(Array.isArray(inc.trace)).toBe(true);
  for (const entry of inc.trace as Record<string, unknown>[]) {
    expect(typeof entry.stage).toBe('string');
    expect(typeof entry.timestamp).toBe('string');
    expect(typeof entry.detail).toBe('object');
    expect(
      entry.error === null ||
        (typeof entry.error === 'object' && entry.error !== null),
    ).toBe(true);
  }
}

test('GET /incidents returns 200 and an array of well-formed Incident objects', async () => {
  const res = await api.get('/incidents');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeGreaterThanOrEqual(SEED.count);
  for (const inc of body) assertIncidentShape(inc);
});

test('GET /incidents/{id} returns the single matching Incident', async () => {
  const res = await api.get(`/incidents/${SEED.inProgressId}`);
  expect(res.status()).toBe(200);
  const inc = await res.json();
  expect(inc.incident_id).toBe(SEED.inProgressId);
  assertIncidentShape(inc);
});

test('GET /incidents/{unknown} returns 404 with a detail message', async () => {
  const res = await api.get('/incidents/no-such-incident');
  expect(res.status()).toBe(404);
  expect(typeof (await res.json()).detail).toBe('string');
});

test('GET /incidents/query returns { answer: string }', async () => {
  const hit = await api.get('/incidents/query?q=OOCL%20Tokyo');
  expect(hit.status()).toBe(200);
  const body = await hit.json();
  expect(typeof body.answer).toBe('string');
  expect(body.answer.length).toBeGreaterThan(0);

  // An unresolvable question is still a 200 with an honest "no match" answer,
  // never a fabricated status.
  const miss = await api.get('/incidents/query?q=');
  expect(miss.status()).toBe(200);
  expect(typeof (await miss.json()).answer).toBe('string');
});

test('POST /kill-switch echoes the boolean state, and rejects a non-boolean body', async () => {
  const on = await api.post('/kill-switch', { data: { enabled: true } });
  expect(on.status()).toBe(200);
  expect(await on.json()).toEqual({ enabled: true });

  const off = await api.post('/kill-switch', { data: { enabled: false } });
  expect(off.status()).toBe(200);
  expect(await off.json()).toEqual({ enabled: false });

  const bad = await api.post('/kill-switch', { data: { enabled: 'nope' } });
  expect(bad.status()).toBe(422);
});

test('POST /incidents/{id}/approval — contract and error codes', async () => {
  // Non-approvable incident (Tier 2, not blocked): 200 + the incident, no-op.
  const ok = await api.post(`/incidents/${SEED.inProgressId}/approval`, {
    data: { action: 'approve' },
  });
  expect(ok.status()).toBe(200);
  const inc = await ok.json();
  expect(inc.incident_id).toBe(SEED.inProgressId);
  assertIncidentShape(inc);

  // select_alternative with no option_id -> 400 (ApprovalError).
  const missingOpt = await api.post(
    `/incidents/${SEED.inProgressId}/approval`,
    { data: { action: 'select_alternative' } },
  );
  expect(missingOpt.status()).toBe(400);

  // Unknown incident -> 404.
  const unknown = await api.post('/incidents/nope/approval', {
    data: { action: 'approve' },
  });
  expect(unknown.status()).toBe(404);

  // Bad verb -> 422 (Literal validation).
  const badVerb = await api.post(`/incidents/${SEED.inProgressId}/approval`, {
    data: { action: 'sabotage' },
  });
  expect(badVerb.status()).toBe(422);
});

test('GET /healthz returns { ok: true }', async () => {
  const res = await api.get('/healthz');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
