import { useId, useMemo } from 'react';
import { geoPath } from 'd3-geo';

import { BlueprintPanel } from '../BlueprintPanel';
import { MapPanel } from '../MapPanel';
import type { Incident, TraceEntry } from '../../types/incident';
import {
  entityCoord,
  entityKind,
  projectStrait,
  straitLandFeatures,
} from '../../lib/geo';
import './GeoMapPanel.css';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 180;

export interface GeoMapPanelProps {
  /** The currently selected incident, or `null` when nothing is selected. */
  incident: Incident | null;
  /** Optional extra class merged onto the panel root. */
  className?: string;
}

/** Discrete marker state derived from the incident's latest trace stage. */
export type MarkerStateKey =
  | 'pending'
  | 'analysing'
  | 'deciding'
  | 'applied'
  | 'blocked'
  | 'done';

const STATE_LABELS: Record<MarkerStateKey, string> = {
  pending: 'pending',
  analysing: 'analysing',
  deciding: 'deciding',
  applied: 'action applied',
  blocked: 'blocked',
  done: 'done',
};

function stageToStateKey(entry: TraceEntry | undefined): MarkerStateKey {
  if (!entry) return 'pending';
  switch (entry.stage) {
    case 'INGEST':
    case 'CORRELATE':
      return 'pending';
    case 'AGENT_CALL':
    case 'SYNTHESIZE':
      return 'analysing';
    case 'CONFIDENCE':
    case 'POLICY_DECISION':
    case 'DG_CHECK':
      return 'deciding';
    case 'APPROVAL':
      return 'blocked';
    case 'EXECUTE':
      return entry.error ? 'blocked' : 'applied';
    case 'VERIFY':
      return 'done';
    default:
      return 'pending';
  }
}

/**
 * The marker state for an incident, from the last `trace` entry's stage. An
 * unknown stage, an empty trace, or no incident all read as `pending`.
 */
function markerState(incident: Incident | null): {
  key: MarkerStateKey;
  label: string;
} {
  const trace = incident?.trace ?? [];
  const key = stageToStateKey(trace[trace.length - 1]);
  return { key, label: STATE_LABELS[key] };
}

/**
 * The id half of an entity ref (`"vessel:MSC-ANNA"` → `"MSC-ANNA"`). Falls back
 * to the full ref string when there is no `:` or nothing follows it.
 */
function shortRef(ref: string): string {
  const idx = ref.indexOf(':');
  if (idx === -1) return ref;
  return ref.slice(idx + 1) || ref;
}

interface ResolvedMarker {
  ref: string;
  kind: ReturnType<typeof entityKind>;
  x: number;
  y: number;
}

/**
 * GeoMapPanel — a read-only, illustrative Singapore Strait basemap (Story 4.1).
 *
 * With an incident selected: a real bundled d3-geo vector basemap (Natural
 * Earth geometry from the `world-atlas` npm package — decoded once at module
 * load, zero runtime network) framed by the shared `BlueprintPanel`, with
 * token-coloured SVG primitive markers for that incident's affected entities.
 * Marker position is a fixed `geo.ts` fixture lookup; only the state label /
 * shape / stroke changes as the trace advances. Colour is never the sole
 * signal — every marker also carries a `<text>` label, a kind-specific shape
 * and a state-specific stroke.
 *
 * With no incident selected: falls back to Story 2.7's `MapPanel` strait
 * schematic (degraded-safe, zero markers).
 *
 * This is NOT a live vessel feed. The caption and the `aria-label` both say so
 * (UX-DR7 / AD-17).
 */
export function GeoMapPanel({ incident, className }: GeoMapPanelProps) {
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const captionId = `${baseId}-caption`;

  // Projection + serialized country paths have no per-render inputs; compute
  // them once so a 2-3s poll re-render does not re-serialize the polygons.
  const projection = useMemo(
    () => projectStrait(VIEWBOX_WIDTH, VIEWBOX_HEIGHT),
    [],
  );
  const landPaths = useMemo(() => {
    const toPath = geoPath(projection);
    return straitLandFeatures()
      .map((feat) => toPath(feat))
      .filter((d): d is string => Boolean(d));
  }, [projection]);

  // Degraded-safe: no incident → the Story 2.7 strait schematic, zero markers.
  if (!incident) {
    return <MapPanel variant="strait" className={className} />;
  }

  const rootClassName = ['geo-map-panel', className?.trim()]
    .filter(Boolean)
    .join(' ');

  const state = markerState(incident);

  const seen = new Set<string>();
  const markers: ResolvedMarker[] = [];
  for (const ref of incident.entity_refs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    const coord = entityCoord(ref);
    if (!coord) continue;
    const p = projection(coord);
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    markers.push({ ref, kind: entityKind(ref), x: p[0], y: p[1] });
  }

  const shownList = markers
    .map((m) => `${m.ref} (${state.label})`)
    .join(', ');
  const ariaLabel =
    `Illustrative map of the Singapore Strait. Selected incident affects ` +
    `${markers.length} of ${seen.size} shown entities` +
    (shownList ? `: ${shownList}` : '') +
    `. Positions are mock incident state, not live AIS.`;

  return (
    <BlueprintPanel
      as="section"
      className={rootClassName}
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="geo-map__heading">
        Strait Map
      </h3>
      <svg
        className="geo-map__svg"
        role="img"
        aria-label={ariaLabel}
        aria-describedby={captionId}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        focusable="false"
      >
        <g className="geo-map__basemap">
          {landPaths.map((d, i) => (
            <path key={`land-${i}`} className="geo-map__land" d={d} />
          ))}
        </g>
        {markers.map((m) => (
          <g
            key={m.ref}
            className={`geo-map__marker geo-map__marker--${m.kind} geo-map__marker--${state.key}`}
          >
            <MarkerShape kind={m.kind} x={m.x} y={m.y} />
            <text className="geo-map__label" x={m.x + 5} y={m.y - 4}>
              {`${shortRef(m.ref)} · ${state.label}`}
            </text>
          </g>
        ))}
      </svg>
      <p id={captionId} className="geo-map__caption">
        Illustrative map &mdash; vessel and berth positions are mock incident
        state, not live AIS data.
      </p>
    </BlueprintPanel>
  );
}

/** Kind-specific primitive shape, centred on the projected point. */
function MarkerShape({
  kind,
  x,
  y,
}: {
  kind: ReturnType<typeof entityKind>;
  x: number;
  y: number;
}) {
  switch (kind) {
    case 'vessel':
      return <circle className="geo-map__shape" cx={x} cy={y} r={3.4} />;
    case 'crane':
      return (
        <polygon
          className="geo-map__shape"
          points={`${x},${y - 4} ${x - 3.6},${y + 3} ${x + 3.6},${y + 3}`}
        />
      );
    case 'yard':
      return (
        <rect
          className="geo-map__shape geo-map__shape--dashed"
          x={x - 4}
          y={y - 4}
          width={8}
          height={8}
        />
      );
    case 'gate':
      return (
        <rect className="geo-map__shape" x={x - 1.4} y={y - 4} width={2.8} height={8} />
      );
    case 'berth':
      return (
        <rect className="geo-map__shape" x={x - 3.4} y={y - 3.4} width={6.8} height={6.8} />
      );
    default:
      return (
        <rect className="geo-map__shape" x={x - 3} y={y - 3} width={6} height={6} />
      );
  }
}
