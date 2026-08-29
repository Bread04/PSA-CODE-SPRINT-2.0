import { describe, it, expect } from 'vitest';

import { deriveRoster, ROSTER_AGENTS } from './agentRoster';
import type {
  AgentRecommendation,
  Incident,
  TraceEntry,
} from '../types/incident';

/**
 * Harbor Signal AgentRoster — `deriveRoster` pure derivation
 * (spec-harbor-signal-reskin I/O & Edge-Case Matrix).
 */

function rec(overrides: Partial<AgentRecommendation> = {}): AgentRecommendation {
  return {
    agent: 'berth',
    summary: 'summary text',
    actions: ['a1'],
    constraints: ['c1'],
    rationale: 'because',
    ...overrides,
  };
}

function agentCall(
  agent: string,
  error: TraceEntry['error'] = null,
): TraceEntry {
  return {
    stage: 'AGENT_CALL',
    timestamp: '2026-08-28T00:00:00Z',
    detail: { agent },
    error,
  };
}

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    incident_id: 'inc-roster',
    status: 'open',
    entity_refs: [],
    tier: 3,
    confidence: 100,
    recommended_option_id: null,
    options: [],
    approval_status: 'pending',
    blocked_by_kill_switch: false,
    agents: [],
    trace: [],
    created_at: '2026-08-28T00:00:00Z',
    last_signal_at: '2026-08-28T00:00:00Z',
    ...overrides,
  };
}

const TIMEOUT_ERR: TraceEntry['error'] = {
  stage: 'AGENT_CALL',
  error: 'telemetry timeout',
  retried: true,
  fallback_used: false,
};
const FALLBACK_ERR: TraceEntry['error'] = {
  stage: 'AGENT_CALL',
  error: 'telemetry timeout',
  retried: true,
  fallback_used: true,
};

describe('deriveRoster — full bundle', () => {
  it('renders one chip per agent, re-sorted berth -> crane -> yard', () => {
    const chips = deriveRoster(
      incident({
        agents: [
          rec({ agent: 'yard', summary: 'yard s' }),
          rec({ agent: 'berth', summary: 'berth s' }),
          rec({ agent: 'crane', summary: 'crane s' }),
        ],
      }),
    );
    expect(chips.map((c) => c.agent)).toEqual([...ROSTER_AGENTS]);
    expect(chips.map((c) => c.summary)).toEqual(['berth s', 'crane s', 'yard s']);
    expect(chips.every((c) => c.state === 'complete')).toBe(true);
    expect(chips[0].actions).toEqual(['a1']);
    expect(chips[0].constraints).toEqual(['c1']);
    expect(chips[0].rationale).toBe('because');
  });

  it('falls back a missing / blank summary to an em dash', () => {
    const chips = deriveRoster(
      incident({
        agents: [
          rec({ agent: 'berth', summary: '   ' }),
          { ...rec({ agent: 'crane' }), summary: undefined as unknown as string },
        ],
      }),
    );
    expect(chips.map((c) => c.summary)).toEqual(['—', '—']);
  });

  it('matches the trace agent key case-insensitively', () => {
    const chips = deriveRoster(
      incident({
        agents: [rec({ agent: 'crane' })],
        trace: [
          {
            stage: 'AGENT_CALL',
            timestamp: 't',
            detail: { agent: ' CRANE ' },
            error: FALLBACK_ERR,
          },
        ],
      }),
    );
    expect(chips[0].state).toBe('fallback');
  });

  it('drops an entry whose agent is not one of the frozen three', () => {
    const chips = deriveRoster(
      incident({
        agents: [
          rec({ agent: 'berth' }),
          { ...rec(), agent: 'weather' as unknown as 'berth' },
        ],
      }),
    );
    expect(chips.map((c) => c.agent)).toEqual(['berth']);
  });
});

describe('deriveRoster — run state from trace', () => {
  const agents = [
    rec({ agent: 'berth' }),
    rec({ agent: 'crane' }),
    rec({ agent: 'yard' }),
  ];

  it('crane AGENT_CALL with error.fallback_used -> FALLBACK; the others COMPLETE', () => {
    const chips = deriveRoster(
      incident({
        agents,
        trace: [
          agentCall('berth'),
          agentCall('crane', FALLBACK_ERR),
          agentCall('yard'),
        ],
      }),
    );
    expect(chips.find((c) => c.agent === 'crane')!.state).toBe('fallback');
    expect(chips.find((c) => c.agent === 'berth')!.state).toBe('complete');
    expect(chips.find((c) => c.agent === 'yard')!.state).toBe('complete');
  });

  it('an AGENT_CALL error without a fallback -> TIMEOUT', () => {
    const chips = deriveRoster(
      incident({ agents, trace: [agentCall('crane', TIMEOUT_ERR)] }),
    );
    expect(chips.find((c) => c.agent === 'crane')!.state).toBe('timeout');
  });

  it('an agent with no AGENT_CALL entry is COMPLETE (no crash)', () => {
    const chips = deriveRoster(
      incident({ agents, trace: [agentCall('berth')] }),
    );
    expect(chips.every((c) => c.state === 'complete')).toBe(true);
  });

  it('ignores non-AGENT_CALL stages and unrelated agent keys', () => {
    const chips = deriveRoster(
      incident({
        agents,
        trace: [
          { stage: 'CONFIDENCE', timestamp: 't', detail: { agent: 'crane' }, error: TIMEOUT_ERR },
          agentCall('berth'),
        ],
      }),
    );
    expect(chips.every((c) => c.state === 'complete')).toBe(true);
  });
});

describe('deriveRoster — empty / null', () => {
  it('empty agents bundle -> []', () => {
    expect(deriveRoster(incident({ agents: [] }))).toEqual([]);
  });

  it('absent agents (undefined) -> [] without throwing', () => {
    const bad = incident();
    delete (bad as { agents?: unknown }).agents;
    expect(deriveRoster(bad)).toEqual([]);
  });

  it('null / undefined incident -> []', () => {
    expect(deriveRoster(null)).toEqual([]);
    expect(deriveRoster(undefined)).toEqual([]);
  });

  it('does not throw on nullish trace elements', () => {
    const messy = incident({
      agents: [rec({ agent: 'berth' })],
      trace: [null as unknown as TraceEntry, agentCall('berth')],
    });
    expect(() => deriveRoster(messy)).not.toThrow();
    expect(deriveRoster(messy)[0].state).toBe('complete');
  });
});
