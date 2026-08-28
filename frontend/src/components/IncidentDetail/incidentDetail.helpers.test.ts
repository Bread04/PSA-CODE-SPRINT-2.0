import { describe, it, expect } from 'vitest';

import {
  bannerModel,
  dgRejectedReasons,
  formatPredictedImpact,
  yardBlockUtilization,
} from './incidentDetail.helpers';
import type { Incident, PredictedImpact, TraceEntry } from '../../types/incident';
import {
  tier1Resolved,
  tier3DgRejected,
  tier3WithAlternatives,
  unclassified,
} from '../../test/fixtures/incidents';

/**
 * Story 2.4 — IncidentDetail / ApprovalBanner pure helpers.
 * (Retro item 3: coverage the story shipped without.)
 */

const impact: PredictedImpact = {
  delay_min: 35,
  cost: 'medium',
  yard_impact: 'yard utilization +4%',
  risk: 'low',
};

describe('formatPredictedImpact', () => {
  it('renders delay, cost band, yard effect, risk band on one factual line', () => {
    expect(formatPredictedImpact(impact)).toBe(
      '+35 min delay · cost medium · yard utilization +4% · risk low',
    );
  });

  it('keeps a negative delay signed', () => {
    expect(formatPredictedImpact({ ...impact, delay_min: -10 })).toMatch(
      /^-10 min delay/,
    );
  });
});

describe('bannerModel', () => {
  it('situation joins entity_refs with ", "', () => {
    expect(bannerModel(tier3WithAlternatives).situation).toBe(
      'vessel:MSC-ANNA, crane:CRANE-4',
    );
  });

  it('falls back to incident_id when there are no entity_refs', () => {
    const noRefs: Incident = { ...unclassified, entity_refs: [] };
    expect(bannerModel(noRefs).situation).toBe(noRefs.incident_id);
  });

  it('recommendation / impact resolve from recommended_option_id', () => {
    const m = bannerModel(tier3WithAlternatives);
    expect(m.recommendation).toMatch(/Reassign MSC Anna to Berth C7/);
    expect(m.impact).not.toBeNull();
  });

  it('recommendation / impact are null when the id does not resolve', () => {
    const dangling: Incident = {
      ...tier3WithAlternatives,
      recommended_option_id: 'opt-does-not-exist',
    };
    const m = bannerModel(dangling);
    expect(m.recommendation).toBeNull();
    expect(m.impact).toBeNull();
  });

  it('alternatives are every option except the recommended one, in list order', () => {
    const m = bannerModel(tier3WithAlternatives);
    expect(m.alternatives.map((o) => o.option_id)).toEqual(['opt-2', 'opt-3']);
  });

  it('does not mutate the incident', () => {
    const snapshot = JSON.stringify(tier3WithAlternatives);
    bannerModel(tier3WithAlternatives);
    expect(JSON.stringify(tier3WithAlternatives)).toBe(snapshot);
  });
});

describe('yardBlockUtilization', () => {
  const correlate = (payload: unknown): TraceEntry => ({
    stage: 'CORRELATE',
    timestamp: '2026-08-27T10:00:00Z',
    detail: { signal_type: 'yard_congestion', payload } as Record<string, unknown>,
    error: null,
  });

  const withTrace = (trace: TraceEntry[]): Incident => ({ ...tier1Resolved, trace });

  it('renders both blocks as rounded percentages from the newest CORRELATE payload', () => {
    const inc = withTrace([
      correlate({ yard_utilization: { tuas_c7: 0.93, pasir_panjang_p2: 0.44 } }),
    ]);
    expect(yardBlockUtilization(inc)).toBe('Tuas C7 93% · Pasir Panjang P2 44%');
  });

  it('uses the LAST CORRELATE entry when several are present', () => {
    const inc = withTrace([
      correlate({ yard_utilization: { tuas_c7: 0.5, pasir_panjang_p2: 0.5 } }),
      correlate({ yard_utilization: { tuas_c7: 0.876, pasir_panjang_p2: 0.401 } }),
    ]);
    expect(yardBlockUtilization(inc)).toBe('Tuas C7 88% · Pasir Panjang P2 40%');
  });

  it('is null when there is no CORRELATE entry', () => {
    expect(yardBlockUtilization(tier1Resolved)).toBeNull();
  });

  it('is null when the CORRELATE entry carries no yard_utilization payload', () => {
    expect(yardBlockUtilization(withTrace([correlate({})]))).toBeNull();
    expect(
      yardBlockUtilization(withTrace([correlate({ yard_utilization: {} })])),
    ).toBeNull();
  });

  it('is null when a block fraction is out of the [0, 1] range', () => {
    expect(
      yardBlockUtilization(
        withTrace([
          correlate({ yard_utilization: { tuas_c7: 1.5, pasir_panjang_p2: 0.4 } }),
        ]),
      ),
    ).toBeNull();
  });

  it('is null (no throw) when a block value is missing or non-numeric', () => {
    expect(
      yardBlockUtilization(
        withTrace([correlate({ yard_utilization: { tuas_c7: 0.9 } })]),
      ),
    ).toBeNull();
    expect(
      yardBlockUtilization(
        withTrace([
          correlate({ yard_utilization: { tuas_c7: 'high', pasir_panjang_p2: 0.4 } }),
        ]),
      ),
    ).toBeNull();
  });

  it('tolerates a missing trace', () => {
    const noTrace = { ...tier1Resolved, trace: undefined } as unknown as Incident;
    expect(yardBlockUtilization(noTrace)).toBeNull();
  });
});

describe('dgRejectedReasons', () => {
  it('collects DG_CHECK violation reasons in trace order', () => {
    const reasons = dgRejectedReasons(tier3DgRejected);
    expect(reasons.length).toBe(1);
    expect(reasons[0]).toMatch(/DG\/IMDG/i);
  });

  it('is empty when no DG_CHECK entry has violation: true', () => {
    expect(dgRejectedReasons(tier1Resolved)).toEqual([]);
  });

  it('tolerates a missing trace', () => {
    const noTrace = { ...tier1Resolved, trace: undefined } as unknown as Incident;
    expect(dgRejectedReasons(noTrace)).toEqual([]);
  });
});
