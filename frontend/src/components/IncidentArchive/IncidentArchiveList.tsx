import { useId } from 'react';

import { BlueprintPanel } from '../BlueprintPanel';
import { IncidentRow } from '../IncidentFeed';
import { resolutionOutcome } from '../../lib/incident';
import type { Incident } from '../../types/incident';

import './IncidentArchive.css';

export interface IncidentArchiveListProps {
  incidents: Incident[];
  /** Currently selected archived incident id, or `null`. */
  selectedId: string | null;
  /** Called with the clicked incident's `incident_id`. */
  onSelect: (incidentId: string) => void;
}

/**
 * The session-scoped Incident Archive list (Story 2.9).
 *
 * Filters the SAME `GET /incidents` data client-side to `status === 'resolved'`
 * — no new endpoint — and lists each resolved incident inside one
 * {@link BlueprintPanel} using the reused Story 2.3 {@link IncidentRow}. A
 * resolution-outcome tag (Auto-resolved / Approved / Rejected) sits as a
 * sibling of the row button and is wired to it via `aria-describedby` so the
 * row's accessible name is unchanged but SR users still hear the outcome. Rows
 * are ordered most-recently-resolved first (`last_signal_at` desc, `created_at`
 * fallback, lexicographic ISO compare). An empty archive shows one plain line.
 */
export function IncidentArchiveList({
  incidents,
  selectedId,
  onSelect,
}: IncidentArchiveListProps) {
  const headingId = useId();

  const resolved = incidents
    .filter((incident) => incident.status === 'resolved')
    .slice()
    .sort((a, b) => {
      const ak = a.last_signal_at || a.created_at || '';
      const bk = b.last_signal_at || b.created_at || '';
      if (ak === bk) return 0;
      return ak < bk ? 1 : -1;
    });

  return (
    <BlueprintPanel
      as="section"
      className="incident-archive__panel"
      aria-labelledby={headingId}
    >
      <h2 className="incident-archive__title" id={headingId}>
        Incident Archive
      </h2>

      {resolved.length === 0 ? (
        <p className="incident-archive__empty">
          No resolved incidents yet this session.
        </p>
      ) : (
        <ul className="incident-archive__list">
          {resolved.map((incident) => {
            const outcomeId = `incident-archive-outcome-${incident.incident_id}`;
            return (
              <li className="incident-archive__item" key={incident.incident_id}>
                <IncidentRow
                  incident={incident}
                  selected={incident.incident_id === selectedId}
                  onSelect={onSelect}
                  describedById={outcomeId}
                />
                <span className="incident-archive__outcome" id={outcomeId}>
                  {resolutionOutcome(incident)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </BlueprintPanel>
  );
}
