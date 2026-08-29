import { test, expect } from '@playwright/test';
import { SEED, resolvedRow } from './fixtures';

/**
 * Kill-switch safety property, end to end (bmad-qa-generate-e2e-tests, pass 2).
 *
 * Story 1.10 / epic-1-retro-item-2: while the global kill switch is engaged, an
 * operator Approve must NOT execute the action — the incident stays blocked and
 * the EXECUTE trace records the kill-switch reason. This is the "the LLM
 * proposes, deterministic code disposes" guarantee, asserted through the real
 * browser -> HTTP -> orchestrator path.
 *
 * Sorts before console-smoke.spec.ts so `demo-ks-blocked` is still un-executed
 * when this runs; it restores the kill switch to OFF and leaves the incident
 * for console-smoke to resolve normally.
 */

test.describe.configure({ mode: 'serial' });

test('an Approve while the kill switch is engaged does not execute the action', async ({
  page,
}) => {
  await page.goto('/');

  const toggle = page.getByRole('switch');
  await toggle.click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(toggle).toHaveAccessibleName(/Autonomous execution: DISABLED/i);

  const feed = page.getByRole('region', { name: 'Incidents' });
  await feed.getByRole('button', { name: SEED.row.ksBlocked }).click();

  // Approve-only banner (blocked_by_kill_switch incident).
  await page.getByRole('button', { name: 'Approve', exact: true }).click();

  // The refetched trace records the block; the incident does NOT resolve.
  await expect(page.getByRole('log')).toContainText(/kill switch/i);
  await expect(
    feed.getByRole('button', { name: resolvedRow(SEED.row.ksBlocked) }),
  ).toHaveCount(0);
  // Approve control is still there — the incident is still actionable.
  await expect(
    page.getByRole('button', { name: 'Approve', exact: true }),
  ).toBeVisible();

  // Restore: disengage so later specs can execute approvals.
  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Autonomous execution: ON/i);
  await expect(page.locator('.kill-switch-banner')).toHaveCount(0);
});
