import { useId, useMemo } from 'react';

import type { Incident } from '../../types/incident';
import { BlueprintPanel } from '../BlueprintPanel';
import { deriveRail, type RailState, type RailStageView } from '../../lib/stageRail';
import './StageRail.css';

export interface StageRailProps {
  /** The currently selected incident, or `null` when nothing is selected. */
  incident: Incident | null;
  /** Optional extra class merged onto the panel root. */
  className?: string;
}

/** State word surfaced to the operator + assistive tech (never colour-only). */
const STATE_WORD: Record<RailState, string> = {
  done: 'done',
  active: 'current',
  error: 'attention',
  pending: 'pending',
  complete: 'complete',
};

/**
 * Single source for a stage's state text — the visible span and the `<li>`
 * accessible name both derive from here, so the state word + flag are never
 * written twice. Punctuation differs (middot vs parens); the meaning does not.
 */
function formatStageState(view: RailStageView): {
  visible: string;
  accessible: string;
} {
  const word = STATE_WORD[view.state];
  return {
    visible: view.flag ? `${word} · ${view.flag}` : word,
    accessible: view.flag ? `${word} (${view.flag})` : word,
  };
}

/**
 * StageRail — a compact, read-only, at-a-glance projection of where the
 * selected incident sits in the AI pipeline (Story 4.2 / UX-DR13).
 *
 * It renders the fixed `RAIL_STAGES` list inside the shared `BlueprintPanel`.
 * Each stage's state is carried by BOTH shape (a per-state marker glyph, see
 * StageRail.css) AND text (`done` / `current` / `attention` / `pending` /
 * `complete`, plus a textual `ERROR` / `RETRY` / `FALLBACK` flag) — never
 * colour alone (UX-DR11). Each `<li>` also exposes its label and state as its
 * accessible name, and the active stage carries `aria-current="step"`.
 *
 * State is derived ONLY from `incident.trace` (`deriveRail`). With no incident
 * the rail renders every stage `pending` — degraded-safe, no error state.
 *
 * This is NOT a decision surface: it adds no `button`, no positive `tabindex`,
 * and no click / hover handlers. `ExecutionTrace` remains the authoritative,
 * detailed log and is untouched.
 */
export function StageRail({ incident, className }: StageRailProps) {
  const headingId = useId();
  const stages = useMemo(() => deriveRail(incident?.trace), [incident?.trace]);

  const rootClassName = ['stage-rail', className?.trim()].filter(Boolean).join(' ');

  return (
    <BlueprintPanel as="section" className={rootClassName} aria-labelledby={headingId}>
      <h3 id={headingId} className="stage-rail__heading">
        Pipeline
      </h3>
      {/*
        `list-style: none` (StageRail.css) makes WebKit/VoiceOver drop the list
        semantics; the explicit role restores the "list, 10 items" announcement
        the rail depends on. A deliberate a11y affordance, not redundancy.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ol className="stage-rail__list" role="list">
        {stages.map((view) => {
          const { visible, accessible } = formatStageState(view);
          return (
            <li
              key={view.id}
              className={`stage-rail__item stage-rail__item--${view.state}`}
              aria-label={`${view.label}: ${accessible}`}
              aria-current={view.state === 'active' ? 'step' : undefined}
            >
              <span className="stage-rail__marker" aria-hidden="true" />
              <span className="stage-rail__label">{view.label}</span>
              <span className="stage-rail__state">{visible}</span>
            </li>
          );
        })}
      </ol>
    </BlueprintPanel>
  );
}
