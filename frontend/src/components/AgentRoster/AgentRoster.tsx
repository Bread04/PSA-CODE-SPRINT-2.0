import { useId, useMemo } from 'react';

import type { Incident } from '../../types/incident';
import { BlueprintPanel } from '../BlueprintPanel';
import {
  deriveRoster,
  type AgentChipView,
  type AgentRunState,
} from '../../lib/agentRoster';
import './AgentRoster.css';

export interface AgentRosterProps {
  /** The currently selected incident, or `null` when nothing is selected. */
  incident: Incident | null;
  /** Optional extra class merged onto the panel root. */
  className?: string;
}

/** Run-state token surfaced to the operator + assistive tech (never colour-only). */
const STATE_LABEL: Record<AgentRunState, string> = {
  complete: 'COMPLETE',
  timeout: 'TIMEOUT',
  fallback: 'FALLBACK',
};

const AGENT_LABEL: Record<AgentChipView['agent'], string> = {
  berth: 'Berth / Vessel',
  crane: 'Crane',
  yard: 'Yard',
};

/**
 * AgentRoster — the read-only "Orchestra" view (Harbor Signal, AD-18 / AD-19).
 *
 * The `AGENT_CALL` stage collapsed into the StageRail; this panel is the
 * per-specialist fan-out that row cannot show. It renders one chip per agent in
 * the frozen berth → crane → yard order, side by side, from
 * `incident.agents` + the incident's `AGENT_CALL` trace (`deriveRoster`).
 *
 * Each chip shows the agent name, its run state as a `.agent-roster__chip--{state}`
 * class AND a text token (`COMPLETE` / `TIMEOUT` / `FALLBACK`) — never colour
 * alone (EXPERIENCE.md Accessibility Floor) — plus the agent's plain-English
 * `summary`, with its `actions` / `constraints` behind a native disclosure.
 *
 * This is NOT a decision surface: no approval action, no positive tabindex, no
 * click / hover handlers. With no incident, or an empty specialist bundle, it
 * renders nothing.
 */
export function AgentRoster({ incident, className }: AgentRosterProps) {
  const headingId = useId();
  const chips = useMemo(() => deriveRoster(incident), [incident]);

  if (chips.length === 0) return null;

  const rootClassName = ['agent-roster', className?.trim()]
    .filter(Boolean)
    .join(' ');

  return (
    <BlueprintPanel
      as="section"
      className={rootClassName}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="agent-roster__heading">
        Agent Roster
      </h3>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ol className="agent-roster__list" role="list">
        {chips.map((chip) => (
          <li
            key={chip.agent}
            className={`agent-roster__chip agent-roster__chip--${chip.state}`}
          >
            <div className="agent-roster__chip-head">
              <span className="agent-roster__agent">{AGENT_LABEL[chip.agent]}</span>
              <span
                className={`agent-roster__state agent-roster__state--${chip.state}`}
              >
                {STATE_LABEL[chip.state]}
              </span>
            </div>
            <p className="agent-roster__summary">{chip.summary}</p>
            {(chip.actions.length > 0 ||
              chip.constraints.length > 0 ||
              chip.rationale) && (
              <details className="agent-roster__detail">
                <summary className="agent-roster__detail-toggle">
                  Recommendation &amp; constraints
                </summary>
                {chip.actions.length > 0 && (
                  <>
                    <p className="agent-roster__detail-label">Actions</p>
                    <ul className="agent-roster__detail-list">
                      {chip.actions.map((action, i) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </>
                )}
                {chip.constraints.length > 0 && (
                  <>
                    <p className="agent-roster__detail-label">Constraints</p>
                    <ul className="agent-roster__detail-list">
                      {chip.constraints.map((constraint, i) => (
                        <li key={i}>{constraint}</li>
                      ))}
                    </ul>
                  </>
                )}
                {chip.rationale && (
                  <>
                    <p className="agent-roster__detail-label">Rationale</p>
                    <p className="agent-roster__rationale">{chip.rationale}</p>
                  </>
                )}
              </details>
            )}
          </li>
        ))}
      </ol>
    </BlueprintPanel>
  );
}
