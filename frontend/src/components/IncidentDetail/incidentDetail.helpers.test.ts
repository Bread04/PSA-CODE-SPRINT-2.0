import { describe, it, expect } from 'vitest';

import {
  bannerModel,
  dgRejectedReasons,
  formatPredictedImpact,
} from './incidentDetail.helpers';
import type { Incident, PredictedImpact } from '../../types/incident';
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
