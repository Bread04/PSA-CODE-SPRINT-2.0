import { test, expect } from '@playwright/test';
import { SEED } from './fixtures';

/**
 * Incident Archive route (bmad-qa-generate-e2e-tests, pass 2).
 *
 * `#/archive` is a session-scoped, client-side filter of the live incident list
 * to resolved incidents, rendered with the reused IncidentRow + a READ-ONLY
 * ExecutionTrace (no Approve / Reject / Modify). Read-only, no fixture
 * mutation; sorts before console-smoke so it sees the originally-seeded
 * resolved incidents (demo-auto-resolved, demo-approved, demo-rejected).
 */

test.describe.configure({ mode: 'serial' });

test('navigating to #/archive shows resolved incidents and marks the nav link current', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Archive' }).click();
  await expect(page).toHaveURL(/#\/archive$/);
  await expect(page.getByRole('link', { name: 'Archive' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  const archive = page.getByRole('region', { name: 'Incident Archive' });
  await expect(archive).toBeVisible();

  // The three seeded resolved incidents (rows are reused IncidentRow buttons).
  await expect(
    archive.getByRole('button', { name: SEED.row.autoResolved }),
  ).toBeVisible();
  await expect(
    archive.getByRole('button', { name: SEED.row.approved }),
  ).toBeVisible();
  await expect(
    archive.getByRole('button', { name: SEED.row.rejected }),
  ).toBeVisible();
});

test('selecting an archived incident shows its trace read-only, with no approval controls', async ({
  page,
}) => {
  await page.goto('/#/archive');

  await page
    .getByRole('region', { name: 'Incident Archive' })
    .getByRole('button', { name: SEED.row.approved })
    .click();

  const detail = page.getByRole('region', { name: 'Archived incident detail' });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('heading', { level: 2 })).toContainText(
    /Crane C4|EVER GIVEN/i,
  );
  await expect(detail.getByRole('log')).toContainText(/VERIFY|EXECUTE/);

  // The archive never mounts an approval control.
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
});

test('the Live Console link returns to the feed', async ({ page }) => {
  await page.goto('/#/archive');

  await page.getByRole('link', { name: 'Live Console' }).click();
  await expect(page).toHaveURL(/#\/$|\/$/);
  await expect(page.getByRole('region', { name: 'Incidents' })).toBeVisible();
});
