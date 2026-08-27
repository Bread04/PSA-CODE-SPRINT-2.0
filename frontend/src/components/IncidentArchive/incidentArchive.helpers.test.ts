import { describe, expect, it } from 'vitest';

import { resolutionOutcome } from '../../lib/incident';
import {
  openApproved,
  resolvedApproved,
  resolvedRejected,
  tier1Resolved,
  tier3PendingNewer,
} from '../../test/fixtures/incidents';
import type { Incident } from '../../types/incident';

/**
 * Story 2.9 — `resolutionOutcome` unit table (the four Outcome matrix rows).
 */
describe('resolutionOutcome', () => {
  it('resolved + approval_status "n/a" → "Auto-resolved"', () => {
    expect(resolutionOutcome(tier1Resolved)).toBe('Auto-resolved');
  });

  it('resolved + approval_status "approved" → "Approved"', () => {
    expect(resolutionOutcome(resolvedApproved)).toBe('Approved');
  });

  it('resolved + approval_status "rejected" → "Rejected"', () => {
    expect(resolutionOutcome(resolvedRejected)).toBe('Rejected');
  });

  it('status "open" → null regardless of approval_status', () => {
    expect(resolutionOutcome(tier3PendingNewer)).toBeNull();
    expect(resolutionOutcome(openApproved)).toBeNull();
    const openRejected: Incident = {
      ...openApproved,
      approval_status: 'rejected',
    };
    expect(resolutionOutcome(openRejected)).toBeNull();
  });

  it('resolved + approval_status "pending" (unexpected) → null, not a wrong tag', () => {
    const resolvedPending: Incident = {
      ...resolvedApproved,
      approval_status: 'pending',
    };
    expect(resolutionOutcome(resolvedPending)).toBeNull();
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(resolvedApproved);
    resolutionOutcome(resolvedApproved);
    expect(JSON.stringify(resolvedApproved)).toBe(snapshot);
  });
});
