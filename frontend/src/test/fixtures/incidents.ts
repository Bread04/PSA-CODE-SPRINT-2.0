/**
 * Typed incident fixtures for the Story 2.3 IncidentFeed / useIncidents /
 * helper tests, and for the App demo shell. Every object conforms to the real
 * backend `Incident` shape (snake_case field names, verbatim).
 *
 * Timestamps are chosen so the sort matrix is exercised:
 *   - `tier1Resolved` has the MOST RECENT `last_signal_at` of all, yet the two
 *     Tier-3 pending rows must still sort above it.
 *   - `tier3PendingNewer` has a later `last_signal_at` than `tier3PendingOlder`.
 */

import type { Incident, RecoveryOption } from '../../types/incident';

function option(overrides: Partial<RecoveryOption> = {}): RecoveryOption {
  return {
    option_id: 'opt-1',
    description: 'Reassign MSC Anna to Berth C7, slot 5',
    predicted_impact: {
      delay_min: 35,
      cost: 'low',
      yard_impact: 'yard utilization +4%',
      risk: 'low',
    },
    reversible: true,
    dg_involved: false,
    ...overrides,
  };
}

/** Tier 1, auto-resolved — quiet tag, no badge, no progress bar. */
export const tier1Resolved: Incident = {
  incident_id: 'inc-tier1-resolved',
  status: 'resolved',
  entity_refs: ['gate:G2'],
  tier: 1,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:50:00Z',
  last_signal_at: '2026-08-27T09:00:00Z',
};

/** Tier 2, auto-resolved — quiet tag PLUS a small non-sound notification badge. */
export const tier2Resolved: Incident = {
  incident_id: 'inc-tier2-resolved',
  status: 'resolved',
  entity_refs: ['gate:G5', 'yard:BLOCK-7'],
  tier: 2,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:35:00Z',
  last_signal_at: '2026-08-27T08:45:00Z',
};

/** Tier 3 awaiting approval — pinned to the top; the newer of the pair. */
export const tier3PendingNewer: Incident = {
  incident_id: 'inc-tier3-pending-newer',
  status: 'open',
  entity_refs: ['vessel:MSC-ANNA', 'crane:CRANE-4'],
  tier: 3,
  confidence: 100,
  recommended_option_id: 'opt-1',
  options: [option()],
  approval_status: 'pending',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:05:00Z',
  last_signal_at: '2026-08-27T08:20:00Z',
};

/** Tier 3 awaiting approval — pinned to the top; the older of the pair. */
export const tier3PendingOlder: Incident = {
  incident_id: 'inc-tier3-pending-older',
  status: 'open',
  entity_refs: ['vessel:EVER-GIVEN'],
  tier: 3,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'pending',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:00:00Z',
  last_signal_at: '2026-08-27T08:10:00Z',
};

/** Open, not pending (`approval_status: "n/a"`) — shows the 2px progress bar. */
export const openInProgress: Incident = {
  incident_id: 'inc-open-in-progress',
  status: 'open',
  entity_refs: ['vessel:CMA-CGM-TITAN'],
  tier: 2,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:30:00Z',
  last_signal_at: '2026-08-27T08:40:00Z',
};

/** Degraded confidence via a last-known-state fallback in the trace. */
export const degradedConfidenceFallback: Incident = {
  incident_id: 'inc-degraded-fallback',
  status: 'open',
  entity_refs: ['crane:CRANE-7'],
  tier: 2,
  confidence: 67,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [
    {
      stage: 'AGENT_CALL',
      timestamp: '2026-08-27T08:29:00Z',
      detail: {},
      error: {
        stage: 'AGENT_CALL',
        error: 'Crane #7 telemetry timeout',
        retried: true,
        fallback_used: true,
      },
    },
  ],
  created_at: '2026-08-27T08:25:00Z',
  last_signal_at: '2026-08-27T08:30:00Z',
};

/** Degraded confidence with NO trace hint — falls back to the generic reason. */
export const degradedConfidenceNoHint: Incident = {
  incident_id: 'inc-degraded-nohint',
  status: 'open',
  entity_refs: ['berth:C7'],
  tier: 2,
  confidence: 88,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:22:00Z',
  last_signal_at: '2026-08-27T08:26:00Z',
};

/** A demo-safety mock override recorded in the trace (`detail.mock_forced`). */
export const mockForced: Incident = {
  incident_id: 'inc-mock-forced',
  status: 'open',
  entity_refs: ['vessel:OOCL-HONG-KONG'],
  tier: 2,
  confidence: 80,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [
    {
      stage: 'AGENT_CALL',
      timestamp: '2026-08-27T08:24:00Z',
      detail: { mock_forced: true },
      error: null,
    },
  ],
  created_at: '2026-08-27T08:20:00Z',
  last_signal_at: '2026-08-27T08:25:00Z',
};

/** Kill-switch-blocked Tier 1 — manual-action tag; tier stays 1, not 3. */
export const killSwitchBlocked: Incident = {
  incident_id: 'inc-kill-switch-blocked',
  status: 'open',
  entity_refs: ['gate:G9'],
  tier: 1,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: true,
  trace: [],
  created_at: '2026-08-27T08:30:00Z',
  last_signal_at: '2026-08-27T08:35:00Z',
};

/** Not yet classified — `tier` is still `null` (pre-policy). */
export const unclassified: Incident = {
  incident_id: 'inc-unclassified',
  status: 'open',
  entity_refs: ['vessel:MAERSK-SELETAR'],
  tier: null,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'n/a',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:18:00Z',
  last_signal_at: '2026-08-27T08:19:00Z',
};

/** Tier-3 whose recommendation was approved and is now executing (still open). */
export const openApproved: Incident = {
  incident_id: 'inc-open-approved',
  status: 'open',
  entity_refs: ['vessel:HMM-ALGECIRAS'],
  tier: 3,
  confidence: 100,
  recommended_option_id: null,
  options: [],
  approval_status: 'approved',
  blocked_by_kill_switch: false,
  trace: [],
  created_at: '2026-08-27T08:15:00Z',
  last_signal_at: '2026-08-27T08:17:00Z',
};

/** Full set, in no particular order (the feed sorts it). */
export const allIncidents: Incident[] = [
  tier1Resolved,
  tier2Resolved,
  tier3PendingNewer,
  tier3PendingOlder,
  openInProgress,
  degradedConfidenceFallback,
  degradedConfidenceNoHint,
  mockForced,
  killSwitchBlocked,
  unclassified,
  openApproved,
];
