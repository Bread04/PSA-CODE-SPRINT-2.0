import { useEffect, useState } from 'react';

import { BlueprintPanel } from '../BlueprintPanel';
import { confidenceReason, KILL_SWITCH_TAG } from '../../lib/incident';
import {
  bannerModel,
  dgRejectedReasons,
  formatPredictedImpact,
} from './incidentDetail.helpers';
import type { ApiError, ApprovalAction } from '../../api/client';
import type { Incident } from '../../types/incident';

export interface ApprovalBannerProps {
  /** The incident this banner acts on — Tier-3-pending or `blocked_by_kill_switch`. */
  incident: Incident;
  /** `true` while an approval POST is in flight — disables every action control. */
  submitting: boolean;
  /** The last submit failure, or `null`; renders an inline plain retry line. */
  error: ApiError | null;
  /** Called with the exact AD-11 payload for the activated control. */
  onAction: (body: ApprovalAction) => void;
}

/**
 * The approval card. Rendered inside one reused `BlueprintPanel`, pinned at the
 * top of `IncidentDetail` when the incident is Tier-3-pending OR
 * `blocked_by_kill_switch`. It shows situation / recommendation / predicted
 * impact / confidence (+ its degradation reason), any DG-gate-rejected options
 * struck through with their reason (NOT hidden), the ranked alternatives, and
 * Approve / Reject / "use this option" controls.
 *
 * First-appearance announce: mounts with `aria-live="assertive"`, then flips to
 * `"off"` after the first paint (a `setTimeout(0)` in an effect). The parent
 * gives this component `key={incident.incident_id}`, so switching to another
 * incident's banner remounts and re-announces; a same-incident poll update does
 * not. There is NO timer here — no auto-dismiss, no countdown, no default
 * action; the banner stays mounted as long as the incident is actionable.
 *
 * A `blocked_by_kill_switch` incident (any tier — the tier is NOT changed to 3)
 * gets the blocked heading and Approve only: no Reject, no alternatives
 * ("resolved via the same existing Approve action").
 */
export function ApprovalBanner({
  incident,
  submitting,
  error,
  onAction,
}: ApprovalBannerProps) {
  const [live, setLive] = useState<'assertive' | 'off'>('assertive');
  useEffect(() => {
    const t = setTimeout(() => setLive('off'), 0);
    return () => clearTimeout(t);
  }, []);

  const blocked = incident.blocked_by_kill_switch;
  const heading = blocked ? KILL_SWITCH_TAG : 'Approval needed';
  const model = bannerModel(incident);
  const rejected = dgRejectedReasons(incident);
  const reason = confidenceReason(incident);

  return (
    <BlueprintPanel
      as="section"
      className="approval-banner"
      aria-label={heading}
      aria-live={live}
    >
      <h3 className="approval-banner__heading">
        <span className="approval-banner__dot" aria-hidden="true" />
        {heading}
      </h3>

      <div className="approval-row">
        <span className="approval-banner__label">Situation</span>
        <span>{model.situation}</span>
      </div>

      {model.recommendation != null && (
        <div className="approval-row">
          <span className="approval-banner__label">Recommendation</span>
          <span>{model.recommendation}</span>
        </div>
      )}

      {rejected.length > 0 && (
        <div className="approval-banner__rejected">
          <span className="approval-banner__label">Considered, rejected</span>
          <span>
            {rejected.map((r, i) => (
              <span key={i} className="approval-banner__struck">
                {r}
              </span>
            ))}
          </span>
        </div>
      )}

      {model.impact != null && (
        <div className="approval-row">
          <span className="approval-banner__label">Predicted impact</span>
          <span>{formatPredictedImpact(model.impact)}</span>
        </div>
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

      {!blocked && model.alternatives.length > 0 && (
        <div className="approval-banner__alternatives">
          <span className="approval-banner__alt-label">Other options</span>
          {model.alternatives.map((opt) => (
            <button
              key={opt.option_id}
              type="button"
              className="approval-banner__alt"
              disabled={submitting}
              onClick={() =>
                onAction({
                  action: 'select_alternative',
                  option_id: opt.option_id,
                })
              }
            >
              {opt.description}
            </button>
          ))}
        </div>
      )}

      <div className="approval-banner__actions">
        <button
          type="button"
          className="approval-banner__btn approval-banner__btn--primary"
          disabled={submitting}
          onClick={() => onAction({ action: 'approve' })}
        >
          Approve
        </button>
        {!blocked && (
          <button
            type="button"
            className="approval-banner__btn approval-banner__btn--secondary"
            disabled={submitting}
            onClick={() => onAction({ action: 'reject' })}
          >
            Reject
          </button>
        )}
      </div>

      {error != null && (
        <p className="approval-banner__error" role="status">
          That action didn’t go through — try again.
        </p>
      )}
    </BlueprintPanel>
  );
}
