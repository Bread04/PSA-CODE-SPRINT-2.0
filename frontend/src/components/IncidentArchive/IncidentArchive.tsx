import { useState } from 'react';

import { ExecutionTrace } from '../ExecutionTrace';
import { IncidentArchiveList } from './IncidentArchiveList';
import { formatIncidentLabel, resolutionOutcome } from '../../lib/incident';
import type { Incident } from '../../types/incident';

import './IncidentArchive.css';

export interface IncidentArchiveProps {
  incidents: Incident[];
}

/**
 * The Incident Archive view (Story 2.9, UX-DR9).
 *
 * Session-scoped, client-side filter of the live incident list to resolved
 * incidents. The left column is the {@link IncidentArchiveList}; the detail
 * column shows the selected incident's trace READ-ONLY via the reused Story 2.5
 * {@link ExecutionTrace}. It NEVER mounts `ApprovalBanner`, `IncidentDetail`,
 * or any Approve / Reject / Modify control — the archived trace cannot be acted
 * on. Selection state is local and not persisted.
 */
export function IncidentArchive({ incidents }: IncidentArchiveProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected =
    incidents.find(
      (incident) =>
        incident.incident_id === selectedId && incident.status === 'resolved',
    ) ?? null;

  return (
    <div className="incident-archive">
      <div className="incident-archive__list-col">
        <IncidentArchiveList
          incidents={incidents}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <section className="incident-archive__detail-col" aria-label="Archived incident detail">
        {selected ? (
          <>
            <h2 className="incident-archive__detail-heading">
              {formatIncidentLabel(selected)}
              <span className="incident-archive__detail-outcome">
                {resolutionOutcome(selected)}
              </span>
            </h2>
            <ExecutionTrace trace={selected.trace ?? []} />
          </>
        ) : (
          <p className="incident-archive__prompt">
            Select a resolved incident to view its trace.
          </p>
        )}
      </section>
    </div>
  );
}

export default IncidentArchive;
