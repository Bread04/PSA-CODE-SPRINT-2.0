import { ApprovalBanner } from './ApprovalBanner';
import { IncidentSummary } from './IncidentSummary';
import { formatIncidentLabel } from '../../lib/incident';
import type { ApiError, ApprovalAction } from '../../api/client';
import type { Incident } from '../../types/incident';

import './IncidentDetail.css';

export interface IncidentDetailProps {
  /** The selected incident, or `null` when nothing is selected. */
  incident: Incident | null;
  /** Forwarded to the ApprovalBanner — `true` while an approval POST is in flight. */
  submitting: boolean;
  /** Forwarded to the ApprovalBanner — the last submit failure, or `null`. */
  error: ApiError | null;
  /** Called with the exact AD-11 payload when an approval control is activated. */
  onApprovalAction: (body: ApprovalAction) => void;
}

/** Plain meta line derived from real fields — the tier is shown as-is (never forced to 3). */
function metaLine(incident: Incident): string {
  const tier =
    incident.tier != null ? `Tier ${incident.tier}` : 'Tier not yet classified';
  const n = incident.entity_refs.length;
  const signals = `${n} correlated signal${n === 1 ? '' : 's'}`;
  return `${tier} · ${signals}`;
}

/**
 * The center detail column, driven by the selected incident.
 *
 *  - `incident == null` → a plain "Select an incident from the feed." line
 *    (not an error, not blank).
 *  - otherwise an `<h2>` label + a plain meta line, then:
 *      - if `(tier === 3 && approval_status === 'pending')` OR
 *        `blocked_by_kill_switch` → the pinned `<ApprovalBanner>` (keyed by
 *        `incident_id` so switching incidents remounts + re-announces);
 *      - else a read-only `<IncidentSummary>` with no action controls.
 */
export function IncidentDetail({
  incident,
  submitting,
  error,
  onApprovalAction,
}: IncidentDetailProps) {
  if (incident == null) {
    return (
      <p className="incident-detail__placeholder">
        Select an incident from the feed.
      </p>
    );
  }

  const actionable =
    (incident.tier === 3 && incident.approval_status === 'pending') ||
    incident.blocked_by_kill_switch;

  return (
    <div className="incident-detail">
      <h2 className="incident-detail__title">{formatIncidentLabel(incident)}</h2>
      <p className="incident-detail__meta">{metaLine(incident)}</p>

      {actionable ? (
        <ApprovalBanner
          key={incident.incident_id}
          incident={incident}
          submitting={submitting}
          error={error}
          onAction={onApprovalAction}
        />
      ) : (
        <IncidentSummary incident={incident} />
      )}
    </div>
  );
}
