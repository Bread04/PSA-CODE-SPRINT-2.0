import { describe, it, expect } from 'vitest';

import { RAIL_STAGES, deriveRail, type RailStageView } from './stageRail';
import type { TraceEntry } from '../types/incident';

/**
 * Story 4.2 — `deriveRail` pure derivation.
 *
 * Covers every I/O & Edge-Case Matrix row directly against `deriveRail`, plus
 * the collapse / ordering / flag-priority rules called out in the spec's Tasks
 * section and the 4-2 review patches.
 */

const BASE = Date.parse('2026-08-28T00:00:00Z');

type Step = [
  string,
  (Partial<Pick<TraceEntry, 'detail' | 'error'>> & { at?: number })?,
];

/** Build a trace from `[stage, opts?]` tuples with monotonically rising timestamps. */
function trace(...steps: Step[]): TraceEntry[] {
  return steps.map(([stage, opts], i) => ({
    stage,
    timestamp: new Date(BASE + (opts?.at ?? i) * 1000).toISOString(),
    detail: opts?.detail ?? {},
    error: opts?.error ?? null,
  }));
}

function viewOf(views: RailStageView[], id: string): RailStageView {
  const v = views.find((s) => s.id === id);
  if (!v) throw new Error(`no rail stage ${id}`);
  return v;
}

const RAIL_IDS = [
  'INGEST',
  'CORRELATE',
  'AGENT_CALL',
  'SYNTHESIZE',
  'CONFIDENCE',
  'POLICY_DECISION',
  'DG_CHECK',
  'APPROVAL',
  'EXECUTE',
  'VERIFY',
] as const;

/** A full clean pipeline run, one entry per producer stage, in order. */
const FULL_TRACE: Step[] = [
  ['INGEST'],
  ['CORRELATE'],
  ['AGENT_CALL'],
  ['SYNTHESIZE'],
  ['CONFIDENCE'],
  ['POLICY_DECISION'],
  ['DG_CHECK'],
  ['APPROVAL'],
  ['EXECUTE'],
  ['VERIFY'],
];

const EXECUTE_ERROR: TraceEntry['error'] = {
  stage: 'EXECUTE',
  error: 'downstream write failed',
  retried: false,
  fallback_used: false,
};

describe('deriveRail — shape', () => {
  it('always returns the 10 fixed stages in the backend SCREAMING_SNAKE order', () => {
    const views = deriveRail([]);
    expect(views.map((v) => v.id)).toEqual([...RAIL_IDS]);
    expect(views.map((v) => v.label)).toEqual([...RAIL_IDS]);
    expect(views).toHaveLength(RAIL_STAGES.length);
  });
});

describe('deriveRail — I/O & Edge-Case Matrix', () => {
  it('MID_PIPELINE: trace ends at AGENT_CALL', () => {
    const views = deriveRail(trace(['CORRELATE'], ['AGENT_CALL']));
    expect(viewOf(views, 'INGEST').state).toBe('done');
    expect(viewOf(views, 'CORRELATE').state).toBe('done');
    expect(viewOf(views, 'AGENT_CALL').state).toBe('active');
    for (const id of ['SYNTHESIZE', 'CONFIDENCE', 'POLICY_DECISION', 'DG_CHECK', 'APPROVAL', 'EXECUTE', 'VERIFY']) {
      expect(viewOf(views, id).state).toBe('pending');
    }
    expect(views.every((v) => v.flag === '')).toBe(true);
  });

  it('ERROR_STAGE: an EXECUTE entry with .error, VERIFY absent', () => {
    const views = deriveRail(trace(['CORRELATE'], ['EXECUTE', { error: EXECUTE_ERROR }]));
    const execute = viewOf(views, 'EXECUTE');
    expect(execute.state).toBe('error');
    expect(execute.flag).toBe('ERROR');
    for (const id of ['INGEST', 'CORRELATE', 'AGENT_CALL', 'SYNTHESIZE', 'CONFIDENCE', 'POLICY_DECISION', 'DG_CHECK', 'APPROVAL']) {
      expect(viewOf(views, id).state).toBe('done');
    }
    expect(viewOf(views, 'VERIFY').state).toBe('pending');
  });

  it('RETRY_FLAG: an AGENT_CALL with detail.retried, trace continues past it', () => {
    const views = deriveRail(trace(['AGENT_CALL', { detail: { retried: true } }], ['CONFIDENCE']));
    const agent = viewOf(views, 'AGENT_CALL');
    expect(agent.state).toBe('error');
    expect(agent.flag).toBe('RETRY');
    // Later reached stages still read done.
    expect(viewOf(views, 'SYNTHESIZE').state).toBe('done');
    expect(viewOf(views, 'CONFIDENCE').state).toBe('active');
  });

  it('COMPLETE: trace ends at VERIFY with no errors -> VERIFY complete, the rest done', () => {
    const views = deriveRail(trace(...FULL_TRACE));
    expect(viewOf(views, 'VERIFY').state).toBe('complete');
    for (const id of RAIL_IDS.filter((x) => x !== 'VERIFY')) {
      expect(viewOf(views, id).state).toBe('done');
    }
    expect(views.every((v) => v.flag === '')).toBe(true);
  });

  it('NO_INCIDENT: deriveRail([]) and deriveRail(null) -> 10 x pending', () => {
    for (const input of [[] as TraceEntry[], null, undefined]) {
      const views = deriveRail(input);
      expect(views).toHaveLength(10);
      expect(views.every((v) => v.state === 'pending')).toBe(true);
      expect(views.every((v) => v.flag === '')).toBe(true);
    }
  });

  it('UNKNOWN_STAGE: an unmapped stage between known stages is ignored', () => {
    const views = deriveRail(trace(['CORRELATE'], ['WEATHER_CHECK'], ['AGENT_CALL']));
    expect(viewOf(views, 'CORRELATE').state).toBe('done');
    expect(viewOf(views, 'AGENT_CALL').state).toBe('active');
    // No spurious active anywhere else.
    expect(views.filter((v) => v.state === 'active').map((v) => v.id)).toEqual(['AGENT_CALL']);
    for (const id of ['SYNTHESIZE', 'CONFIDENCE', 'POLICY_DECISION', 'DG_CHECK', 'APPROVAL', 'EXECUTE', 'VERIFY']) {
      expect(viewOf(views, id).state).toBe('pending');
    }
  });
});

describe('deriveRail — collapse & label rules', () => {
  it('POLICY_DECISION maps both POLICY_START and POLICY_DECISION', () => {
    expect(viewOf(deriveRail(trace(['POLICY_START'])), 'POLICY_DECISION').state).toBe('active');
    expect(viewOf(deriveRail(trace(['POLICY_DECISION'])), 'POLICY_DECISION').state).toBe('active');
    const both = deriveRail(trace(['POLICY_START'], ['POLICY_DECISION']));
    expect(viewOf(both, 'POLICY_DECISION').state).toBe('active');
    expect(both.filter((v) => v.state === 'active')).toHaveLength(1);
  });

  it('AGENT_CALL stays a single stage across three AGENT_CALL entries', () => {
    const views = deriveRail(trace(['AGENT_CALL'], ['AGENT_CALL'], ['AGENT_CALL']));
    expect(viewOf(views, 'AGENT_CALL').state).toBe('active');
    expect(views.filter((v) => v.state === 'active')).toHaveLength(1);
    expect(viewOf(views, 'INGEST').state).toBe('done');
    expect(viewOf(views, 'CORRELATE').state).toBe('done');
  });

  it('out-of-order timestamps: the furthest-reached stage is active, not the newest entry', () => {
    // The newest-by-timestamp entry (INGEST @ +9s) is an EARLY stage; AGENT_CALL
    // is the furthest rail index any entry maps to. The spec's "no later stage
    // has any entry" clause makes AGENT_CALL active regardless of array order or
    // which entry is chronologically newest.
    const entries = trace(
      ['AGENT_CALL', { at: 2 }],
      ['CORRELATE', { at: 5 }],
      ['INGEST', { at: 9 }],
    );
    const reordered = [entries[2], entries[0], entries[1]];
    const views = deriveRail(reordered);
    expect(viewOf(views, 'AGENT_CALL').state).toBe('active');
    expect(viewOf(views, 'CORRELATE').state).toBe('done');
    expect(viewOf(views, 'INGEST').state).toBe('done');
    expect(views.filter((v) => v.state === 'active').map((v) => v.id)).toEqual(['AGENT_CALL']);
  });
});

describe('deriveRail — error overlay', () => {
  it('detail.blocked alone does NOT flag a stage error (matches ExecutionTrace.isMarkerRow)', () => {
    const views = deriveRail(
      trace(['CORRELATE'], ['AGENT_CALL'], ['APPROVAL', { detail: { blocked: true } }]),
    );
    const approval = viewOf(views, 'APPROVAL');
    expect(approval.state).toBe('active');
    expect(approval.flag).toBe('');
    expect(views.some((v) => v.state === 'error')).toBe(false);
  });

  it('error overlay beats done on the same stage', () => {
    const views = deriveRail(
      trace(
        ['AGENT_CALL', { error: { stage: 'AGENT_CALL', error: 'x', retried: false, fallback_used: false } }],
        ['SYNTHESIZE'],
        ['CONFIDENCE'],
      ),
    );
    expect(viewOf(views, 'AGENT_CALL').state).toBe('error');
    expect(viewOf(views, 'AGENT_CALL').flag).toBe('ERROR');
  });

  it('detail.retried / detail.fallback_used are truthy tests, not === true', () => {
    const retried = deriveRail(trace(['AGENT_CALL', { detail: { retried: 1 } }], ['CONFIDENCE']));
    expect(viewOf(retried, 'AGENT_CALL').state).toBe('error');
    expect(viewOf(retried, 'AGENT_CALL').flag).toBe('RETRY');

    const fell = deriveRail(trace(['AGENT_CALL', { detail: { fallback_used: 'yes' } }], ['CONFIDENCE']));
    expect(viewOf(fell, 'AGENT_CALL').flag).toBe('FALLBACK');
  });

  it('flag priority is driven through the error object', () => {
    const fb = deriveRail(
      trace(['AGENT_CALL', { error: { stage: 'AGENT_CALL', error: 'x', retried: false, fallback_used: true } }], ['CONFIDENCE']),
    );
    expect(viewOf(fb, 'AGENT_CALL').flag).toBe('FALLBACK');

    const rt = deriveRail(
      trace(['AGENT_CALL', { error: { stage: 'AGENT_CALL', error: 'x', retried: true, fallback_used: false } }], ['CONFIDENCE']),
    );
    expect(viewOf(rt, 'AGENT_CALL').flag).toBe('RETRY');

    // error.fallback_used outranks detail.retried on the same stage.
    const both = deriveRail(
      trace(
        [
          'AGENT_CALL',
          {
            detail: { retried: true },
            error: { stage: 'AGENT_CALL', error: 'x', retried: false, fallback_used: true },
          },
        ],
        ['CONFIDENCE'],
      ),
    );
    expect(viewOf(both, 'AGENT_CALL').flag).toBe('FALLBACK');
  });
});

describe('deriveRail — terminal / degraded VERIFY', () => {
  it('finished but degraded: a retried AGENT_CALL, run completes -> AGENT_CALL error+RETRY, VERIFY complete', () => {
    const steps: Step[] = [
      ['CORRELATE'],
      ['AGENT_CALL', { detail: { retried: true } }],
      ['SYNTHESIZE'],
      ['CONFIDENCE'],
      ['POLICY_DECISION'],
      ['DG_CHECK'],
      ['APPROVAL'],
      ['EXECUTE'],
      ['VERIFY'],
    ];
    const views = deriveRail(trace(...steps));
    expect(viewOf(views, 'AGENT_CALL').state).toBe('error');
    expect(viewOf(views, 'AGENT_CALL').flag).toBe('RETRY');
    for (const id of ['SYNTHESIZE', 'CONFIDENCE', 'POLICY_DECISION', 'DG_CHECK', 'APPROVAL', 'EXECUTE']) {
      expect(viewOf(views, id).state).toBe('done');
    }
    expect(viewOf(views, 'VERIFY').state).toBe('complete');
  });

  it('a VERIFY entry carrying .error -> VERIFY state error (not complete)', () => {
    const steps: Step[] = [
      ...FULL_TRACE.slice(0, 9),
      ['VERIFY', { error: { stage: 'VERIFY', error: 'post-check mismatch', retried: false, fallback_used: false } }],
    ];
    const views = deriveRail(trace(...steps));
    expect(viewOf(views, 'VERIFY').state).toBe('error');
    expect(viewOf(views, 'VERIFY').flag).toBe('ERROR');
  });
});

describe('deriveRail — totality', () => {
  it('does not throw on nullish array elements and still resolves the real entries', () => {
    const messy = [
      null,
      { stage: 'CORRELATE', timestamp: '2026-08-28T00:00:01Z', detail: {}, error: null },
      undefined,
    ] as unknown as TraceEntry[];
    let views: RailStageView[] = [];
    expect(() => {
      views = deriveRail(messy);
    }).not.toThrow();
    expect(viewOf(views, 'CORRELATE').state).toBe('active');
    expect(viewOf(views, 'INGEST').state).toBe('done');
  });

  it('does not throw on entries missing timestamp / detail', () => {
    const bad = [
      { stage: 'AGENT_CALL' },
      { stage: 'CONFIDENCE', timestamp: null, detail: null, error: undefined },
    ] as unknown as TraceEntry[];
    expect(() => deriveRail(bad)).not.toThrow();
  });
});
