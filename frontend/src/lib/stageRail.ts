/**
 * Stage-rail derivation (Story 4.2 / UX-DR13).
 *
 * A pure, total fold of an incident's execution `trace` into a fixed, ordered
 * list of operator-facing rail stages, each tagged
 * `done | active | error | pending | complete`. This is a compact *projection*
 * of the backend pipeline vocabulary (`backend/orchestrator/trace.py` `STAGES`),
 * NOT a second source of truth:
 *
 *   - `AGENT_CALL` collapses the 1–3 specialist fan-out entries into one step.
 *   - `POLICY_DECISION` maps both `POLICY_START` and `POLICY_DECISION`.
 *   - Bookkeeping stages the operator does not need (`NOTIFY`) are not shown.
 *
 * Rail state is derived ONLY from `trace` entries — never from `incident.tier`
 * / `status` / `approval_status`. Unknown / unmapped / nullish trace entries
 * are ignored: they never crash and never advance the rail.
 *
 * The error overlay mirrors `ExecutionTrace` `isMarkerRow` / `markerLabel`: a
 * stage that was reached can still carry an `ERROR` / `RETRY` / `FALLBACK` flag
 * (a retried `AGENT_CALL` the pipeline moved past), and `error` wins over
 * `done` / `active` / `complete` for that stage. Like `isMarkerRow`, the
 * overlay keys off `entry.error` / `detail.retried` / `detail.fallback_used`
 * only — NOT `detail.blocked` (every Tier-3 approval hold carries that).
 */

import type { TraceEntry } from '../types/incident';

/** One rail stage: its stable id, its visible label, and the producer stages it folds. */
export interface RailStage {
  id: string;
  label: string;
  from: readonly string[];
}

/**
 * The fixed, ordered rail. A compact projection of `trace.py` `STAGES` — see
 * the module comment for the collapse / drop rules. Labels are the backend
 * SCREAMING_SNAKE vocabulary verbatim.
 */
export const RAIL_STAGES: readonly RailStage[] = [
  { id: 'INGEST', label: 'INGEST', from: ['INGEST'] },
  { id: 'CORRELATE', label: 'CORRELATE', from: ['CORRELATE'] },
  { id: 'AGENT_CALL', label: 'AGENT_CALL', from: ['AGENT_CALL'] },
  { id: 'SYNTHESIZE', label: 'SYNTHESIZE', from: ['SYNTHESIZE'] },
  { id: 'CONFIDENCE', label: 'CONFIDENCE', from: ['CONFIDENCE'] },
  {
    id: 'POLICY_DECISION',
    label: 'POLICY_DECISION',
    from: ['POLICY_START', 'POLICY_DECISION'],
  },
  { id: 'DG_CHECK', label: 'DG_CHECK', from: ['DG_CHECK'] },
  { id: 'APPROVAL', label: 'APPROVAL', from: ['APPROVAL'] },
  { id: 'EXECUTE', label: 'EXECUTE', from: ['EXECUTE'] },
  { id: 'VERIFY', label: 'VERIFY', from: ['VERIFY'] },
];

export type RailState = 'done' | 'active' | 'error' | 'pending' | 'complete';

/** One rail stage projected against a concrete trace. */
export type RailStageView = {
  id: string;
  label: string;
  state: RailState;
  flag: '' | 'ERROR' | 'RETRY' | 'FALLBACK';
};

/** Producer stage name -> rail-stage index (built once from `RAIL_STAGES`). */
const PRODUCER_TO_RAIL_INDEX: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  RAIL_STAGES.forEach((stage, index) => {
    for (const producer of stage.from) map.set(producer, index);
  });
  return map;
})();

/** Rail index for a producer stage name, or -1 when it maps to no rail stage. */
function railIndexOf(stage: string): number {
  const idx = PRODUCER_TO_RAIL_INDEX.get(stage);
  return idx === undefined ? -1 : idx;
}

/** Truthy `detail[key]`, tolerant of a missing / non-object `detail` (spec: "truthy"). */
function detailFlag(detail: unknown, key: string): boolean {
  if (!detail || typeof detail !== 'object') return false;
  return Boolean((detail as Record<string, unknown>)[key]);
}

/**
 * The error overlay for the entries that map to one rail stage. `isError` when
 * ANY entry carries `.error` or a truthy `detail.retried` / `detail.fallback_used`
 * (NOT `detail.blocked`); `flag` follows the same priority order as
 * `ExecutionTrace.markerLabel` (`error.fallback_used` -> `error.retried` ->
 * `error` -> `detail.fallback_used` -> `detail.retried` -> `''`).
 */
function errorOverlay(entries: TraceEntry[]): {
  isError: boolean;
  flag: RailStageView['flag'];
} {
  const isError = entries.some(
    (e) =>
      e.error != null ||
      detailFlag(e.detail, 'retried') ||
      detailFlag(e.detail, 'fallback_used'),
  );
  if (!isError) return { isError: false, flag: '' };

  if (entries.some((e) => e.error?.fallback_used)) return { isError, flag: 'FALLBACK' };
  if (entries.some((e) => e.error?.retried)) return { isError, flag: 'RETRY' };
  if (entries.some((e) => e.error != null)) return { isError, flag: 'ERROR' };
  if (entries.some((e) => detailFlag(e.detail, 'fallback_used')))
    return { isError, flag: 'FALLBACK' };
  if (entries.some((e) => detailFlag(e.detail, 'retried')))
    return { isError, flag: 'RETRY' };
  return { isError, flag: '' };
}

/**
 * Fold a trace into the fixed rail. Pure, total, never throws.
 *
 *   - Nullish entries are dropped; the rest are sorted by `timestamp` (stable)
 *     and each mapped to a rail index via `RAIL_STAGES[i].from` (unmapped
 *     entries are ignored).
 *   - `reached` = the furthest rail index any entry maps to (-1 if none). The
 *     furthest-reached stage is `active` — the spec's "no later stage has any
 *     entry" clause: array order / out-of-order timestamps cannot change which
 *     stage is furthest.
 *   - `i < reached` -> `done`; `i === reached` -> `active`, or `complete` when
 *     that furthest stage is the terminal `VERIFY`; `i > reached` -> `pending`.
 *   - `error` is then overlaid on any reached stage whose entries carry an
 *     error / retry / fallback marker — `error` wins over `done` / `active` /
 *     `complete`.
 *   - An empty / nullish trace -> every stage `pending`, `flag: ''`.
 */
export function deriveRail(trace: TraceEntry[] | null | undefined): RailStageView[] {
  const entries = (Array.isArray(trace) ? trace : []).filter(
    (entry): entry is TraceEntry => entry != null,
  );
  entries.sort((a, b) =>
    String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? '')),
  );

  const indexed = entries.map((entry) => ({
    entry,
    index: railIndexOf(entry?.stage ?? ''),
  }));
  const reachedIndices = indexed.map((m) => m.index).filter((i) => i >= 0);
  const reached = reachedIndices.length > 0 ? Math.max(...reachedIndices) : -1;
  const lastIndex = RAIL_STAGES.length - 1;

  return RAIL_STAGES.map((stage, i) => {
    let state: RailState =
      i < reached
        ? 'done'
        : i === reached
          ? reached === lastIndex
            ? 'complete'
            : 'active'
          : 'pending';
    let flag: RailStageView['flag'] = '';

    if (i <= reached) {
      const stageEntries = indexed.filter((m) => m.index === i).map((m) => m.entry);
      const overlay = errorOverlay(stageEntries);
      if (overlay.isError) {
        state = 'error';
        flag = overlay.flag;
      }
    }

    return { id: stage.id, label: stage.label, state, flag };
  });
}
