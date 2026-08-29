import { test, expect } from '@playwright/test';
import { API_BASE, SEED } from './fixtures';

/**
 * Feed resilience when the API stops answering (bmad-qa-generate-e2e-tests,
 * pass 2).
 *
 * `client.ts` surfaces every failure as a typed `ApiError`; `useIncidents`
 * keeps the last-good list and, after `STALE_AFTER_MS` (8s), shows a
 * non-blocking "Last updated … ago" line (UX-DR10) — it never hides the rows
 * behind an error screen. Simulated by aborting the poll route in the browser,
 * so the real server is untouched and the spec is order-independent.
 */

const INCIDENTS_URL = `${API_BASE}/incidents`;

test.describe.configure({ mode: 'serial' });

test('a dead poll keeps the last-good rows and surfaces the stale indicator', async ({
  page,
}) => {
  await page.goto('/');

  const feed = page.getByRole('region', { name: 'Incidents' });
  // demo-load-balancing is never mutated by any spec — a stable anchor row.
  const anchorRow = feed.getByRole('button', { name: SEED.row.loadBalancing });
  await expect(anchorRow).toBeVisible();

  // Kill every subsequent GET /incidents poll (exact URL: does not touch
  // /incidents/{id} or /incidents/query).
  await page.route(INCIDENTS_URL, (route) => route.abort());

  // Stale line appears after STALE_AFTER_MS (8s) with no successful poll.
  const stale = page.locator('.incident-feed__stale');
  await expect(stale).toBeVisible({ timeout: 20_000 });
  await expect(stale).toHaveText(/Last updated .* ago/);

  // Last-good rows are still there — not replaced by an error screen.
  await expect(anchorRow).toBeVisible();
  await expect(feed.getByRole('button').first()).toBeVisible();

  // Recover: let polls through again; the stale line clears on the next success.
  await page.unroute(INCIDENTS_URL);
  await expect(stale).toHaveCount(0, { timeout: 20_000 });
  await expect(anchorRow).toBeVisible();
});
