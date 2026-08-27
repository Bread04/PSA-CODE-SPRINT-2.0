/**
 * Portwatch Console — IncidentFeed pure helpers (Story 2.3).
 *
 * Every function here is a pure function of its arguments: given the same
 * incident list it returns the same result, and it never mutates its input.
 * Selecting or interacting with one row therefore cannot reorder or change
 * another (FR16).
 *
 * The incident-level helpers that Story 2.4 also needs — `formatEntityRef`,
 * `formatIncidentLabel`, `confidenceReason`, `statusPhrase` (plus `isPinned` /
 * `KILL_SWITCH_TAG`) — now live in `src/lib/incident.ts`. They are re-exported
 * here unchanged so this module's existing consumers and tests keep working.
 */

import type { Incident } from '../../types/incident';
import {
  KILL_SWITCH_TAG,
  isPinned,
  formatEntityRef,
  formatIncidentLabel,
  statusPhrase,
  confidenceReason,
} from '../../lib/incident';

export {
  KILL_SWITCH_TAG,
  isPinned,
  formatEntityRef,
  formatIncidentLabel,
  statusPhrase,
  confidenceReason,
};

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

const parseTs = (iso: string): number => {
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Reverse-chronological order with Tier-3-pending rows pinned above everything
 * else. Within either group: most-recent `last_signal_at` first, `created_at`
 * as the tiebreak. Returns a NEW array — the input is never mutated.
 */
export function sortIncidents(list: readonly Incident[]): Incident[] {
  return [...list].sort((a, b) => {
    const ap = isPinned(a);
    const bp = isPinned(b);
    if (ap !== bp) return ap ? -1 : 1;

    const bySignal = parseTs(b.last_signal_at) - parseTs(a.last_signal_at);
    if (bySignal !== 0) return bySignal;
    return parseTs(b.created_at) - parseTs(a.created_at);
  });
}

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

/** Whole seconds between an epoch-millis timestamp `ts` and `now` (clamped ≥ 0). */
export function secondsAgo(ts: number, now: number): number {
  return Math.max(0, Math.floor((now - ts) / 1000));
}

/** Compact age readout: `"<n>s"` under a minute, `"<n>m"` under an hour, else `"<n>h"`. */
export function formatAge(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

// ---------------------------------------------------------------------------
// Row presentation (dot state + accompanying text — never colour alone)
// ---------------------------------------------------------------------------

export type RowDotState = 'pending' | 'blocked' | 'resolved' | 'open';

export interface RowPresentation {
  dotState: RowDotState;
  /** Text label that ALWAYS accompanies the status dot (UX-DR11). */
  statusText: string;
  /** Tier-2 auto-resolved rows carry a small non-sound notification badge. */
  showNotificationBadge: boolean;
  /** Kill-switch-blocked rows carry a manual-action tag. */
  showKillSwitchTag: boolean;
  /** Open, non-pending, non-blocked rows show a resolution progress bar. */
  showProgressBar: boolean;
}

/**
 * Maps an incident to how its row presents. `tier` is reported as-is: a
 * kill-switch-blocked Tier 1 stays Tier 1, it is not reclassified to 3.
 */
export function rowPresentation(incident: Incident): RowPresentation {
  const pending = isPinned(incident);
  const blocked = incident.blocked_by_kill_switch;
  const resolved = incident.status === 'resolved';

  let dotState: RowDotState;
  if (pending) dotState = 'pending';
  else if (blocked) dotState = 'blocked';
  else if (resolved) dotState = 'resolved';
  else dotState = 'open';

  return {
    dotState,
    statusText: statusPhrase(incident),
    showNotificationBadge:
      resolved && !pending && !blocked && incident.tier === 2,
    showKillSwitchTag: blocked && !pending,
    showProgressBar:
      incident.status === 'open' &&
      incident.approval_status !== 'pending' &&
      !blocked,
  };
}
