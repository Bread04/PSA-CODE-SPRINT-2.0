import { describe, it, expect, vi } from 'vitest';

import {
  STRAIT_BBOX,
  entityCoord,
  entityKind,
  projectStrait,
  straitLandFeatures,
} from './geo';
import { allIncidents } from '../test/fixtures/incidents';

/**
 * Story 4.1 — geo.ts fixture.
 *
 * Covers the GEO_LOOKUP, PROJECTION_FIT and NETWORK_SILENT matrix rows.
 */

const [[MIN_LNG, MIN_LAT], [MAX_LNG, MAX_LAT]] = STRAIT_BBOX;

// Every entity ref the frontend fixtures can actually emit, derived from the
// real fixture data so this can never drift from `test/fixtures/incidents.ts`.
const KNOWN_REFS = [
  ...new Set(allIncidents.flatMap((i) => i.entity_refs)),
];

// The demo seed (backend/api/demo_seed.py) emits refs the frontend fixtures do
// NOT — `geo.ts` covers them too, but there is no shared source, so this list
// must be kept in sync with the backend seed by hand.
const DEMO_SEED_REFS = [
  'vessel:MSC-ANNA',
  'berth:B3',
  'gate:G2',
  'yard:Y4',
  'crane:C4',
  'vessel:EVER-GIVEN',
  'vessel:TITAN',
  'vessel:OOCL-TOKYO',
  'yard:TUAS-C7',
  'yard:PASIR-PANJANG-P2',
] as const;

function inStraitBbox([lng, lat]: [number, number]): boolean {
  return lng >= MIN_LNG && lng <= MAX_LNG && lat >= MIN_LAT && lat <= MAX_LAT;
}

describe('entityCoord', () => {
  it.each(KNOWN_REFS)('resolves %s to a coord inside STRAIT_BBOX', (ref) => {
    const coord = entityCoord(ref);
    expect(coord).not.toBeNull();
    expect(Number.isFinite(coord![0])).toBe(true);
    expect(Number.isFinite(coord![1])).toBe(true);
    expect(inStraitBbox(coord!)).toBe(true);
  });

  it.each(DEMO_SEED_REFS)(
    'resolves demo-seed ref %s to a coord inside STRAIT_BBOX',
    (ref) => {
      const coord = entityCoord(ref);
      expect(coord).not.toBeNull();
      expect(inStraitBbox(coord!)).toBe(true);
    },
  );

  it('returns null for an unknown ref', () => {
    expect(entityCoord('vessel:NOPE')).toBeNull();
    expect(entityCoord('nope:x')).toBeNull();
  });

  it('returns null (no throw) for a malformed ref with no colon', () => {
    expect(entityCoord('malformed')).toBeNull();
    expect(entityCoord('')).toBeNull();
  });
});

describe('entityKind', () => {
  it.each([
    ['vessel:MSC-ANNA', 'vessel'],
    ['berth:C7', 'berth'],
    ['crane:CRANE-4', 'crane'],
    ['yard:BLOCK-7', 'yard'],
    ['gate:G2', 'gate'],
  ])('maps the %s prefix to %s', (ref, kind) => {
    expect(entityKind(ref)).toBe(kind);
  });

  it('maps an unrecognised prefix or a malformed ref to "unknown"', () => {
    expect(entityKind('truck:T1')).toBe('unknown');
    expect(entityKind('malformed')).toBe('unknown');
  });
});

describe('projectStrait', () => {
  const CORNERS: [number, number][] = [
    [MIN_LNG, MIN_LAT],
    [MIN_LNG, MAX_LAT],
    [MAX_LNG, MIN_LAT],
    [MAX_LNG, MAX_LAT],
  ];

  it('maps every STRAIT_BBOX corner into the 320x180 pixel box', () => {
    const project = projectStrait(320, 180);
    for (const corner of CORNERS) {
      const point = project(corner);
      expect(point).not.toBeNull();
      const [x, y] = point!;
      const EPS = 0.01;
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(-EPS);
      expect(x).toBeLessThanOrEqual(320 + EPS);
      expect(y).toBeGreaterThanOrEqual(-EPS);
      expect(y).toBeLessThanOrEqual(180 + EPS);
    }
  });

  it('spreads opposite bbox corners toward the left / right edges of the box', () => {
    const project = projectStrait(320, 180);
    const west = project([MIN_LNG, MIN_LAT])!;
    const east = project([MAX_LNG, MIN_LAT])!;
    const north = project([MIN_LNG, MAX_LAT])!;
    const south = project([MIN_LNG, MIN_LAT])!;

    // min-lng maps into the left third, max-lng into the right third.
    expect(west[0]).toBeLessThan(320 / 3);
    expect(east[0]).toBeGreaterThan((320 * 2) / 3);
    // and the projection actually has vertical extent (min-lat below max-lat).
    expect(south[1]).toBeGreaterThan(north[1]);
  });

  it('degenerate / non-finite width/height still yields finite numbers, no throw', () => {
    for (const [w, h] of [
      [0, 0],
      [-10, -10],
      [Number.NaN, Number.NaN],
      [Number.POSITIVE_INFINITY, 180],
    ]) {
      expect(() => projectStrait(w, h)).not.toThrow();
      const point = projectStrait(w, h)([MIN_LNG, MIN_LAT]);
      expect(point).not.toBeNull();
      expect(Number.isFinite(point![0])).toBe(true);
      expect(Number.isFinite(point![1])).toBe(true);
    }
  });
});

describe('straitLandFeatures', () => {
  it('returns a non-empty Feature[] without any network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const features = straitLandFeatures();
    expect(Array.isArray(features)).toBe(true);
    expect(features.length).toBeGreaterThan(0);
    for (const feat of features) {
      expect(feat.type).toBe('Feature');
      expect(feat.geometry).toBeTruthy();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
