/**
 * Portwatch Console — Strait geography fixture (Story 4.1 / FR15 / UX-DR13).
 *
 * A frontend-only, fully static geo layer for `GeoMapPanel`:
 *
 *   - `STRAIT_BBOX`      the Singapore Strait / Tuas basin window every marker
 *                        and the basemap projection are clipped to.
 *   - `entityKind`       prefix (`vessel:` / `berth:` / …) → kind, for the
 *                        marker shape lookup.
 *   - `entityCoord`      an explicit `[lng, lat]` for every `entity_refs` value
 *                        the fixtures / demo seed can emit, `null` otherwise.
 *                        Positions are illustrative, NOT live vessel tracking.
 *   - `projectStrait`    a `geoMercator` fitted to `STRAIT_BBOX`.
 *   - `straitLandFeatures` Singapore / Malaysia / Indonesia polygons, decoded
 *                        once at module load from the bundled `world-atlas`
 *                        TopoJSON — no `fetch` / XHR / tile request ever.
 */

import { geoMercator } from 'd3-geo';
import type { GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import worldAtlas from 'world-atlas/countries-50m.json';

/** `[[minLng, minLat], [maxLng, maxLat]]` — the Strait / Tuas basin window. */
export const STRAIT_BBOX: [[number, number], [number, number]] = [
  [103.55, 1.15],
  [104.18, 1.52],
];

export type EntityKind = 'vessel' | 'berth' | 'crane' | 'yard' | 'gate' | 'unknown';

/** The `type` half of an `entity_refs` value (`"vessel:MSC-ANNA"` → `"vessel"`). */
export function entityKind(ref: string): EntityKind {
  const prefix = ref.split(':')[0];
  switch (prefix) {
    case 'vessel':
    case 'berth':
    case 'crane':
    case 'yard':
    case 'gate':
      return prefix;
    default:
      return 'unknown';
  }
}

/**
 * Static `[lng, lat]` for every entity ref the fixtures (`test/fixtures/
 * incidents.ts`) or the demo seed (`backend/api/demo_seed.py`) can produce.
 * Spread realistically across the Tuas basin quays and the strait channel —
 * all strictly inside `STRAIT_BBOX`. Illustrative only.
 */
const ENTITY_COORDS: Record<string, [number, number]> = {
  // quays / berths (north shore, Tuas → Pasir Panjang)
  'berth:C7': [103.62, 1.3],
  'berth:B3': [103.72, 1.295],
  'crane:CRANE-4': [103.64, 1.31],
  'crane:CRANE-7': [103.66, 1.305],
  'crane:C4': [103.74, 1.3],
  'yard:BLOCK-7': [103.63, 1.335],
  'yard:Y4': [103.8, 1.32],
  'yard:TUAS-C7': [103.6, 1.29],
  'yard:PASIR-PANJANG-P2': [103.79, 1.27],
  'gate:G2': [103.61, 1.33],
  'gate:G5': [103.68, 1.335],
  'gate:G9': [103.75, 1.33],
  // vessels (strait channel, east–west)
  'vessel:MSC-ANNA': [103.7, 1.22],
  'vessel:EVER-GIVEN': [103.78, 1.2],
  'vessel:HMM-ALGECIRAS': [103.86, 1.21],
  'vessel:OOCL-HONG-KONG': [103.94, 1.19],
  'vessel:OOCL-TOKYO': [103.98, 1.24],
  'vessel:MAERSK-SELETAR': [104.02, 1.22],
  'vessel:CMA-CGM-TITAN': [104.1, 1.2],
  'vessel:TITAN': [103.9, 1.235],
};

/**
 * `[lng, lat]` for a known ref, `null` for an unknown ref or a malformed one
 * (no `:` separator). Never throws.
 */
export function entityCoord(ref: string): [number, number] | null {
  if (!ref.includes(':')) return null;
  return ENTITY_COORDS[ref] ?? null;
}

/** Rectangular GeoJSON polygon spanning a `[[minLng,minLat],[maxLng,maxLat]]` bbox. */
function bboxPolygon(bbox: [[number, number], [number, number]]): Polygon {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [minLng, maxLat],
        [maxLng, maxLat],
        [maxLng, minLat],
        [minLng, minLat],
      ],
    ],
  };
}

/**
 * A `geoMercator` projection fitted to `STRAIT_BBOX` inside a `width × height`
 * pixel box. Degenerate (`<= 0`) sizes are clamped to `1` so the projection
 * still yields finite numbers instead of throwing.
 */
export function projectStrait(width: number, height: number): GeoProjection {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  return geoMercator().fitExtent(
    [
      [0, 0],
      [w, h],
    ],
    bboxPolygon(STRAIT_BBOX),
  );
}

// Natural Earth country ids for Singapore, Malaysia, Indonesia.
const STRAIT_LAND_IDS = new Set(['702', '458', '360']);

// Decoded ONCE at module scope from the bundled TopoJSON — no runtime network.
// A decode failure degrades to no basemap rather than throwing at import; an
// empty id-filter result (e.g. a future atlas re-numbering) degrades to the
// full country list rather than an empty map.
const WORLD_ATLAS = worldAtlas as unknown as Topology;

function decodeStraitLand(): Feature[] {
  let all: Feature[] = [];
  try {
    const collection = feature(
      WORLD_ATLAS,
      WORLD_ATLAS.objects.countries as GeometryCollection,
    ) as FeatureCollection;
    all = collection.features;
  } catch {
    return [];
  }
  const filtered = all.filter((f) => STRAIT_LAND_IDS.has(String(f.id)));
  return filtered.length > 0 ? filtered : all;
}

const LAND_FEATURES: Feature[] = decodeStraitLand();

/** Singapore / Malaysia / Indonesia land polygons for the Strait basemap. */
export function straitLandFeatures(): Feature[] {
  return LAND_FEATURES;
}
