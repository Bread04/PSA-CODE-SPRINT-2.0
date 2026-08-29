import { describe, it, expect } from 'vitest';

import { formatAge, rowPresentation, secondsAgo, sortIncidents } from './incidentFeed.helpers';
// Story 2.4 moved these four shared helpers to src/lib/incident.ts; the feed
// helpers module still re-exports them, but the tests now target the new home.
import {
  confidenceReason,
  formatEntityRef,
  formatIncidentLabel,
  statusPhrase,
} from '../../lib/incident';
import type { Incident, TraceEntry } from '../../types/incident';
import {
  openApproved,
  tier1Resolved,
  tier3PendingNewer,
  tier3PendingOlder,
  unclassified,
} from '../../test/fixtures/incidents';

/**
 * Story 2.3 — pure IncidentFeed helpers, tested directly (no rendering).
 */

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    incident_id: 'inc-x',
    status: 'open',
    entity_refs: [],
    tier: 2,
    confidence: 100,
    recommended_option_id: null,
    options: [],
    approval_status: 'n/a',
    blocked_by_kill_switch: false,
    agents: [],
    trace: [],
    created_at: '2026-08-27T08:00:00Z',
    last_signal_at: '2026-08-27T08:00:00Z',
    ...overrides,
  };
}

function trace(entry: Partial<TraceEntry>): TraceEntry {
  return {
    stage: 'AGENT_CALL',
    timestamp: '2026-08-27T08:00:00Z',
    detail: {},
    error: null,
    ...entry,
  };
}

// ---------------------------------------------------------------------------
// sortIncidents
// ---------------------------------------------------------------------------
describe('sortIncidents', () => {
  it('pins Tier-3 pending rows above more-recent non-pending rows', () => {
    const sorted = sortIncidents([tier1Resolved, tier3PendingOlder]);
    expect(sorted.map((i) => i.incident_id)).toEqual([
      tier3PendingOlder.incident_id,
      tier1Resolved.incident_id,
    ]);
  });

  it('orders the pinned group by newest last_signal_at first', () => {
    const sorted = sortIncidents([tier3PendingOlder, tier3PendingNewer]);
    expect(sorted.map((i) => i.incident_id)).toEqual([
      tier3PendingNewer.incident_id,
      tier3PendingOlder.incident_id,
    ]);
  });

  it('falls back to created_at when last_signal_at is equal', () => {
    const older = incident({
      incident_id: 'older',
      last_signal_at: '2026-08-27T09:00:00Z',
      created_at: '2026-08-27T07:00:00Z',
    });
    const newer = incident({
      incident_id: 'newer',
      last_signal_at: '2026-08-27T09:00:00Z',
      created_at: '2026-08-27T08:30:00Z',
    });
    const sorted = sortIncidents([older, newer]);
    expect(sorted.map((i) => i.incident_id)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const input = [tier1Resolved, tier3PendingNewer];
    const snapshot = [...input];
    sortIncidents(input);
    expect(input).toEqual(snapshot);
    expect(input[0]).toBe(tier1Resolved);
  });
});

// ---------------------------------------------------------------------------
// formatEntityRef + formatIncidentLabel
// ---------------------------------------------------------------------------
describe('formatEntityRef', () => {
  it('humanises `type:ID` into "Type ID" with separators spaced', () => {
    expect(formatEntityRef('vessel:MSC-ANNA')).toBe('Vessel MSC ANNA');
    expect(formatEntityRef('crane:CRANE_7')).toBe('Crane CRANE 7');
  });

  it('treats a ref with no colon as a bare title-cased type', () => {
    expect(formatEntityRef('gate')).toBe('Gate');
  });
});

describe('formatIncidentLabel', () => {
  it('joins multiple refs with " · " and appends the recommended option description', () => {
    expect(formatIncidentLabel(tier3PendingNewer)).toBe(
      'Vessel MSC ANNA · Crane CRANE 4 — Reassign MSC Anna to Berth C7, slot 5',
    );
  });

  it('appends the plain status phrase when no recommendation resolves', () => {
    expect(formatIncidentLabel(tier3PendingOlder)).toBe(
      'Vessel EVER GIVEN — Needs approval',
    );
  });

  it('uses just the status phrase when there are no entity refs', () => {
    expect(formatIncidentLabel(incident({ entity_refs: [] }))).toBe('In progress');
  });
});

// ---------------------------------------------------------------------------
// statusPhrase (one shared vocabulary — P8, P29)
// ---------------------------------------------------------------------------
describe('statusPhrase', () => {
  it('covers each state with a single consistent phrase', () => {
    expect(statusPhrase(tier3PendingNewer)).toBe('Needs approval');
    expect(statusPhrase(tier1Resolved)).toBe('Auto-resolved');
    expect(statusPhrase(incident())).toBe('In progress');
    expect(
      statusPhrase(incident({ blocked_by_kill_switch: true, tier: 1 })),
    ).toBe('Needs manual action — kill switch engaged');
    expect(statusPhrase(openApproved)).toBe('Approved — executing');
    expect(
      statusPhrase(incident({ status: 'open', approval_status: 'rejected' })),
    ).toBe('Rejected');
  });

  it('is the tail vocabulary used by formatIncidentLabel', () => {
    const i = incident({ entity_refs: ['gate:G2'], status: 'resolved' });
    expect(formatIncidentLabel(i)).toBe(`Gate G2 — ${statusPhrase(i)}`);
  });
});

// ---------------------------------------------------------------------------
// confidenceReason — all five branches + documented precedence
// ---------------------------------------------------------------------------
describe('confidenceReason', () => {
  it('1. mock_forced trace entry → mocked-for-demo string', () => {
    expect(
      confidenceReason(
        incident({
          confidence: 80,
          trace: [trace({ detail: { mock_forced: true } })],
        }),
      ),
    ).toBe('response mocked for demo stability');
  });

  it('2. error.fallback_used → last-known-state string', () => {
    expect(
      confidenceReason(
        incident({
          confidence: 67,
          trace: [
            trace({
              error: {
                stage: 'AGENT_CALL',
                error: 'timeout',
                retried: true,
                fallback_used: true,
              },
            }),
          ],
        }),
      ),
    ).toBe('using last known state');
  });

  it('3. explicit CONFIDENCE-stage detail.reason → that exact string', () => {
    expect(
      confidenceReason(
        incident({
          confidence: 70,
          trace: [
            trace({
              stage: 'CONFIDENCE',
              detail: { reason: 'Impact spread too wide to auto-execute' },
            }),
          ],
        }),
      ),
    ).toBe('Impact spread too wide to auto-execute');
  });

  it('4. confidence < 100 with no trace hint → generic reduced-from-100 string', () => {
    expect(confidenceReason(incident({ confidence: 88, trace: [] }))).toBe(
      'Confidence reduced from 100',
    );
  });

  it('5. confidence 100 with no hint → null', () => {
    expect(confidenceReason(incident({ confidence: 100, trace: [] }))).toBeNull();
  });

  it('precedence: mock_forced wins over a co-present fallback_used', () => {
    expect(
      confidenceReason(
        incident({
          confidence: 50,
          trace: [
            trace({
              detail: { mock_forced: true },
              error: {
                stage: 'AGENT_CALL',
                error: 'timeout',
                retried: true,
                fallback_used: true,
              },
            }),
          ],
        }),
      ),
    ).toBe('response mocked for demo stability');
  });
});

// ---------------------------------------------------------------------------
// secondsAgo / formatAge
// ---------------------------------------------------------------------------
describe('secondsAgo', () => {
  it('returns whole elapsed seconds', () => {
    expect(secondsAgo(0, 12_000)).toBe(12);
    expect(secondsAgo(1_000, 13_400)).toBe(12);
  });

  it('clamps a negative delta to 0', () => {
    expect(secondsAgo(5_000, 1_000)).toBe(0);
  });
});

describe('formatAge', () => {
  it('formats seconds / minutes / hours compactly', () => {
    expect(formatAge(12)).toBe('12s');
    expect(formatAge(59)).toBe('59s');
    expect(formatAge(60)).toBe('1m');
    expect(formatAge(125)).toBe('2m');
    expect(formatAge(3600)).toBe('1h');
    expect(formatAge(7300)).toBe('2h');
  });
});

// ---------------------------------------------------------------------------
// rowPresentation
// ---------------------------------------------------------------------------
describe('rowPresentation', () => {
  it('tier:null open incident presents as a plain in-progress row', () => {
    const p = rowPresentation(unclassified);
    expect(p.dotState).toBe('open');
    expect(p.statusText).toBe('In progress');
    expect(p.showProgressBar).toBe(true);
    expect(p.showKillSwitchTag).toBe(false);
    expect(p.showNotificationBadge).toBe(false);
  });

  it('approved-and-executing open incident does not fall through to "In progress"', () => {
    expect(rowPresentation(openApproved).statusText).toBe('Approved — executing');
  });

  it('kill-switch-blocked row: blocked dot + manual-action tag, tier untouched', () => {
    const blocked = incident({ blocked_by_kill_switch: true, tier: 1 });
    const p = rowPresentation(blocked);
    expect(p.dotState).toBe('blocked');
    expect(p.showKillSwitchTag).toBe(true);
    expect(p.showProgressBar).toBe(false);
    expect(blocked.tier).toBe(1);
  });
});
