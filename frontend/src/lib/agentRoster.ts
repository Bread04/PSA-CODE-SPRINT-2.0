/**
 * Agent-roster derivation (Harbor Signal "Orchestra" — spec-harbor-signal-reskin,
 * AD-18 / AD-19).
 *
 * A pure, total fold of an incident's `agents` bundle (the validated specialist
 * output the orchestrator exposes read-only, AD-19) plus its `AGENT_CALL` trace
 * entries into a fixed, ordered list of operator-facing agent chips — one per
 * specialist, berth → crane → yard.
 *
 * This mirrors `deriveRail`'s trace-reading style so the two projections stay
 * recognisably kin (epic-4 retro item 2): the per-agent RUN STATE is derived
 * ONLY from the incident's `AGENT_CALL` trace entries, never from
 * `incident.tier` / `status` / `confidence`.
 *
 * The run state is an AGGREGATE over every `AGENT_CALL` row that names the
 * agent, in this priority order:
 *
 *   - any row with a truthy `error.fallback_used`          -> `fallback`
 *   - else any row that carries an `error`                 -> `timeout`
 *   - else (or no `AGENT_CALL` row for that agent)         -> `complete`
 *
 * `fallback` wins over `timeout` on purpose: an agent that recovered to a
 * last-known-state is a distinct, softer signal than a bare failed call, and
 * that is the state the operator should see.
 *
 * The stage rail collapses the 1–3 `AGENT_CALL` fan-out rows into its single
 * `AGENT_CALL` stage; this is the per-agent view that row cannot show.
 */

import type { Incident, TraceEntry } from '../types/incident';

/** The frozen specialist roster — exactly these three, this order (AD-19). */
export const ROSTER_AGENTS = ['berth', 'crane', 'yard'] as const;
export type RosterAgent = (typeof ROSTER_AGENTS)[number];

export type AgentRunState = 'complete' | 'timeout' | 'fallback';

/** One agent chip projected against a concrete incident. */
export interface AgentChipView {
  agent: RosterAgent;
  summary: string;
  actions: string[];
  constraints: string[];
  rationale: string;
  state: AgentRunState;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

/** Aggregate run state for one agent, read from the `AGENT_CALL` trace rows. */
function runStateFor(agent: RosterAgent, trace: TraceEntry[]): AgentRunState {
  const entries = trace.filter((entry) => {
    if (!entry || entry.stage !== 'AGENT_CALL') return false;
    const detail = asRecord(entry.detail);
    return String(detail?.agent ?? '').trim().toLowerCase() === agent;
  });
  if (entries.length === 0) return 'complete';
  if (entries.some((e) => e.error?.fallback_used)) return 'fallback';
  if (entries.some((e) => e.error != null)) return 'timeout';
  return 'complete';
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];
}

/**
 * Fold an incident into the ordered roster. Pure, total, never throws.
 *
 *   - `null` / absent incident, or an empty / absent `agents` bundle -> `[]`.
 *   - Otherwise one chip per `agents` entry, re-sorted to berth → crane → yard;
 *     an entry whose `agent` is not one of the three is dropped.
 *   - `state` is the aggregate over `trace` `AGENT_CALL` rows (see module
 *     comment); an agent with no matching row is `complete`.
 *   - A missing / blank `summary` falls back to `'—'`.
 */
export function deriveRoster(incident: Incident | null | undefined): AgentChipView[] {
  const agents = Array.isArray(incident?.agents) ? incident.agents : [];
  if (agents.length === 0) return [];

  const trace = Array.isArray(incident?.trace)
    ? incident.trace.filter((e): e is TraceEntry => e != null)
    : [];

  const byAgent = new Map<RosterAgent, AgentChipView>();
  for (const rec of agents) {
    const src = asRecord(rec);
    if (!src) continue;
    const agent = src.agent as RosterAgent;
    if (!ROSTER_AGENTS.includes(agent)) continue;
    if (byAgent.has(agent)) continue;
    byAgent.set(agent, {
      agent,
      summary:
        typeof src.summary === 'string' && src.summary.trim() ? src.summary : '—',
      actions: toStringArray(src.actions),
      constraints: toStringArray(src.constraints),
      rationale: typeof src.rationale === 'string' ? src.rationale : '',
      state: runStateFor(agent, trace),
    });
  }

  return ROSTER_AGENTS.filter((a) => byAgent.has(a)).map((a) => byAgent.get(a)!);
}
