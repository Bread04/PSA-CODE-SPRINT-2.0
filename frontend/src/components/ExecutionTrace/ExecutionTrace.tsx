import { useId } from 'react';

import type { TraceEntry } from '../../types/incident';
import { BlueprintPanel } from '../BlueprintPanel';
import { PanelHeader } from '../PortwatchPrimitives';
import './ExecutionTrace.css';

export interface ExecutionTraceProps {
  trace: TraceEntry[];
}

/**
 * Execution Trace — the read-only, operator-facing audit log of an incident's
 * pipeline stages (Story 2.5).
 *
 * Contract (DESIGN.md `components.execution-trace` + EXPERIENCE.md trace):
 *   - a single `role="log"` region, `aria-live="polite"`, `aria-relevant="additions"`
 *   - entries rendered newest-at-top (reverse-chronological by `timestamp`)
 *   - each stage on its own row; 1px `--divider` separators
 *   - a `--accent-900` square dot marks a stage that errored / retried / fell back
 *   - error / retry / fallback are NEVER colour-only (UX-DR11): a textual
 *     `ERROR` / `RETRY` / `FALLBACK` flag always accompanies the dot
 *
 * The component is intentionally styling-signal-free in TSX (className only,
 * no inline style / var() / px / hex) so it is exempt from the token-consumer
 * lint; all visual values live in ExecutionTrace.css and route through tokens.
 */
export function ExecutionTrace({ trace }: ExecutionTraceProps) {
  const headingId = useId();
  const rows = [...trace].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <BlueprintPanel
      as="section"
      className="execution-trace"
      aria-labelledby={headingId}
    >
      <PanelHeader
        eyebrow="Audit Log"
        title="Execution Trace"
        level={3}
        titleId={headingId}
        titleClassName="execution-trace__heading"
      />
      <div
        className="execution-trace__log"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {rows.length === 0 ? (
          <p className="execution-trace__empty">No trace entries yet.</p>
        ) : (
          rows.map((entry, idx) => {
            const marker = isMarkerRow(entry);
            const label = markerLabel(entry);
            const msg = describeDetail(entry);
            const mocked = asBool(entry.detail, 'mock_forced');
            const ariaLabel = [entry.stage, label, msg ? `: ${msg}` : '']
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={`${entry.stage}-${entry.timestamp}-${idx}`}
                className={
                  'execution-trace__row' + (marker ? ' execution-trace__row--error' : '')
                }
                // Each trace row is a focus stop by design (Story 2.5): an
                // operator tabs through the log to review each stage, and every
                // row carries its own `aria-label`. A deliberate reading-order
                // affordance, not an interactive control.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                aria-label={ariaLabel}
              >
                <span className="execution-trace__time">{formatClock(entry.timestamp)}</span>
                {marker && <span className="execution-trace__dot" aria-hidden="true" />}
                <span className="execution-trace__stage">{entry.stage}</span>
                {label && <span className="execution-trace__flag">{label}</span>}
                {msg && <span className="execution-trace__msg">{msg}</span>}
                {mocked && (
                  <span className="execution-trace__mock">response mocked for demo stability</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </BlueprintPanel>
  );
}


function asBool(detail: Record<string, unknown>, key: string): boolean {
  return detail[key] === true;
}

/**
 * Best-effort human-readable description for a trace entry.
 * Priority: explicit mock annotation → structured error message → first
 * non-empty string detail field (reason / message / note).
 */
function describeDetail(entry: TraceEntry): string {
  if (entry.error) return entry.error.error;
  const fallback = entry.detail.reason ?? entry.detail.message ?? entry.detail.note;
  if (typeof fallback === 'string' && fallback.length > 0) return fallback;
  return '';
}

/** A row is a "marker" row when it carried an error, a retry, or a fallback. */
function isMarkerRow(entry: TraceEntry): boolean {
  if (entry.error) return true;
  return asBool(entry.detail, 'retried') || asBool(entry.detail, 'fallback_used');
}

/** Textual flag for a marker row. Never colour-only (UX-DR11). */
function markerLabel(entry: TraceEntry): string {
  if (entry.error) {
    if (entry.error.fallback_used) return 'FALLBACK';
    if (entry.error.retried) return 'RETRY';
    return 'ERROR';
  }
  if (asBool(entry.detail, 'fallback_used')) return 'FALLBACK';
  if (asBool(entry.detail, 'retried')) return 'RETRY';
  return '';
}

/** UTC HH:MM:SS clock label; falls back to the raw value if unparseable. */
function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(11, 19);
}
