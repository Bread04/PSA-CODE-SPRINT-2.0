# Epic 4 Context: Operator Visibility (demo-critical)

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 4 makes an in-flight incident legible at a glance — spatially and procedurally — so an operator or judge can see the incident the agents are resolving without reading the raw text trace. It replaces the fixed hand-drawn map with a real geographic Singapore Strait / Tuas terminal basemap driven by mock incident state, and adds a compact pipeline stage rail showing where the selected incident sits in the agent pipeline. The work is additive, frontend-contained, and reads only the trace data already polled by the rest of the dashboard: no new endpoint, no new backend state, no change to the Epic 1 golden path or its Day-3 freeze. It is P0 / demo-blocking and is sequenced before every Epic 3 Day-5 stretch item. It carries a hard Responsible-AI constraint: the map must read as an intentional, illustrative visualisation of mock state and must never imply an AIS / VTS / vessel-tracking capability.

## Stories

- Story 4.1: Geographic MapPanel
- Story 4.2: Agent-action stage rail

## Requirements & Constraints

- The map renders a real, bundled Singapore Strait / Tuas vector basemap (d3-geo / Natural Earth geometry vendored into the frontend bundle). Zero runtime network calls to any map, tile, or CDN service — asserted with a `fetch` spy in tests.
- Markers are token-coloured SVG primitives (circle / rect) for the selected incident's affected berth / crane / yard-block / vessel only. When no incident is selected, the basemap renders with no markers (degraded-safe).
- Markers change state as the selected incident's trace advances (e.g. analysing -> action applied), re-rendering on the existing 2–3s poll. Marker movement is driven by trace / progress state, never interpolated positions implying motion tracking.
- Entity -> coordinate resolution is a static frontend fixture (`frontend/src/lib/geo.ts`) keyed on the fixed entity-ref id format (`vessel:MSC-ANNA`, `berth:C7-3`, ...), covering the demo-seed incidents. Adding an entity means editing the fixture, never a backend change.
- Caption honesty (load-bearing, test-pinned, carried verbatim from the superseded Story 2.7): the caption must contain "illustrative" and "not live AIS"; must NOT contain "real-time", "live positions", "tracking", or "current location"; and must add that positions are mock incident state, not a vessel-tracking feed.
- The map is read-only and is NOT a decision surface — approve / reject / modify stays on the approval banner + incident detail.
- The stage rail reflects the SCREAMING_SNAKE pipeline vocabulary (INGEST / CORRELATE / AGENT_CALL x3 / SYNTHESIZE / CONFIDENCE / POLICY_DECISION / DG_CHECK / APPROVAL / EXECUTE / VERIFY): reached stages marked done, current stage active, error stages marked, terminal state shown at VERIFY. Derived only from trace entries; it adds no new interactive controls.
- Colour is never the sole signal: both marker state and stage state also carry a text label and a shape change.
- Accessibility: the map is a single `role="img"` node with a full-sentence text equivalent; each rail stage is announced with its state; all interactive elements remain keyboard-operable.
- The superseded Story 2.7 `MapPanel` is retained (not reverted) as the yard / plan schematic and as the no-incident-selected fallback.
- `npm run verify` (lint + build + test) must stay green; the token / hex / border-radius CSS guardrail still applies, with a scoped exemption only for the vendored basemap geometry. App-level tests must cover the composed console rendering rail + map for a selected fixture incident and updating on selection change.

## Technical Decisions

- The map surface is a bundled, read-only projection of the `GET /incidents` poll — the same source the rest of the dashboard uses. It must not become a second write path or a second source of incident truth.
- Implementation is the d3-geo vector approach (real coastline geometry, Mercator-fit, no tiles), not a tile / slippy-map library (Leaflet / Mapbox ruled out for demo-safety, design-system fit, and a11y). New frontend deps: `d3-geo`, `topojson-client`, and a bundled atlas / trimmed extract JSON (~100 KB).
- Frontend stack unchanged: React 19.2.8 / TypeScript / Vite. No backend changes; the `Incident` shape already carries affected-entity ids (`entity_refs`), confirmed sufficient — no schema change needed.
- Design-canvas precedent: `pw-map.js` already specifies `pw-strait-map` as real d3-geo Natural Earth geometry, Mercator-fit to the Singapore Strait, no pan / no zoom / no tiles, "mocked positions, not a live AIS feed", with a `label()` full-sentence text equivalent — this story realises what Story 2.7 down-scoped for time. Note the canvas file fetches its atlas from a CDN; the bundled-geometry / zero-network rule overrides that.
- Pan / zoom is optional and lockable; the design says it is not required, so omitting it is acceptable.

## UX & Interaction Patterns

- The map sits inside the shared blueprint panel; all panel chrome keeps the zero-radius / token-colour discipline.
- Markers draw from the steel-blue accent ramp (+ `accent-2`); there is no red / amber / green vocabulary. State and severity read through label + shape + `accent-900`, position, and dot iconography.
- Microcopy is plain, factual, and non-alarmist, with the same register across all states.
- The stage rail is a complementary at-a-glance layer; `ExecutionTrace` (UX-DR5) remains the authoritative detailed log and is unchanged.
- The map is orientation and demo legibility only; the operator acts on the approval banner + incident detail.
- With concurrent incidents (Epic 3 / FR16), the map and rail show only the selected incident's entities and must not imply another incident's entities belong to it — state comes from that incident's own polled trace.

## Cross-Story Dependencies

- Story 4.1 (map) lands before Story 4.2 (stage rail); 4.2's App-level test covers the composed rail + map view.
- Both depend on Epic 2's delivered components and the incident-selection model of the Live Console: the blueprint panel primitive, `IncidentFeed`, `IncidentDetail`, and the polled per-incident trace endpoint.
- Story 4.1 carries Story 2.7's caption-wording test assertions forward unchanged and retains 2.7's component as the fallback / yard schematic.
- Depends on Epic 1 exposing affected-entity ids on the incident shape (verified present via `entity_refs`); no golden-path code change.
- Epic 4 is sequenced ahead of all Epic 3 Day-5 stretch items (3.2–3.5); Epic 3's core concurrency story (3.1) is independent. The Epic 3 context already assumes the Epic 4 map and rail reflect per-incident state.
- Downstream, non-code: the pitch / demo narration must describe the map as "a visualisation of the mock incident the agents are resolving", never "vessel tracking", and a human checkpoint review is expected before this branch merges near the frozen golden path.
