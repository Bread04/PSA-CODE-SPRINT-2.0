/**
 * Portwatch Console — shared incident helpers.
 *
 * These are pure, presentation-neutral derivations over the backend `Incident`
 * shape, used by more than one feature area (the feed in Story 2.3, the detail
 * column + approval banner in Story 2.4). They were moved here verbatim from
 * `components/IncidentFeed/incidentFeed.helpers.ts` when Story 2.4 needed them
 * outside the feed; that module now re-exports them so Story 2.3's imports and
 * tests are unaffected.
 *
 * Every function is a pure function of its arguments: given the same incident
 * it returns the same result, and it never mutates its input.
 */

import type { Incident, TraceEntry } from '../types/incident';

/** Tag / heading text for a Tier 1/2 incident whose auto-execution the kill switch blocked. */
export const KILL_SWITCH_TAG = 'Needs manual action — kill switch engaged';

/** A row is "pinned" (needs a human) iff it is a Tier-3 incident awaiting approval. */
export function isPinned(incident: Incident): boolean {
  return incident.tier === 3 && incident.approval_status === 'pending';
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
 * The single status phrase for an incident. Used BOTH as a status line AND as
 * the fallback tail of the feed-row label, so a row never shows two
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
// Resolution outcome (Story 2.9 — Incident Archive tag)
// ---------------------------------------------------------------------------

/**
 * The archive's resolution-outcome tag text for a resolved incident.
 *
 * Returns `null` for any incident that is not `status === 'resolved'` (the
 * archive only ever renders resolved rows, but callers guard anyway). For a
 * resolved incident: `'Approved'` when the operator approved the
 * recommendation, `'Rejected'` when the operator rejected it, `'Auto-resolved'`
 * when it resolved with no approval gate (`approval_status === 'n/a'`), and
 * `null` for any other `approval_status` (e.g. a still-`'pending'` value on a
 * resolved record) — no tag is safer than a wrong one.
 *
 * Kept separate from {@link statusPhrase} on purpose: that helper is overloaded
 * (pinned / kill-switch / open states) and sentence-style; this is a tight
 * enum used only for the archive tag.
 */
export function resolutionOutcome(
  incident: Incident,
): 'Auto-resolved' | 'Approved' | 'Rejected' | null {
  if (incident.status !== 'resolved') return null;
  if (incident.approval_status === 'approved') return 'Approved';
  if (incident.approval_status === 'rejected') return 'Rejected';
  if (incident.approval_status === 'n/a') return 'Auto-resolved';
  return null;
}

// ---------------------------------------------------------------------------
// Confidence-degradation reason (UX-DR10)
// ---------------------------------------------------------------------------

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/**
 * A one-line plain-language reason the confidence dropped, derived from the
 * trace. Precedence (mock_forced wins — see Story 2.3 Design Notes):
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
