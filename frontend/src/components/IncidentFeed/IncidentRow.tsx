import {
  confidenceReason,
  formatIncidentLabel,
  rowPresentation,
} from './incidentFeed.helpers';
import type { Incident } from '../../types/incident';

export interface IncidentRowProps {
  incident: Incident;
  /** Whether this row is the currently selected incident. */
  selected: boolean;
  /** Called with the clicked incident's `incident_id` on activation. */
  onSelect: (incidentId: string) => void;
  /**
   * Optional id of an external element describing this row (e.g. the Story 2.9
   * archive's resolution-outcome tag). Appended to the button's
   * `aria-describedby` so screen-reader users hear it without the tag text
   * being folded into the row's accessible name. Existing callers pass nothing.
   */
  describedById?: string;
}

/**
 * One feed row: a single Tab stop `<button>` that activates on Enter and Space
 * (native button behaviour). Renders a 7x7 status dot ALWAYS paired with a text
 * label (never colour alone, UX-DR11), the derived incident label, a status
 * line or kill-switch tag, an optional Tier-2 notification badge, a decorative
 * resolution progress bar for open non-pending rows, and a plain-language
 * confidence-degradation reason whenever `confidenceReason` returns one
 * (UX-DR10). The button carries an explicit `aria-label` so its accessible name
 * is "<label> — <status>" rather than a run-on of every child.
 */
export function IncidentRow({
  incident,
  selected,
  onSelect,
  describedById,
}: IncidentRowProps) {
  const {
    dotState,
    statusText,
    showNotificationBadge,
    showKillSwitchTag,
    showProgressBar,
  } = rowPresentation(incident);

  const label = formatIncidentLabel(incident);
  const reason = confidenceReason(incident);
  const reasonId = `incident-reason-${incident.incident_id}`;
  const describedBy =
    [reason ? reasonId : null, describedById ?? null]
      .filter(Boolean)
      .join(' ') || undefined;

  const className = selected
    ? 'incident-row incident-row--selected'
    : 'incident-row';

  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      aria-label={`${label} — ${statusText}`}
      aria-describedby={describedBy}
      onClick={() => onSelect(incident.incident_id)}
    >
      <span className="incident-row__top">
        <span
          className={`incident-row__dot incident-row__dot--${dotState}`}
          aria-hidden="true"
        />
        <span className="incident-row__label">{label}</span>
      </span>

      <span className="incident-row__sub">
        {showKillSwitchTag ? (
          <span className="incident-row__tag">{statusText}</span>
        ) : (
          <span className="incident-row__status">{statusText}</span>
        )}

        {showNotificationBadge && (
          <span className="incident-row__badge">Notified</span>
        )}

        {showProgressBar && (
          <span className="incident-row__progress" aria-hidden="true">
            <span className="incident-row__progress-fill" />
          </span>
        )}

        {reason && (
          <span className="incident-row__confidence" id={reasonId}>
            <span className="incident-row__confidence-value">
              {incident.confidence}%
            </span>
            <span className="incident-row__confidence-reason">{reason}</span>
          </span>
        )}
      </span>
    </button>
  );
}
