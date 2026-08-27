import { useEffect, useId, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

import type { ApiError } from '../../api/client';
import './KillSwitchControl.css';

export interface KillSwitchControlProps {
  /** `true` once the kill switch is engaged (autonomous execution disabled). */
  engaged: boolean;
  /** `true` while a kill-switch POST is in flight. */
  pending: boolean;
  /** The last kill-switch failure, or `null`. */
  error: ApiError | null;
  /**
   * Called with the requested next state. On the engage path (`engaged === false`)
   * this fires ONLY after the operator activates the inline "Confirm" affordance;
   * on the disengage path a single activation calls `onChange(false)` at once.
   */
  onChange: (next: boolean) => void;
}

/**
 * KillSwitchControl — the persistent `role="switch"` dot control that lives
 * directly in the Live Console header (Story 2.8, UX-DR8 / AD-7 / AD-15).
 *
 * Never nested in a menu. Engaging is deliberate: the first activation reveals
 * an inline "Confirm" button + a plain prompt and does NOT call `onChange`;
 * activating "Confirm" calls `onChange(true)`. Activating the switch again,
 * pressing `Escape`, or moving focus out of the group cancels the pending
 * confirm. Disengaging is one step — a single activation calls `onChange(false)`.
 *
 * State is never conveyed by the dot colour alone: a visible text label always
 * says whether autonomous execution is ON or DISABLED, and that visible text IS
 * the switch's accessible name (`aria-labelledby`). `aria-checked` is driven by
 * the `engaged` prop only — a failed POST leaves it unchanged, and any external
 * `engaged` change drops a stale confirm.
 *
 * Styling-signal-free in TSX (className only); all visual values live in
 * KillSwitchControl.css via Story 2.1 tokens.
 */
export function KillSwitchControl({
  engaged,
  pending,
  error,
  onChange,
}: KillSwitchControlProps) {
  const [confirming, setConfirming] = useState(false);
  const labelId = useId();

  // Any external `engaged` change (a successful POST, a parent reset) drops a
  // stale confirm affordance.
  useEffect(() => {
    setConfirming(false);
  }, [engaged]);

  function onActivate() {
    if (pending) return;
    if (engaged) {
      onChange(false);
      return;
    }
    // Engage path: a first activation arms the confirm; a second while armed
    // cancels it.
    if (confirming) {
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && confirming) {
      setConfirming(false);
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // Only cancel when focus genuinely moved to a real node outside the group.
    // A blur with `relatedTarget === null` (mousedown in some browsers) must
    // NOT tear down the Confirm button before its click lands.
    if (
      event.relatedTarget &&
      !event.currentTarget.contains(event.relatedTarget as Node)
    ) {
      setConfirming(false);
    }
  }

  const showConfirm = !engaged && confirming;

  return (
    <div
      className="kill-switch"
      role="group"
      aria-labelledby={labelId}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <span className="kill-switch__label" id={labelId}>
        {engaged
          ? 'Autonomous execution: DISABLED'
          : 'Autonomous execution: ON'}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={engaged}
        aria-labelledby={labelId}
        disabled={pending}
        className={
          engaged
            ? 'kill-switch__dot kill-switch__dot--engaged'
            : 'kill-switch__dot'
        }
        onClick={onActivate}
      />

      {showConfirm && (
        <>
          <span className="kill-switch__prompt">
            Disable all autonomous execution?
          </span>
          <button
            type="button"
            className="kill-switch__confirm"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              onChange(true);
            }}
          >
            Confirm
          </button>
        </>
      )}

      {pending && <span className="kill-switch__status">Working…</span>}

      {error != null && (
        <span className="kill-switch__error">
          Couldn&apos;t reach the kill switch — try again.
        </span>
      )}
    </div>
  );
}

export default KillSwitchControl;
