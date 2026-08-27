import './KillSwitchControl.css';

export interface KillSwitchBannerProps {
  /** `true` when the global kill switch is engaged. */
  engaged: boolean;
}

/**
 * KillSwitchBanner — the persistent, full-bleed global banner shown whenever
 * the kill switch is engaged (Story 2.8). Renders nothing when `!engaged`.
 *
 * `role="status"` (not `alert`) — it is a persistent condition, not an
 * interruption (UX-DR12). No dismiss control, no timeout, no sound.
 */
export function KillSwitchBanner({ engaged }: KillSwitchBannerProps) {
  if (!engaged) return null;
  return (
    <div role="status" className="kill-switch-banner">
      Autonomous execution disabled
    </div>
  );
}

export default KillSwitchBanner;
