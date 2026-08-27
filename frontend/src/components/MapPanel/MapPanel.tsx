import { useId } from 'react';

import { BlueprintPanel } from '../BlueprintPanel';
import './MapPanel.css';

export interface MapPanelProps {
  /** Which fixed illustrative scene to draw. Defaults to `'strait'`. */
  variant?: 'strait' | 'yard';
  /** Optional extra class merged onto the BlueprintPanel root. */
  className?: string;
}

/**
 * MapPanel — a read-only, illustrative strait / yard schematic (Story 2.7).
 *
 * Contract (DESIGN.md map panels + EXPERIENCE.md read-only view + UX-DR7):
 *   - rendered inside the shared `BlueprintPanel` primitive (Story 2.2)
 *   - a hand-authored inline `<svg>` of primitive shapes only — no icon library,
 *     no image asset, no external ref, no `<script>`, no event handlers
 *   - a single `role="img"` node: screen readers announce the `aria-label`, not
 *     the individual decorative shapes; the caption disclaimer is wired to the
 *     svg via `aria-describedby`
 *   - the panel `region` is named by its own `<h3>` (via `aria-labelledby`,
 *     mirroring how `IncidentFeed` labels its region)
 *   - fully non-interactive: no pan / zoom / drag / click / hover / tooltip
 *   - a visible caption that states, verbatim, that the view is *illustrative*
 *     and *not live AIS* data — and never implies real-time / tracked positions
 *   - carries no incident / vessel / position data: the geometry is fixed
 *
 * The TSX is className-only (no inline style / var() / px / hex); every visual
 * value lives in MapPanel.css and routes through Story 2.1 tokens.
 */
export function MapPanel({ variant = 'strait', className }: MapPanelProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const captionId = `${baseId}-caption`;

  const isYard = variant === 'yard';
  const heading = isYard ? 'Yard Plan' : 'Strait Map';
  const svgLabel = isYard
    ? 'Illustrative schematic of the terminal yard'
    : 'Illustrative schematic of the strait approach';
  const rootClassName = ['map-panel', className?.trim()].filter(Boolean).join(' ');

  return (
    <BlueprintPanel as="section" className={rootClassName} aria-labelledby={headingId}>
      <h3 id={headingId} className="map-panel__heading">
        {heading}
      </h3>
      <svg
        className="map-panel__svg"
        role="img"
        aria-label={svgLabel}
        aria-describedby={captionId}
        viewBox="0 0 320 180"
        focusable="false"
      >
        {isYard ? <YardScene /> : <StraitScene />}
      </svg>
      <p id={captionId} className="map-panel__caption">
        Illustrative schematic &mdash; vessel and berth positions are approximate
        and not live AIS data.
      </p>
    </BlueprintPanel>
  );
}

export default MapPanel;

/** Fixed illustrative strait approach: water channel, berth boxes, moored ships. */
function StraitScene() {
  return (
    <g className="map-panel__scene">
      {/* water channel banks */}
      <polyline
        className="map-panel__water"
        points="0,44 70,52 140,44 210,58 280,48 320,56"
        fill="none"
      />
      <polyline
        className="map-panel__water"
        points="0,132 70,126 140,138 210,124 280,134 320,128"
        fill="none"
      />
      {/* channel centre line */}
      <line className="map-panel__channel" x1="0" y1="90" x2="320" y2="88" />
      {/* quay edge */}
      <line className="map-panel__quay" x1="24" y1="150" x2="296" y2="150" />
      {/* berth boxes along the quay */}
      <rect className="map-panel__berth" x="40" y="150" width="52" height="20" />
      <rect className="map-panel__berth" x="134" y="150" width="52" height="20" />
      <rect className="map-panel__berth" x="228" y="150" width="52" height="20" />
      {/* moored / transiting ship rectangles */}
      <rect className="map-panel__ship" x="52" y="128" width="30" height="12" />
      <rect className="map-panel__ship" x="150" y="126" width="34" height="12" />
      <rect className="map-panel__ship" x="196" y="70" width="40" height="14" />
    </g>
  );
}

/** Fixed illustrative terminal yard: block grid, quay line, crane line-groups. */
function YardScene() {
  const columns = [24, 82, 140, 198, 256];
  const rows = [40, 82, 124];

  return (
    <g className="map-panel__scene">
      {/* yard block grid */}
      {rows.map((y) =>
        columns.map((x) => (
          <rect
            key={`${x}-${y}`}
            className="map-panel__yard-block"
            x={x}
            y={y}
            width="42"
            height="28"
          />
        )),
      )}
      {/* quay edge along the bottom */}
      <line className="map-panel__quay" x1="12" y1="168" x2="308" y2="168" />
      {/* quay cranes as line-groups riding the quay */}
      {[60, 140, 220].map((x) => (
        <polyline
          key={x}
          className="map-panel__crane"
          points={`${x},168 ${x},150 ${x + 26},150 ${x + 26},160`}
          fill="none"
        />
      ))}
    </g>
  );
}
