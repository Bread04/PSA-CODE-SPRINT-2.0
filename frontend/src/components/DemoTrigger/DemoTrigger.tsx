import type { ApiError } from '../../api/client';
import './DemoTrigger.css';

export interface DemoTriggerProps {
  /** `true` while the ~30s post-trigger run window is open. */
  running: boolean;
  /** `true` while the trigger POST is in flight. */
  pending: boolean;
  /** The last trigger failure, or `null`. */
  error: ApiError | null;
  /** Fire the demo trigger. */
  onTrigger: () => void;
}

/**
 * DemoTrigger — the dev-only "Run demo" button in the Live Console topbar
 * (spec-demo-three-way-disruption-trigger).
 *
 * Renders NOTHING in a production build (`import.meta.env.DEV` is false). One
 * `<button type="button">` — "Run demo", or "Demo running…" while the run window
 * is open — disabled while `pending || running`, with an inline retry line on
 * `error`. Styling-signal-free in TSX (className only); all visual values live
 * in DemoTrigger.css via Story 2.1 tokens.
 */
export function DemoTrigger({ running, pending, error, onTrigger }: DemoTriggerProps) {
  if (!import.meta.env.DEV) return null;

  return (
    <div className="demo-trigger">
      <button
        type="button"
        className="demo-trigger__button"
        disabled={pending || running}
        onClick={onTrigger}
      >
        {running ? 'Demo running…' : 'Run demo'}
      </button>

      {error != null && (
        <span className="demo-trigger__error" role="alert">
          Couldn&apos;t start the demo — try again.
        </span>
      )}
    </div>
  );
}
