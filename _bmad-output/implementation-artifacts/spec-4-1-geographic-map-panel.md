---
title: 'Geographic MapPanel'
type: 'feature'
created: '2026-08-28'
status: 'done'
baseline_revision: '8eba30940c09612b93207761b1c2bd25d4f3e146'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - frontend/src/components/MapPanel/MapPanel.tsx
  - frontend/src/components/MapPanel/MapPanel.test.tsx
warnings: ['oversized']
deferred:
  - summary: >-
      The full world-atlas/countries-50m.json (~740 KB raw / ~200 KB gzipped) is
      bundled instead of a Strait bbox-trimmed extract (~100 KB per epic-4-context).
    evidence: |-
      geo.ts imports 'world-atlas/countries-50m.json' whole and filters to 3 country
      ids at module scope. Works, zero runtime network, but the production bundle is
      ~2x the epic-context's stated ~100 KB target and there is no bundle-size guard.
      A build-time bbox-clip script producing a vendored src/assets extract is the
      focused follow-up.
    location: >-
      frontend/src/lib/geo.ts
    severity: low
  - summary: >-
      Marker text labels have a fixed x+5/y-4 offset with no viewBox-edge clamping
      or overlap avoidance; near-coincident fixture coordinates will collide.
    evidence: |-
      Some geo.ts fixture coords sit within ~0.005 deg of each other (e.g. the two
      cranes), so their labels overlap, and labels near the basemap edge are clipped
      by the svg's overflow:hidden. Legibility polish for the demo, fixture-tunable.
    location: >-
      frontend/src/components/GeoMapPanel/GeoMapPanel.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The Live Console's map (Story 2.7 `MapPanel`) is a fixed hand-drawn schematic that adds no spatial realism — an operator or judge cannot see *where* the selected incident is happening. Epic 4 / FR15 / UX-DR13 want a real Singapore Strait basemap with the selected incident's affected entities marked, without it being or implying a live vessel-tracking feed (the Responsible-AI line in UX-DR7, AD-17).

**Approach:** Add a new frontend-only `GeoMapPanel` that renders a real bundled d3-geo vector basemap of the Singapore Strait (Natural Earth geometry from the `world-atlas` npm package — bundled, zero runtime network) and overlays token-coloured SVG primitive markers for the selected incident's `entity_refs`, positioned by a static `frontend/src/lib/geo.ts` fixture. Marker state tracks the incident's latest trace stage. No backend change, no new endpoint, no `Incident` schema change. Story 2.7's `MapPanel` is left intact and still exported (retained as the yard/plan schematic).

## Boundaries & Constraints

**Always:** Basemap geometry is imported from a bundled asset (`world-atlas/countries-50m.json`) and converted with `topojson-client` at module load — **no `fetch` / XHR / CDN / tile request at runtime**, asserted with a `fetch` spy. The map is a single `role="img"` node with a full-sentence `aria-label` text equivalent; decorative shapes carry no `aria-label` / `role="img"` / positive `tabindex`. The caption must contain "illustrative" and "not live AIS", must NOT match `/real-time|live positions|tracking|current location/i`, and must state that positions are mock incident state — the three assertions are carried verbatim from `MapPanel.test.tsx`. Colour is never the sole signal: marker state and entity kind also read through a `<text>` label and a shape difference. The map is read-only — no button, no `tabindex > -1`, no pan/zoom/hover/click handlers, no `on*` attributes, no `<script>`/`<image>`/`<use>`/`href` in the SVG. All CSS colour values route through Story 2.1 tokens (`var(--*)` / `currentColor` / `none`); every `border-radius` is `0` or a `var(--radius-*)`. `GeoMapPanel` renders inside the shared `BlueprintPanel`. Markers for the selected incident only; with no incident selected the basemap renders with zero markers (degraded-safe). `npm run verify` (lint + build + test) and `npx tsc -b` stay green.

**Block If:** (none — dependencies install cleanly; d3-geo path generation is pure and runs under jsdom.)

**Never:** No tile/slippy-map library (Leaflet/Mapbox). No backend, endpoint, `Incident` schema, or golden-path change. Do not modify `MapPanel.tsx` / `MapPanel.css` / `MapPanel.test.tsx` (reuse by leaving intact). No red/amber/green severity vocabulary on the map. No interpolated "in transit" marker motion — position is a fixed fixture lookup, only the state label/shape changes between polls. No `!` or emoji in any user-facing string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| INCIDENT_SELECTED | `incident` with `entity_refs=["berth:C7","vessel:MSC-ANNA"]`, latest trace stage `AGENT_CALL` | One `role="img"` svg: basemap `<path>`s + one marker group per *resolvable* ref, each with a `<text>` label and a kind-specific shape; `aria-label` is a full sentence naming each shown entity and its state; caption honesty strings present | Unresolvable ref → marker omitted; `aria-label` says "N of M affected entities shown" |
| NO_INCIDENT | `incident = null` | Basemap `<path>`s render; zero marker groups; `aria-label` = one sentence stating no incident is selected; caption unchanged | No throw |
| TRACE_ADVANCES | same incident re-rendered with latest stage now `EXECUTE` (ok) | Marker state label/shape changes (e.g. "analysing" → "action applied"); marker coordinates unchanged | Unknown/empty trace → state label "pending" |
| NETWORK_SILENT | component mounts with a `fetch` spy installed | Spy is never called; basemap still renders | n/a |
| GEO_LOOKUP | `entityCoord("berth:C7")` / `entityCoord("nope:x")` | Known ref → `[lng,lat]` inside `STRAIT_BBOX`; unknown → `null` | Malformed ref (no `:`) → `null`, no throw |
| PROJECTION_FIT | `projectStrait(w,h)` applied to the four `STRAIT_BBOX` corners | Each corner maps to a finite point within `[0,w] × [0,h]` | Degenerate `w`/`h` ≤ 0 → still finite numbers, no throw |

</intent-contract>

## Code Map

- `frontend/src/components/MapPanel/MapPanel.tsx` -- Story 2.7 schematic. READ-ONLY reuse: keep exported, still rendered by its own tests; `GeoMapPanel` is a sibling, not a replacement.
- `frontend/src/components/MapPanel/MapPanel.test.tsx` -- source of the verbatim caption-honesty assertions and the "no script/href/image/use/on*" SVG-safety assertions to carry into `GeoMapPanel.test.tsx`.
- `frontend/src/components/MapPanel/MapPanel.css` -- token discipline pattern (`--accent-600`, `--divider`, `--text`, `--text-muted`, `--space-3`, `--font-size-micro-label`, zero radius) to mirror in `GeoMapPanel.css`.
- `frontend/src/components/BlueprintPanel/BlueprintPanel.tsx` -- `as` / `className` / `aria-*` passthrough; `GeoMapPanel` wraps its content in `<BlueprintPanel as="section" aria-labelledby=…>` exactly as `MapPanel` does.
- `frontend/src/App.tsx` -- center column (`app-col--center`) currently renders `<MapPanel />` (line ~118); swap to `<GeoMapPanel incident={selected} />`. `selected` (the `Incident | null`) is already computed.
- `frontend/src/App.test.tsx` -- `../api/client` is stubbed with `allIncidents` / `tier3WithAlternatives` fixtures; extend for the composed geo map + selection-change update.
- `frontend/src/types/incident.ts` -- `Incident`, `TraceEntry`; `entity_refs: string[]`, `trace: TraceEntry[]`, `trace[i].stage` SCREAMING_SNAKE. No change.
- `frontend/src/theme/tokens.css` -- available tokens: `--accent-100..900`, `--accent-2`, `--accent-2-100/900`, `--divider`, `--surface`, `--text`, `--text-muted`, `--space-1..8`, `--radius-*`, `--font-size-micro-label`.
- `frontend/src/test/fixtures/incidents.ts` -- fixture `entity_refs` (`berth:C7`, `crane:CRANE-4`, `crane:CRANE-7`, `vessel:MSC-ANNA`, `vessel:EVER-GIVEN`, `vessel:HMM-ALGECIRAS`, `vessel:OOCL-HONG-KONG`, `vessel:MAERSK-SELETAR`, `vessel:CMA-CGM-TITAN`, `gate:G2/G5/G9`, `yard:BLOCK-7`) — all must resolve in `geo.ts`.
- `backend/api/demo_seed.py` -- demo `entity_refs` (`vessel:MSC-ANNA`, `berth:B3`, `gate:G2`, `yard:Y4`, `crane:C4`, `vessel:EVER-GIVEN`, `vessel:TITAN`, `vessel:OOCL-TOKYO`, `yard:TUAS-C7`, `yard:PASIR-PANJANG-P2`) — resolve these in `geo.ts` too (READ-ONLY; do not edit the backend).
- `frontend/package.json` -- add deps `d3-geo`, `topojson-client`, `world-atlas` and devDeps `@types/d3-geo`, `@types/topojson-client` (already `npm install`ed into `node_modules`; commit the manifest + lockfile).

## Tasks & Acceptance

**Execution:**
- `frontend/package.json` + `frontend/package-lock.json` -- commit the added deps: `d3-geo`, `topojson-client`, `world-atlas`, `@types/d3-geo`, `@types/topojson-client`. If a `declare module '*.json'` shim is needed for the `world-atlas` import under the project tsconfig, add it to `frontend/src/vite-env.d.ts`.
- `frontend/src/lib/geo.ts` -- NEW. Export `STRAIT_BBOX: [[number,number],[number,number]]` ≈ `[[103.55,1.15],[104.18,1.52]]`; `entityKind(ref: string): 'vessel'|'berth'|'crane'|'yard'|'gate'|'unknown'` (prefix before `:`); `entityCoord(ref: string): [number, number] | null` — an explicit `Record<string,[number,number]>` covering every ref listed in the Code Map (spread realistically across the Tuas basin / strait, all inside `STRAIT_BBOX`), `null` for anything unmatched or malformed; `projectStrait(width: number, height: number): GeoProjection` — `geoMercator().fitExtent([[0,0],[max(width,1),max(height,1)]], bboxPolygon(STRAIT_BBOX))`; `straitLandFeatures(): Feature[]` — `topojson-client.feature(worldAtlas, worldAtlas.objects.countries).features` filtered to ids `{"702","458","360"}` (Singapore, Malaysia, Indonesia), computed once at module scope.
- `frontend/src/components/GeoMapPanel/GeoMapPanel.tsx` -- NEW. Props `{ incident: Incident | null; className?: string }`. Renders `<BlueprintPanel as="section" aria-labelledby={headingId} className={['geo-map-panel', className?.trim()].filter(Boolean).join(' ')}>` containing: `<h3 id={headingId}>Strait Map</h3>`; one `<svg role="img" viewBox="0 0 320 180" focusable="false" aria-label={sentence} aria-describedby={captionId}>` with `overflow` hidden via CSS, holding `<path className="geo-map__land">` per `straitLandFeatures()` (via `geoPath(projectStrait(320,180))`), then for each `incident.entity_refs` whose `entityCoord` is non-null a `<g className="geo-map__marker geo-map__marker--{kind}">` with a kind-specific primitive (`vessel`→`<circle>`, `berth`→`<rect>`, `crane`→`<polygon>` triangle, `yard`→`<rect>` dashed, `gate`→`<rect>` narrow) at the projected point plus a `<text className="geo-map__label">` = `"{short ref} · {stateLabel}"`; `<p id={captionId} className="geo-map__caption">` with the honesty text (see Design Notes). Helper `markerState(incident): { key: 'pending'|'analysing'|'deciding'|'applied'|'blocked'|'done'; label: string }` from the last `trace` entry's `stage` (`AGENT_CALL`→analysing, `CONFIDENCE`/`POLICY_DECISION`/`DG_CHECK`→deciding, `APPROVAL`→blocked, `EXECUTE`+no `error`→applied, `EXECUTE`+`error`→blocked, `VERIFY`→done, else→pending). `aria-label` sentence: incident → `"Illustrative map of the Singapore Strait. Selected incident affects {n} of {m} shown entities: {ref (stateLabel)}, …. Positions are mock incident state, not live AIS."`; no incident → `"Illustrative map of the Singapore Strait. No incident is selected, so no entities are marked."`.
- `frontend/src/components/GeoMapPanel/GeoMapPanel.css` -- NEW. `.geo-map-panel` flex column, `gap: var(--space-3)`, `border-radius: 0`. `.geo-map__svg` `display:block; width:100%; height:auto; max-height:200px; overflow:hidden; border-radius:0`. `.geo-map__land` `fill: var(--accent-100); stroke: var(--divider); stroke-width: 1px`. `.geo-map__marker` fills from `var(--accent-600)` / `var(--accent-2)` by kind; `--blocked` / `--done` variants change stroke/dash, not hue alone. `.geo-map__label` `font-size: var(--font-size-micro-label); fill: var(--text)`. `.geo-map__caption` mirrors `.map-panel__caption` (`var(--text-muted)`, `var(--font-size-micro-label)`). No raw hex, no named colours.
- `frontend/src/components/GeoMapPanel/index.ts` -- NEW. `export { GeoMapPanel } from './GeoMapPanel';` + prop type.
- `frontend/src/components/GeoMapPanel/GeoMapPanel.test.tsx` -- NEW. Cover every I/O matrix row. Assertions: `vi.spyOn(globalThis,'fetch')` (and `window.fetch`) never called after render (NETWORK_SILENT); exactly one `role="img"`; `aria-label` is one sentence ending `.` and containing `Illustrative` + `not live AIS`; caption contains `illustrative` + `not live ais`, does not match `/real-time|live positions|tracking|current location/i`, mentions `mock incident state`, no `!`/emoji; INCIDENT_SELECTED → marker group count == resolvable-ref count, each has a `<text>`, shapes differ by kind; TRACE_ADVANCES → re-render with a later stage changes the state label text; NO_INCIDENT → `>0` `.geo-map__land` paths and `0` `.geo-map__marker`; SVG safety — no `<script>`/`<image>`/`<use>`, no `href`, no `on*` attribute, no `tabindex > -1`, no `<button>`. Plus a CSS static scan mirroring `MapPanel.test.tsx` (no hex, colour props are `var(--*)`/`currentColor`/`none`, radius `0`/`var(--radius-*)`).
- `frontend/src/lib/geo.test.ts` -- NEW. `entityCoord` for every Code-Map ref → non-null and inside `STRAIT_BBOX`; unknown / no-colon → `null`; `entityKind` prefix mapping incl. `unknown`; `projectStrait(320,180)` maps each `STRAIT_BBOX` corner to a finite `[x,y]` with `0 ≤ x ≤ 320`, `0 ≤ y ≤ 180`; `projectStrait(0,0)` returns finite numbers (no throw); `straitLandFeatures()` returns a non-empty `Feature[]` and triggers no `fetch`.
- `frontend/src/App.tsx` -- replace `<MapPanel />` in `app-col--center` with `<GeoMapPanel incident={selected} />`; drop the now-unused `MapPanel` import if nothing else uses it (leave the component + its tests untouched).
- `frontend/src/App.test.tsx` -- add: with `allIncidents` stubbed and a row selected, the console shows the geo map `role="img"` whose `aria-label` names that incident's entity; selecting a different incident updates the `aria-label`. Do not weaken existing assertions.

**Acceptance Criteria:**
- Given the Live Console with an incident selected, when the map draws, then it renders a real bundled Strait basemap (`>0` land `<path>`s) plus one token-coloured marker with a text label per resolvable affected entity, positioned from `geo.ts`.
- Given the selected incident's trace advances, when `GeoMapPanel` re-renders, then the affected-entity markers' state label/shape reflect the latest pipeline stage, with colour never the sole differentiator, and marker coordinates unchanged.
- Given either the incident or no-incident render, when the caption is inspected, then it contains "illustrative" and "not live AIS", matches none of `/real-time|live positions|tracking|current location/i`, and states positions are mock incident state.
- Given the rendered map, when inspected, then it is a single `role="img"` node with a full-sentence `aria-label`, no runtime `fetch`/network call occurs (spy asserted), and `npm run verify` + `npx tsc -b` stay green.
- Given no incident is selected, when the console renders, then the basemap shows with zero incident markers and no error.
- Given `frontend/src/components/MapPanel/*`, when this story is complete, then those three files are byte-unchanged and their tests still pass.

## Spec Change Log

- **2026-08-29 — review clarification (no re-derive):** The intent-contract said `GeoMapPanel` renders the basemap with zero markers on no-incident, while the cited `epic-4-context.md` says Story 2.7 `MapPanel` is "retained … as the no-incident-selected fallback." Resolved as a patch: `GeoMapPanel`'s `incident == null` branch renders the retained `<MapPanel variant="strait" />` as the fallback; the geographic basemap + markers render for a selected incident. KEEP: `MapPanel/*` stays byte-unchanged; the geographic map remains a sibling component owning its own matrix.

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 13: (high 0, medium 2, low 11)
- defer: 2: (high 0, medium 0, low 2)
- reject: 11: (high 0, medium 0, low 11)
- addressed_findings:
  - `[medium]` `[patch]` `GeoMapPanel` unmounted Story 2.7 `MapPanel` entirely (dead code) and rendered its own empty basemap on no-incident, contradicting `epic-4-context.md`'s "retained as the no-incident-selected fallback" — the `incident == null` branch now renders `<MapPanel variant="strait" />`.
  - `[medium]` `[patch]` `stageToStateKey` "deciding" (`CONFIDENCE`/`POLICY_DECISION`/`DG_CHECK`), "blocked" (`APPROVAL`), "done" (`VERIFY`) branches were untested and `CORRELATE`/`INGEST`/`SYNTHESIZE` fell through to "pending" — added explicit `SYNTHESIZE`→analysing / `CORRELATE`/`INGEST`→pending handling and an `it.each` table over every stage→state pair.
  - `[low]` `[patch]` `geo.test.ts` pinned the geo↔fixtures contract with a hand-copied `KNOWN_REFS` array — now derives refs from `import { allIncidents }` and asserts each `entity_refs` value resolves.
  - `[low]` `[patch]` `aria-label` produced "…affects 0 of 0 shown entities: ." (dangling colon) when an incident had zero resolvable refs — trailing entity list omitted when empty; added an all-unresolvable-refs test.
  - `[low]` `[patch]` `projectStrait` only clamped `width`/`height` ≤ 0, not `NaN` — now `Number.isFinite(x) && x > 0 ? x : 1`; added a projection-spread assertion (corners reach toward the box edges, not just inside it).
  - `[low]` `[patch]` A marker whose projected point is non-finite rendered `cx=NaN` — added a `Number.isFinite` guard that drops the marker.
  - `[low]` `[patch]` Duplicate `entity_refs` produced duplicate React keys — refs deduped before mapping.
  - `[low]` `[patch]` A bare-colon ref (`"vessel:"`) rendered a " · analysing" label with no id — falls back to the full ref.
  - `[low]` `[patch]` `@types/d3-geo` was in `dependencies` — moved to `devDependencies` (matches `@types/topojson-client`).
  - `[low]` `[patch]` CSS state variants existed only for `--blocked`/`--done` while the header comment claimed a stroke/dash change for all states — added a distinguishing stroke/dash/opacity step for `--analysing`/`--deciding`/`--applied`/`--pending` (the `<text>` suffix already differs).
  - `[low]` `[patch]` The module-load `feature()` atlas decode had no error boundary — wrapped in try/catch returning `[]`, with a fallback to all countries if the SGP/MYS/IDN id filter matches nothing.
  - `[low]` `[patch]` `GeoMapPanel` recomputed `projectStrait`/`geoPath`/land-path serialization on every poll re-render — land paths and projection now `useMemo`'d.
  - `[low]` `[patch]` Projection test EPS-only assertion would not catch a whole-globe `fitExtent` — added the corner-spread assertion noted above.

## Design Notes

Caption text (exact): `Illustrative map — vessel and berth positions are mock incident state, not live AIS data.` — clears all three carried-forward assertions (`illustrative`, `not live ais`, "mock incident state"; no `real-time|live positions|tracking|current location`).

Why `world-atlas/countries-50m.json` imported directly (not a trimmed vendored file): it is an npm-package asset, so Vite bundles it and there is zero runtime network — the whole point of AD-17. 50m resolution keeps the raw asset ~740 KB (~200 KB gzipped), acceptable for a demo; a build-time trim to a Strait bbox is a clean follow-up, not a blocker. `feature()` from `topojson-client` + an id filter to SGP/MYS/IDN, computed once at module scope, keeps render cheap. The SVG `overflow:hidden` + a projection fit to `STRAIT_BBOX` is what visually clips the basemap to the strait — no clipPath needed.

Why a sibling component, not an edit to `MapPanel`: the epic context requires Story 2.7's component "retained (not reverted)"; its test file also owns the canonical honesty assertions. A new `GeoMapPanel` keeps 2.7 intact as the yard/plan schematic and lets the geo map own its own matrix.

Marker shape-by-kind (colour is secondary): vessel = circle, berth = rect, crane = triangle polygon, yard = dashed rect, gate = narrow rect. State adds a suffix to the `<text>` label (`analysing` / `deciding` / `action applied` / `blocked` / `done` / `pending`) and a stroke/dash change — a screen-reader user and a monochrome viewer both get the state.

## Verification

**Commands:**
- `cd frontend && npx tsc -b` -- expected: exit 0, no type errors.
- `cd frontend && npm test -- --run` -- expected: all suites pass, incl. the new `GeoMapPanel` / `geo` tests and the extended `App` test; existing `MapPanel` tests unchanged and green.
- `cd frontend && npm run lint` -- expected: no errors (jsx-a11y clean on the SVG).
- `cd frontend && npm run build` -- expected: succeeds; bundle emitted.

**Manual checks:**
- `git diff --stat` shows no changes under `frontend/src/components/MapPanel/`.
- Grep the new component/test output for `fetch(` / `http` / `cdn` — none in runtime paths.

## Auto Run Result

Status: done

### Implemented change

Epic 4 / FR15 / UX-DR13 Story 4.1. New frontend-only `GeoMapPanel` renders a real bundled d3-geo vector basemap of the Singapore Strait (Natural Earth SGP/MYS/IDN geometry from the `world-atlas` npm asset — bundled, zero runtime network, `fetch`-spy asserted) and overlays token-coloured SVG primitive markers for the selected incident's `entity_refs`, positioned by a static `frontend/src/lib/geo.ts` fixture and a `geoMercator().fitExtent` projection. Marker + `aria-label` state tracks the incident's latest trace stage (pending / analysing / deciding / action applied / blocked / done). With no incident selected the panel renders the retained Story 2.7 `MapPanel` strait schematic as the degraded-safe fallback. No backend, endpoint, `Incident` schema, or golden-path change; `MapPanel/*` is byte-unchanged.

### Files changed

- `frontend/src/lib/geo.ts` — NEW. `STRAIT_BBOX`, `entityKind`, `entityCoord` (explicit `Record` for every fixture + demo-seed ref, `null` for unknown/malformed), `projectStrait` (NaN/≤0-guarded `fitExtent`), `straitLandFeatures` (try/catch atlas decode at module scope, full-country fallback if the id filter is empty).
- `frontend/src/lib/geo.test.ts` — NEW. GEO_LOOKUP / PROJECTION_FIT (incl. corner-spread) / NETWORK_SILENT; `KNOWN_REFS` derived from the real `allIncidents` fixture; a hand-synced `DEMO_SEED_REFS` list.
- `frontend/src/components/GeoMapPanel/{GeoMapPanel.tsx,GeoMapPanel.css,GeoMapPanel.test.tsx,index.ts}` — NEW. `role="img"` svg, memoized projection + land paths, dedup + finite-point + bare-colon guards, token-only CSS with a distinguishing stroke/dash/opacity per state, `MapPanel` fallback for `incident == null`.
- `frontend/src/App.tsx` — center column renders `<GeoMapPanel incident={selected} />`.
- `frontend/src/App.test.tsx` — added composed-console coverage: map present with zero markers on no selection; `aria-label` names the selected incident's entity and updates on selection change.
- `frontend/package.json` + `frontend/package-lock.json` — deps `d3-geo`, `topojson-client`, `world-atlas`; devDeps `@types/d3-geo`, `@types/topojson-client`.

### Review findings breakdown

- Patches applied: 13 (0 high, 2 medium, 11 low) — restored `MapPanel` as the no-incident fallback (it had been unmounted → dead code); added full `stageToStateKey` coverage + explicit `CORRELATE`/`INGEST`/`SYNTHESIZE` handling; derived the geo↔fixtures test contract from the real fixtures; fixed a malformed zero-marker `aria-label`; `NaN`/non-finite guards on the projection and marker points; ref dedup; bare-colon label fallback; `@types/d3-geo` → devDependencies; per-state CSS differentiation; module-load atlas-decode error boundary with fallback; memoized projection + land paths.
- Deferred: 2 (both low) — full 740 KB atlas bundled vs the epic-context's ~100 KB trimmed target (needs a build-time bbox-clip step); marker label collision / edge-clipping for near-coincident fixture coordinates (fixture-tuning + label de-collision).
- Rejected: 11 — per-entity marker state (not derivable — the trace carries one incident-level stage), `bboxPolygon` winding (no consumer), double "not live AIS" in `aria-label` + caption (mirrors 2.7's `aria-describedby` pattern), `max-height` letterboxing (matches 2.7), transitive `@types/*` not direct, and confirmed-unnecessary items (the `*.json` shim — JSON import resolves natively).

### Follow-up review recommendation

`true`. This pass's patch findings: high 0, medium 2, low 11. Score `3 × 2 + 1 × 11 = 17` (≥ 5) → `followup_review_recommended: true`. No high-severity patch; the recommendation is driven by patch volume. Recommend a focused human/next-pass look at the two deferred items (bundle size, label layout) and a visual check of the rendered basemap.

### Verification performed

- `cd frontend && npx tsc -b` → exit 0.
- `cd frontend && npm run lint` → exit 0, no errors/warnings.
- `cd frontend && npm test -- --run` → **658 passed** (21 files; +20 net new geo / GeoMapPanel / App cases; `MapPanel` suite unchanged and green).
- `cd frontend && npm run build` → exit 0; only the pre-existing ">500 kB chunk" advisory (the bundled `countries-50m.json`).
- `git diff --stat` since baseline shows `frontend/src/components/MapPanel/` byte-unchanged.

### Residual risks

- **Bundle size** — the console JS bundle is now ~1.0 MB / ~322 KB gzipped (was ~250 KB gzip) because the full 50m world atlas is bundled. Acceptable for a demo; a build-time Strait bbox trim to a vendored ~100 KB extract is the tracked follow-up (frontmatter `deferred`).
- **Label legibility** — no viewBox-edge clamping or overlap avoidance on marker text; near-coincident fixture coordinates collide. Deferred; a visual pass on the real render is advised before the demo.
- **Fixture ↔ demo-seed drift** — `geo.ts` coordinates for backend `demo_seed.py` refs are kept in sync by hand (a comment-pinned `DEMO_SEED_REFS` list guards the frontend side only). Adding a new backend demo entity without a `geo.ts` entry silently drops its marker.
- **`oversized` spec** (~2.1k tokens) — flagged in frontmatter, carried per workflow.
- **Scope** — this run delivered Story 4.1 only; 4.2 (agent-action stage rail) and Epic 3 stories 3.3–3.5 remain (handled by the surrounding `/loop`).
