/**
 * Portwatch Console — IncidentFeed pure helpers (Story 2.3).
 *
 * Every function here is a pure function of its arguments: given the same
 * incident list it returns the same result, and it never mutates its input.
 * Selecting or interacting with one row therefore cannot reorder or change
 * another (FR16).
 */

import type { Incident, TraceEntry } from '../../types/incident';

/** Tag text shown on a Tier 1/2 incident whose auto-execution the kill switch blocked. */
export const KILL_SWITCH_TAG = 'Needs manual action — kill switch engaged';

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/** A row is pinned to the top iff it is a Tier-3 incident awaiting approval. */
export function isPinned(incident: Incident): boolean {
  return incident.tier === 3 && incident.approval_status === 'pending';
}

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
// Label derivation (no `title` field exists — derive from real fields only)
// ---------------------------------------------------------------------------

/**
 * Humanise one `entity_refs` entry: `"vessel:MSC-ANNA"` → `"Vessel MSC ANNA"`.
 * The type segment is title-cased; the id segment is upper-cased with `-`/`_`
 * turned into spaces. A ref with no `":"` is treated as a bare type.
 */
export function formatEntityRef(ref: string): string {
  const [rawType, ...rest] = ref.split(':');
  const type = rawType.trim();
  const id = rest.join(':').trim();
  const titleType = type
    ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
    : '';
  if (!id) return titleType || ref;
  const spacedId = id.replace(/[-_]+/g, ' ').toUpperCase();
  return titleType ? `${titleType} ${spacedId}` : spacedId;
}

/**
 * The single status phrase for an incident. Used BOTH as the feed-row status
 * line AND as the fallback tail of the row label, so a row never shows two
 * vocabularies for the same state. Plain and non-alarmist (UX-DR12).
 */
export function statusPhrase(incident: Incident): string {
  if (isPinned(incident)) return 'Needs approval';
  if (incident.blocked_by_kill_switch) return KILL_SWITCH_TAG;
  if (incident.status === 'resolved') return 'Auto-resolved';
  if (incident.status === 'open' && incident.approval_status === 'approved') {
    return 'Approved — executing';
  }
  if (incident.status === 'open' && incident.approval_status === 'rejected') {
    return 'Rejected';
  }
  return 'In progress';
}

/**
 * The feed-row label. Joins the humanised `entity_refs` with `" · "`, then
 * appends `" — "` and either the recommended option's `description` (when
 * `recommended_option_id` resolves inside `options`) or the plain status
 * phrase. Factual, derived entirely from real fields (UX-DR12) — no coined
 * severity words, no emoji.
 */
export function formatIncidentLabel(incident: Incident): string {
  const refs = incident.entity_refs.map(formatEntityRef).join(' · ');
  const recommended = incident.recommended_option_id
    ? incident.options.find(
        (o) => o.option_id === incident.recommended_option_id,
      )
    : undefined;
  const tail = recommended?.description ?? statusPhrase(incident);
  return refs ? `${refs} — ${tail}` : tail;
}

// ---------------------------------------------------------------------------
// Confidence-degradation reason (UX-DR10)
// ---------------------------------------------------------------------------

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/**
 * A one-line plain-language reason the confidence dropped, derived from the
 * trace. Precedence (mock_forced wins — see Design Notes):
 *   1. any trace entry with `detail.mock_forced === true`
 *        → "response mocked for demo stability"
 *   2. any trace entry with `error.fallback_used === true`
 *        → "using last known state"
 *   3. an explicit `CONFIDENCE`-stage `detail.reason` string, if present
 *   4. otherwise, when `confidence < 100` → "Confidence reduced from 100"
 *   5. otherwise `null`
 */
export function confidenceReason(incident: Incident): string | null {
  const trace: TraceEntry[] = incident.trace ?? [];

  if (trace.some((e) => asRecord(e.detail).mock_forced === true)) {
    return 'response mocked for demo stability';
  }

  if (trace.some((e) => e.error?.fallback_used === true)) {
    return 'using last known state';
  }

  const confidenceStage = trace.find((e) => e.stage === 'CONFIDENCE');
  const reason = confidenceStage
    ? asRecord(confidenceStage.detail).reason
    : undefined;
  if (typeof reason === 'string' && reason.trim()) return reason.trim();

  if (incident.confidence < 100) return 'Confidence reduced from 100';

  return null;
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
