import { confidenceReason, statusPhrase } from '../../lib/incident';
import { bannerModel, formatPredictedImpact } from './incidentDetail.helpers';
import type { Incident } from '../../types/incident';

export interface IncidentSummaryProps {
  incident: Incident;
}

/**
 * Read-only detail for a selected incident that is NOT actionable (not
 * Tier-3-pending and not kill-switch-blocked). Shows situation, plus
 * recommendation & predicted impact when `options` exist, else a plain status
 * line — and the confidence with its degradation reason when applicable. No
 * Approve / Reject / alternative controls.
 */
export function IncidentSummary({ incident }: IncidentSummaryProps) {
  const model = bannerModel(incident);
  const reason = confidenceReason(incident);
  const hasOptions = incident.options.length > 0;

  return (
    <div className="incident-summary">
      <div className="approval-row">
        <span className="approval-banner__label">Situation</span>
        <span>{model.situation}</span>
      </div>

      {hasOptions && model.recommendation != null && (
        <div className="approval-row">
          <span className="approval-banner__label">Recommendation</span>
          <span>{model.recommendation}</span>
        </div>
      )}

      {hasOptions && model.impact != null && (
        <div className="approval-row">
          <span className="approval-banner__label">Predicted impact</span>
          <span>{formatPredictedImpact(model.impact)}</span>
        </div>
      )}

      {!hasOptions && (
        <p className="incident-summary__status">{statusPhrase(incident)}</p>
      )}

      <div className="approval-row">
        <span className="approval-banner__label">Confidence</span>
        <span>
          <span className="approval-banner__confidence">
            {incident.confidence}%
          </span>
          {reason != null && (
            <span className="approval-banner__confidence-reason">{reason}</span>
          )}
        </span>
      </div>
    </div>
  );
}
