import { test, expect, request as playwrightRequest } from '@playwright/test';
import { API_BASE, SEED, resolvedRow } from './fixtures';

/**
 * Live Console end-to-end smoke path (bmad-qa-generate-e2e-tests, 2026-08-29).
 *
 * Real browser -> real Vite build -> real `client.ts` -> real HTTP -> real
 * FastAPI (`api/app.py`) -> real orchestrator + mock services. `playwright.
 * config.ts` boots both servers and the backend seeds its deterministic
 * in-memory demo incidents on start.
 *
 * State-mutating checks (kill switch, approvals) run LAST and, where possible,
 * self-restore, because the whole file shares one backend process. Ports and
 * seed identifiers come from `./fixtures.ts` — nothing is re-typed here.
 */

test.describe.configure({ mode: 'serial' });

test('feed loads from GET /incidents and lists the seeded incidents', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Portwatch Console', level: 1 }),
  ).toBeVisible();

  const feed = page.getByRole('region', { name: 'Incidents' });
  await expect(feed).toBeVisible();

  // Rows are single-Tab-stop <button>s whose accessible name is
  // "<entity refs> — <recommended option> — <status>".
  await expect(feed.getByRole('button', { name: SEED.row.tier3Alts })).toBeVisible();
  await expect(feed.getByRole('button', { name: SEED.row.loadBalancing })).toBeVisible();
  await expect(feed.getByRole('button', { name: SEED.row.ksBlocked })).toBeVisible();
});

test('selecting an incident renders detail, execution trace and stage rail', async ({
  page,
}) => {
  await page.goto('/');

  await page
    .getByRole('region', { name: 'Incidents' })
    .getByRole('button', { name: SEED.row.tier3Alts })
    .click();

  // IncidentDetail heading is the same entity-ref label.
  await expect(
    page.getByRole('heading', { name: /Vessel MSC ANNA/i }),
  ).toBeVisible();

  // ExecutionTrace is a role="log" region fed by the same polled trace.
  const traceLog = page.getByRole('log');
  await expect(traceLog).toBeVisible();
  await expect(traceLog).toContainText(/CORRELATE/);

  // StageRail (Story 4.2) renders the fixed pipeline projection.
  await expect(page.getByRole('heading', { name: 'Pipeline' })).toBeVisible();

  // Illustrative strait map (Story 4.1) — read-only, not a decision surface.
  await expect(
    page.getByRole('img', { name: /Illustrative map of the Singapore Strait/i }),
  ).toBeVisible();
});

test('AskPortwatch returns a grounded answer from GET /incidents/query', async ({
  page,
}) => {
  await page.goto('/');

  await page
    .getByRole('textbox', { name: 'Ask about any incident' })
    .fill(SEED.query);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();

  // Deterministic offline template (config forces ANTHROPIC_API_KEY='') — the
  // answer is grounded in the resolved incident, never empty.
  const answer = page.locator('.ask-portwatch__answer');
  await expect(answer).toBeVisible();
  await expect(answer).not.toBeEmpty();
  await expect(answer).toContainText(/anna/i);
});

test('API error contract: 404 for an unknown incident, 422 for a bad kill-switch body', async () => {
  const api = await playwrightRequest.newContext({ baseURL: API_BASE });

  const notFound = await api.get('/incidents/does-not-exist');
  expect(notFound.status()).toBe(404);

  const badBody = await api.post('/kill-switch', { data: { enabled: 'nope' } });
  expect(badBody.status()).toBe(422);

  const ok = await api.get('/incidents');
  expect(ok.status()).toBe(200);
  expect(Array.isArray(await ok.json())).toBe(true);

  await api.dispose();
});

test('kill switch engages and disengages via POST /kill-switch', async ({
  page,
}) => {
  await page.goto('/');

  const toggle = page.getByRole('switch');
  await expect(toggle).toHaveAccessibleName(/Autonomous execution: ON/i);

  // Engaging is deliberate: first activation arms an inline "Confirm"; only
  // "Confirm" POSTs /kill-switch. Disengaging is a single activation.
  await toggle.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await expect(toggle).toHaveAccessibleName(/Autonomous execution: DISABLED/i);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  // Persistent condition banner (role="status", not alert).
  await expect(page.locator('.kill-switch-banner')).toBeVisible();

  // Restore — later tests approve incidents and must not be kill-switch-blocked.
  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Autonomous execution: ON/i);
  await expect(page.locator('.kill-switch-banner')).toHaveCount(0);
});

test('approval write path: approve and select-alternative both resolve their incident', async ({
  page,
}) => {
  await page.goto('/');
  const feed = page.getByRole('region', { name: 'Incidents' });

  await test.step('plain approve resolves the kill-switch-blocked incident', async () => {
    await feed.getByRole('button', { name: SEED.row.ksBlocked }).click();

    // Approve-only banner for a blocked_by_kill_switch incident.
    await page.getByRole('button', { name: 'Approve', exact: true }).click();

    // useApproval refetches on success — the row flips to a resolved phrase and
    // the Approve control detaches.
    await expect(
      feed.getByRole('button', { name: resolvedRow(SEED.row.ksBlocked) }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Approve', exact: true }),
    ).toHaveCount(0);
  });

  await test.step('select_alternative picks opt-1 and approves the held Tier-3 incident', async () => {
    await feed.getByRole('button', { name: SEED.row.tier3Alts }).click();

    // The ranked alternative (opt-1). Clicking it POSTs
    // { action: 'select_alternative', option_id: 'opt-1' }, which the backend
    // applies and then approves in one step.
    await page
      .getByRole('button', { name: SEED.row.tier3AltOption })
      .click();

    await expect(
      feed.getByRole('button', { name: resolvedRow(SEED.row.tier3AltOption) }),
    ).toBeVisible();
  });
});
