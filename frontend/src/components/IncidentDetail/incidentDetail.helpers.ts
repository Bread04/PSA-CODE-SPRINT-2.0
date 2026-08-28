/**
 * Portwatch Console — IncidentDetail / ApprovalBanner pure helpers (Story 2.4).
 *
 * All derivations over the live `Incident` shape (never over an APPROVAL-trace
 * `detail.card`, whose `alternatives` is a list of plain strings and loses the
 * `option_id` that `select_alternative` needs). Every function is pure and
 * never mutates its input.
 */

import type {
  Incident,
  PredictedImpact,
  RecoveryOption,
  TraceEntry,
} from '../../types/incident';

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/**
 * The reason strings for every option the DG/IMDG gate rejected during
 * re-planning, in trace order. Source: `trace` entries with
 * `stage === 'DG_CHECK'` and `detail.violation === true`; the string is
 * `detail.reason` (it names the offending `option_id`, e.g.
 * `"DG/IMDG segregation violation: option 'opt-2' affects dangerous goods …"`).
 * Rejected options are generally NOT in the final `incident.options` — this
 * trace entry is their only durable record, and the banner renders these
 * struck through rather than hiding them. Returns `[]` when there are none.
 */
export function dgRejectedReasons(incident: Incident): string[] {
  const trace: TraceEntry[] = incident.trace ?? [];
  return trace
    .filter(
      (e) => e.stage === 'DG_CHECK' && asRecord(e.detail).violation === true,
    )
    .map((e) => asRecord(e.detail).reason)
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((r) => r.trim());
}

export interface BannerModel {
  /** `entity_refs` joined with ", ", or `incident_id` when there are none — mirrors the backend `_build_card`. */
  situation: string;
  /** The recommended option's `description`, or `null` if it does not resolve in `options`. */
  recommendation: string | null;
  /** The recommended option's `predicted_impact`, or `null`. */
  impact: PredictedImpact | null;
  /** Every `options` entry except the recommended one, in list (ranked) order. */
  alternatives: RecoveryOption[];
}

/**
 * The content the ApprovalBanner / IncidentSummary render, derived from the
 * live incident. `recommendation` / `impact` are `null` (row omitted) when
 * `recommended_option_id` does not resolve inside `options`.
 */
export function bannerModel(incident: Incident): BannerModel {
  const situation =
    incident.entity_refs && incident.entity_refs.length > 0
      ? incident.entity_refs.join(', ')
      : incident.incident_id;

  const recommended = incident.recommended_option_id
    ? incident.options.find(
        (o) => o.option_id === incident.recommended_option_id,
      )
    : undefined;

  const alternatives = incident.options.filter(
    (o) => o.option_id !== incident.recommended_option_id,
  );

  return {
    situation,
    recommendation: recommended?.description ?? null,
    impact: recommended?.predicted_impact ?? null,
    alternatives,
  };
}

const asNumericFraction = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;

/**
 * Spec 3.2 (FR17) — the two-block yard load string for the selected incident,
 * or `null` when there is no utilization payload.
 *
 * Source: the LAST `trace` entry with `stage === 'CORRELATE'`, reading
 * `detail.payload.yard_utilization`. When it carries numeric `tuas_c7` and
 * `pasir_panjang_p2` fractions, returns
 * `"Tuas C7 93% · Pasir Panjang P2 44%"` (rounded ints); otherwise `null`.
 * Pure and defensive — a malformed payload yields `null`, never a throw.
 */
export function yardBlockUtilization(incident: Incident): string | null {
  const trace: TraceEntry[] = incident.trace ?? [];
  let correlate: TraceEntry | undefined;
  for (const entry of trace) {
    if (entry.stage === 'CORRELATE') correlate = entry;
  }
  if (!correlate) return null;

  const util = asRecord(asRecord(asRecord(correlate.detail).payload).yard_utilization);
  const tuas = asNumericFraction(util.tuas_c7);
  const pasir = asNumericFraction(util.pasir_panjang_p2);
  if (tuas == null || pasir == null) return null;

  return `Tuas C7 ${Math.round(tuas * 100)}% · Pasir Panjang P2 ${Math.round(pasir * 100)}%`;
}

/**
 * One-line plain-language rendering of a `PredictedImpact` — delay, cost band,
 * yard effect, risk band. Factual, non-alarmist (UX-DR12).
 */
export function formatPredictedImpact(impact: PredictedImpact): string {
  const delay = `${impact.delay_min >= 0 ? '+' : ''}${impact.delay_min} min delay`;
  return `${delay} · cost ${impact.cost} · ${impact.yard_impact} · risk ${impact.risk}`;
}
