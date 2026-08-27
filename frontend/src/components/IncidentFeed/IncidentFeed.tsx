import { useEffect, useState } from 'react';

import { BlueprintPanel } from '../BlueprintPanel';
import { IncidentRow } from './IncidentRow';
import {
  formatAge,
  secondsAgo,
  sortIncidents,
} from './incidentFeed.helpers';
import type { ApiError } from '../../api/client';
import type { Incident } from '../../types/incident';

import './IncidentFeed.css';

export interface IncidentFeedProps {
  incidents: Incident[];
  /** Currently selected incident id, or `null`. */
  selectedId: string | null;
  /** Called with the clicked incident's `incident_id`. */
  onSelect: (incidentId: string) => void;
  /** `Date.now()` of the last successful poll, or `null`. */
  lastUpdatedAt: number | null;
  /** Whether polling has gone stale (drives the "Last updated Xs ago" line). */
  isStale: boolean;
  /** The latest poll error, if any — distinguishes cold-start unreachable from an empty port. */
  error?: ApiError | null;
}

const TITLE_ID = 'incident-feed-title';

/**
 * The incident feed: a reverse-chronological list of rows inside one
 * BlueprintPanel, Tier-3-pending rows pinned to the top. When polling is stale
 * a small non-blocking "Last updated Xs ago" line appears above the rows — the
 * last-known rows are never hidden behind an error screen (UX-DR10). An empty
 * list renders a plain line: "No incidents" normally, or a retry notice when
 * the service has never been reached.
 */
export function IncidentFeed({
  incidents,
  selectedId,
  onSelect,
  lastUpdatedAt,
  isStale,
  error = null,
}: IncidentFeedProps) {
  // Local 1s tick so the "Xs ago" text keeps advancing while stale, even if the
  // parent does not re-render. The interval owns every update (no synchronous
  // setState in the effect body); the first tick lands ~1s after staleness.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isStale) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isStale]);

  const sorted = sortIncidents(incidents);
  const showStale = isStale && lastUpdatedAt !== null;
  const unreachableColdStart =
    error != null && incidents.length === 0 && lastUpdatedAt === null;

  return (
    <BlueprintPanel
      as="section"
      className="incident-feed"
      aria-labelledby={TITLE_ID}
    >
      <h2 className="incident-feed__title" id={TITLE_ID}>
        Incidents
      </h2>

      {showStale && (
        <div className="incident-feed__stale" role="status">
          Last updated {formatAge(secondsAgo(lastUpdatedAt, now))} ago
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="incident-feed__empty">
          {unreachableColdStart
            ? "Can't reach the incident service — retrying."
            : 'No incidents'}
        </div>
      ) : (
        <ul className="incident-feed__list">
          {sorted.map((incident) => (
            <li className="incident-feed__item" key={incident.incident_id}>
              <IncidentRow
                incident={incident}
                selected={incident.incident_id === selectedId}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </BlueprintPanel>
  );
}
