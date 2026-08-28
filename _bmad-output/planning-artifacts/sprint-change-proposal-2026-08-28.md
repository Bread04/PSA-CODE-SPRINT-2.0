---
title: Sprint Change Proposal — Geographic MapPanel + Agent-Action Visualisation
date: 2026-08-28
author: Braed (via Correct Course workflow)
status: approved
approved_by: Braed
approved_date: 2026-08-28
map_implementation_decision: "Option A — d3-geo vector basemap (recommended; can be revisited if a slippy-map feel is wanted with fully bundled tiles)"
mode: batch
change_scope: Moderate-to-Major (amends UX Design Contract + PRD Responsible-AI framing; adds one demo-critical epic; implementation is frontend-contained)
---

# Sprint Change Proposal

## Section 1 — Issue Summary

**Problem statement.** During end-to-end runs of the Live Console, a viewer cannot easily see *what the AI is doing*. The only surface for agent activity today is `ExecutionTrace` (Story 2.5) — a reverse-chronological text log of `INGEST / CORRELATE / AGENT_CALL / SYNTHESIZE / …` rows. There is no spatial or pipeline representation of an incident unfolding. Separately, `MapPanel` (Story 2.7) is a fixed hand-drawn SVG that never reacts to incident state, so it adds little realism to the demo.

**Requested change (confirmed with Braed, 2026-08-28).**
1. Turn the map into a **real geographic map** of the Singapore Strait / Tuas terminal.
2. Drive it from **mock incident data** so incidents play out spatially (affected berth/crane/yard block/vessel light up, keyed to the selected incident and its trace progress).
3. Treat the map as an **integrated agent-action visualisation** — the same surface makes "what the agents did" legible, not just "where".
4. Timing: **demo must-have**, prioritised above the Epic 3 Day-5 stretch items.
5. Preference stated: a **real map library + tiles** (e.g. Leaflet / Mapbox).

**How it was discovered.** Internal review of the console ahead of the demo/pitch (post-Epic-2 retro, which is `accepted`). Triggering story: **Story 2.7 — MapPanel** (`status: done`).

**Issue category.** New requirement emerged (presentation/demo need) **+** partial reversal of a deliberate design decision (UX-DR7 made the map intentionally static and non-geographic).

**Supporting evidence.**
- `spec-2-7-mappanel.md` — Intent: *"it must never be mistaken for live vessel tracking (UX-DR7)"*; Never-list: *"No external map library, tile source, icon library, or image asset; no network request"*, *"No incident, vessel, position, or coordinate data wired in"*, *"No pan / zoom / drag / click handlers"*. Caption wording (`"not live AIS"`, `"illustrative"`, and the *absence* of `real-time|live positions|tracking|current location`) is **pinned in tests** as "the load-bearing AC".
- `epics.md` — UX-DR7: *"read-only strait/yard illustrative view … captioned to state that positions are illustrative, not live AIS."*
- `DESIGN.md` §Components — *"Map/plan panels — blueprint-framed custom map views … No icon library: all iconography is hand-drawn primitives."*
- `EXPERIENCE.md` — *"Read-only illustrative view (no pan/zoom required) … Not the primary decision surface."*
- `prd.md` §Future Extensions — *"Strait-Level Multi-Vessel Collision Avoidance (AIS/VTS-fused) … Claiming a working version … would be a Responsible-AI liability in front of judges, not a strength. State them as roadmap, never as demoed capability."*
- `prd.md` FR19 rationale — *"a live external dependency is unacceptable demo risk (if [it] is slow or unreachable during judging, the golden path breaks with it)."*
- **Design-canvas precedent (in our favour):** `ux-designs/.../imports/portwatch-console-design/pw-map.js` already sketches `pw-strait-map` as *"real Natural Earth geometry (world-atlas 110m) via d3-geo, Mercator-fit to the Singapore Strait … **No pan, no zoom, no tiles** … **Mocked positions, not a live AIS feed.**"* — real geometry was always envisioned; Story 2.7 down-scoped it to hand-drawn SVG for time.

---

## Section 2 — Impact Analysis

### 2.1 Change-navigation checklist results

| # | Item | Status | Finding |
|---|------|--------|---------|
| 1.1 | Triggering story | ✅ Done | Story 2.7 (MapPanel), `done`. |
| 1.2 | Core problem defined | ✅ Done | New demo requirement + partial reversal of UX-DR7. |
| 1.3 | Evidence gathered | ✅ Done | See Section 1. |
| 2.1 | Current epic completable as planned? | ⚠️ Action-needed | Epic 2 is `done`/`accepted`; do **not** reopen. Superseding work goes in a new epic. |
| 2.2 | Epic-level changes | ⚠️ Action-needed | Add **Epic 4 — Operator Visibility (demo-critical)**. |
| 2.3 | Remaining epics impacted | ✅ Done | Epic 3 unaffected in content; Epic 4 sequences **before** Epic 3 stretch items. |
| 2.4 | Epics invalidated / new needed | ✅ Done | None invalidated; one new epic. |
| 2.5 | Re-sequence / re-prioritise | ⚠️ Action-needed | Epic 4 is P0 (demo-blocking); Epic 3 stays Day-5 stretch. |
| 3.1 | PRD conflict | ⚠️ Action-needed | No FR conflict, but Responsible-AI framing (§Future Extensions, §5, §6) must be extended so a geographic map reads as intentional scoping, not an AIS/tracking claim. |
| 3.2 | Architecture conflict | ⚠️ Action-needed | AD-6 (poll read-only API) is respected — **no new endpoint**. Needs an entity→coordinate fixture. "Real map library + tiles" breaks Story 2.7's "no external library / no network request" and reintroduces a live-dependency demo risk. |
| 3.3 | UX/UI conflict | ⚠️ Action-needed | UX-DR7 rewrite; DESIGN.md + EXPERIENCE.md edits; new UX-DR13 for agent-action visualisation; a11y text-equivalent required. |
| 3.4 | Other artifacts | ⚠️ Action-needed | `package.json` (+deps), CI must stay green, Story 2.7 test assertions carried forward, README Conventions note re: vendored map assets. |

### 2.2 Epic impact

- **Epic 1 (`done`)** — Backend pipeline unaffected. The map reads existing `GET /incidents` data. Only optional touch: expose per-incident affected-entity identifiers if not already present in the incident shape (verify; likely already there via `Incident` entity keys used by `IncidentRegistry`/AD-5). No golden-path code changes.
- **Epic 2 (`done`, `accepted`)** — `MapPanel` (Story 2.7) is **superseded but retained** as a fallback/degraded component. No revert. Epic 2 stays closed.
- **Epic 3 (`backlog`)** — Content unchanged. New Epic 4 is sequenced ahead of it because Braed classified this as demo-must-have, not stretch.
- **New Epic 4 — Operator Visibility (demo-critical)** — two stories (below).

### 2.3 Artifact conflicts

| Artifact | Conflict | Required change |
|----------|----------|-----------------|
| `prd.md` | §Future Extensions parks AIS/VTS vessel tracking as vision-only "Responsible-AI liability"; a tiled map with vessel markers can *look* like that capability. FR19 rationale rejects live external deps as demo risk. | Add a scoping note (new §6-style paragraph): the geographic map is an **illustrative visualisation of mock incident state**, explicitly **not** an AIS/VTS feed, no vessel-tracking claim, **no runtime network dependency**. |
| `ARCHITECTURE-SPINE.md` | AD-6 (poll-only) fine. No fixture for entity coordinates. "Library + tiles" ⇒ external asset + likely network fetch, contradicting Story 2.7's frozen "no network request" and the PRD's demo-risk stance. | (a) Add `frontend/src/lib/geo.ts` — static map of entity id (berth/crane/yard-block/vessel) → `{lat,lng}` for the demo-seed incidents. (b) New note: map assets (basemap geometry or tiles) are **vendored/bundled**, zero runtime network calls. No new backend endpoint. |
| `DESIGN.md` | §Components "Map/plan panels" = "hand-drawn custom map views", "No icon library". | Update that line: geographic vector basemap allowed for the map panel only; zero-radius / token-colour discipline still applies to all chrome around it; markers are token-coloured primitives. |
| `EXPERIENCE.md` | Map row: "Read-only illustrative view (no pan/zoom required) … Not the primary decision surface." | Keep "not the primary decision surface" (Responsible-AI guardrail: operators act on the **approval banner + incident detail**, never the map). Update to allow incident-driven markers and optional pan/zoom; caption obligation unchanged. |
| `epics.md` UX-DR7 | Rewrite (see Section 4). | — |
| `epics.md` UX-DRs | Add **UX-DR13** — agent-action visualisation (pipeline/stage legibility layer). | — |
| Story 2.7 tests | Literal `"not live AIS"` / `"illustrative"` assertions + forbidden `tracking|real-time|live positions|current location`. | Carry **all** of these assertions into the new component's test suite unchanged. |
| `frontend/package.json` + `.github/workflows/ci.yml` | New dependency; `npm run verify` (lint + build + test) must stay green. | Add deps; keep the token/hex/`border-radius` guardrail (scoped exemption only for a vendored map stylesheet if the tiled path is chosen). |

### 2.4 Technical impact — the "real map" implementation choice

Two ways to satisfy "a real map":

| | **Option A — d3-geo vector (recommended)** | **Option B — Leaflet + offline/bundled tiles** |
|---|---|---|
| What renders | Inline `<svg>` of real Singapore Strait coastline (bundled TopoJSON, e.g. `world-atlas` 110m or a trimmed local extract), Mercator-fit; markers = token-coloured `<circle>`/`<rect>` primitives. | Leaflet map widget with a **vendored** raster/vector tile set (PMTiles or a static basemap image); markers via Leaflet layers. |
| Matches design canvas? | ✅ This is exactly what `pw-map.js` already specifies ("real Natural Earth geometry via d3-geo … no tiles"). | ⚠️ New direction; canvas explicitly says "no tiles". |
| Design-system fit | ✅ Inline SVG drops into `BlueprintPanel`; existing token/zero-radius CSS scan applies unchanged. | ⚠️ Leaflet injects its own DOM + CSS (rounded controls, attribution bar); needs override work to fit UX-DR1. |
| Network at runtime | ✅ None (bundled JSON). | ⚠️ None **only if** tiles are fully vendored; easy to regress to a CDN/tile-server call = demo risk. |
| a11y | ✅ Single `role="img"` + full-sentence text equivalent (the `pw-map.js` `label()` pattern). | ⚠️ Tiled slippy maps are harder to give a meaningful text equivalent. |
| New deps | `d3-geo`, `topojson-client`, a bundled atlas JSON (~100 KB). | `leaflet` + `@types/leaflet` + tile/pmtiles plugin + vendored tile asset (MBs). |
| Pan/zoom | Optional, easy to omit (design says not required). | Built-in (can be locked). |
| Effort | Medium | Medium-High |
| Demo risk | Low | Medium |

**Recommendation:** Option A. It is a genuine geographic map (real coastline, real Strait, real Tuas/Pasir Panjang positions), it is what the team's own design canvas already drew, it keeps the blueprint aesthetic and the a11y/test discipline, and it has **no runtime network dependency**. Option B remains available if Braed wants a slippy-map feel — but only with fully bundled tiles and the CSS/a11y work budgeted.

### 2.5 Responsible-AI / pitch guardrails (must hold under either option)

- Caption keeps the pinned wording: contains `"illustrative"` and `"not live AIS"`; must **not** contain `real-time` / `live positions` / `tracking` / `current location`. Add: "positions are mock incident state, not a vessel-tracking feed."
- The map is **not** the decision surface. Approve/Reject/Modify stays on the approval banner + incident detail (UX-DR4).
- Pitch/slides + demo narration: describe it as "a visualisation of the mock incident the agents are resolving", never "we track vessels". Hand this to the presentation pass (PRD Open Item already flags `bmad-cis-agent-presentation-master`).
- Marker movement (if any) is driven by `progress` in mock state, not interpolated "positions over time" that imply real motion tracking.

---

## Section 3 — Recommended Approach

**Selected path: Option 1 — Direct Adjustment (Hybrid).**
Add a new demo-critical epic with two additive, frontend-contained stories, plus targeted amendments to the UX Design Contract, the PRD Responsible-AI framing, and the Architecture Spine. No rollback. No MVP change.

**Why this path:**
- **Option 2 (Rollback)** — Not applicable. Nothing needs reverting; `MapPanel` (2.7) stays as the fallback component.
- **Option 3 (MVP review)** — Not needed. All 16 core FRs, NFR1-3, and the golden path are untouched; this is additive presentation value.
- **Option 1** — Contains the change to the frontend + docs, keeps Epic 2 closed, keeps the golden-path freeze intact (backend change limited to a **frontend-side** coordinate fixture; verify no `Incident` shape change is needed), and lets the Responsible-AI framing be updated deliberately rather than discovered by a judge.

**Effort:** Medium (2 frontend stories + doc amendments).
**Risk:** Medium — new dependency, design-system friction (higher for Option B), and the Responsible-AI perception risk, all mitigated above.
**Timeline impact:** Absorbs demo-prep time that would otherwise go to Epic 3 stretch items; Epic 3 stretch ranking slips accordingly. Golden path unaffected.

---

## Section 4 — Detailed Change Proposals

### 4.1 UX-DR7 — rewrite (`epics.md`)

```
OLD:
UX-DR7: MapPanel component — read-only strait/yard illustrative view rendered
inside a blueprint panel, captioned to state that positions are illustrative,
not live AIS.

NEW:
UX-DR7: MapPanel component — a geographic strait/terminal view rendered inside a
blueprint panel from mock incident state. Real Singapore Strait / Tuas basemap
(bundled vector geometry; no runtime network call). Renders the selected
incident's affected entities (berth / crane / yard block / vessel) as
token-coloured primitive markers, and updates as the incident's trace progresses.
Read-only for decisions — it is NOT the decision surface (that stays the approval
banner + incident detail, UX-DR4). Pan/zoom optional and lockable. Caption still
states the view is illustrative and NOT live AIS, and carries no wording implying
real-time / tracked vessel positions; adds that positions are mock incident state,
not a vessel-tracking feed. Single role="img" node with a full-sentence text
equivalent (UX-DR11). Story 2.7's caption-wording test assertions are carried
forward unchanged.
Rationale: demo legibility — an operator/judge needs to see the incident the
agents are resolving, spatially. Real geometry was always in the design canvas
(pw-map.js); Story 2.7 down-scoped it for time.
```

### 4.2 New UX-DR13 (`epics.md`)

```
NEW:
UX-DR13: Agent-action visualisation — the console makes the pipeline the agents
run legible as it happens, not only as a text log. A stage rail keyed to the
SCREAMING_SNAKE stage vocabulary (INGEST / CORRELATE / AGENT_CALL x3 /
SYNTHESIZE / CONFIDENCE / POLICY_DECISION / DG_CHECK / APPROVAL / EXECUTE /
VERIFY) reflects the selected incident's trace progress; the map's entity
markers change state in step (e.g. a crane marker enters "analysing" then
"action applied"). ExecutionTrace (UX-DR5) remains the authoritative detailed
log; this is a complementary at-a-glance layer. Derived entirely from the
existing polled trace data (AD-6) — no new endpoint, no new backend state.
Colour is never the sole signal (UX-DR11): stage state also carries a label
and a shape change.
```

### 4.3 PRD amendment (`prd.md`, new paragraph after §6 Compliance Note)

```
NEW — §6a. Visualisation scoping note.
`[ASSUMPTION]` The console's geographic map is an illustrative visualisation of
mock incident state built for the demo — it renders bundled basemap geometry and
mock entity positions, updates from the same polled incident trace the rest of
the dashboard uses, and makes no live network call. It is explicitly NOT an
AIS/VTS feed and carries no vessel-tracking claim; the "Strait-Level Multi-Vessel
Collision Avoidance" item in Future Extensions remains vision-only and un-demoed.
State this in the architecture-explanation deliverable and the pitch so the map
reads as intentional scoping, not an implied real-time tracking capability.
```

### 4.4 Architecture Spine amendment (`ARCHITECTURE-SPINE.md`, new invariant)

```
NEW — AD-17. Map surface is a bundled, read-only projection of polled incident state
- Binds: FR15, UX-DR7, UX-DR13, AD-6
- Prevents: a live tile/geo dependency becoming a demo failure point; the map
  becoming a second write path or a second source of incident truth.
- Rule: the map panel renders from the same GET /incidents poll (AD-6) — no new
  endpoint, no SSE. Basemap geometry (and tiles, if the raster option is chosen)
  are vendored into the frontend bundle; zero runtime network calls to any map or
  tile service. Entity → coordinate resolution is a static frontend fixture
  (frontend/src/lib/geo.ts) covering the demo-seed incidents; adding an entity
  means editing the fixture, never a backend change. The map is read-only and is
  not a decision surface (UX-DR4 holds).
```

### 4.5 DESIGN.md edit

```
OLD (§Components):
- Map/plan panels — blueprint-framed custom map views (strait map, yard/plan
  view), captioned below the frame.

NEW:
- Map/plan panels — blueprint-framed map views. The strait view uses a real,
  bundled vector basemap (Singapore Strait coastline); the yard/plan view stays a
  hand-drawn schematic. Both carry incident-driven, token-coloured primitive
  markers and a caption below the frame. Zero-radius / token-colour discipline
  applies to all panel chrome; the only exemption is vendored basemap geometry.
```

### 4.6 EXPERIENCE.md edit

```
OLD (Interaction Primitives table, Map/yard panel row):
Read-only illustrative view (no pan/zoom required); caption states what's shown.
Not the primary decision surface — the approval banner and incident detail carry
the actual decision-relevant facts in text.

NEW:
Geographic, incident-driven view — shows the selected incident's affected
entities on a real Strait/terminal basemap and updates as its trace progresses.
Pan/zoom optional and lockable. Still NOT the primary decision surface — the
approval banner and incident detail carry the decision-relevant facts in text;
the map is orientation and demo legibility, not the thing an operator acts on.
Caption states the view is illustrative and not live AIS / not vessel tracking.
```

### 4.7 New Epic 4 (`epics.md` + `sprint-status.yaml`)

```
### Epic 4: Operator Visibility (demo-critical)
The console makes an in-flight incident legible at a glance — spatially (a real
Strait/terminal map driven by mock incident state) and procedurally (a stage
rail showing where in the agent pipeline the incident is). Additive, frontend-
contained, reads only the existing polled trace data. Priority: P0 / demo-
blocking — sequenced BEFORE Epic 3's Day-5 stretch items. Does NOT touch the
golden-path backend (AD-17).
FRs covered: none new — realises UX-DR7 (rewritten), UX-DR13 (new), FR15.

Story 4.1: Geographic MapPanel
As an operator, I want the map to show the real Singapore Strait / Tuas terminal
with the selected incident's affected entities marked, so that I can see where an
incident is happening — without it being or implying a live vessel-tracking feed.
AC:
- Given the Live Console renders, when an incident is selected, then the map shows
  a real bundled Strait/terminal basemap with token-coloured markers for that
  incident's affected berth / crane / yard block / vessel, positioned from
  frontend/src/lib/geo.ts.
- Given the selected incident's trace advances, when the map re-renders on the
  next poll, then affected-entity markers reflect the current stage (e.g.
  analysing → action applied).
- Given either map variant, when the caption is shown, then it states the view is
  illustrative and not live AIS, contains none of
  real-time|live positions|tracking|current location, and adds that positions are
  mock incident state — assertions carried verbatim from Story 2.7's test.
- Given the map, when inspected, then it is a single role="img" node with a
  full-sentence text equivalent, no runtime network request is made (asserted via
  a fetch spy), and npm run verify stays green.
- Given no incident is selected, when the console renders, then the map shows the
  basemap with no incident markers (degraded-safe, matches Story 2.7 default).

Story 4.2: Agent-action stage rail
As an operator, I want a compact stage rail showing where the selected incident
is in the agent pipeline, so that I can follow what the AI is doing without
reading the full trace log.
AC:
- Given a selected incident, when its trace is polled, then a stage rail renders
  the pipeline stages (INGEST … VERIFY) with the reached stages marked done, the
  current stage active, and error stages marked with label + shape (not colour
  alone), derived only from trace entries.
- Given the incident completes, when VERIFY is reached, then the rail shows the
  terminal state and the ExecutionTrace log remains the authoritative detail
  (UX-DR5 unchanged).
- Given the rail, when navigated by keyboard / screen reader, then each stage is
  announced with its state; the rail adds no new interactive controls.
- Given App-level tests, when they run, then the composed console renders the rail
  + map for a selected fixture incident and updates on selection change.
```

`sprint-status.yaml` — add:
```
  epic-4: backlog
  4-1-geographic-map-panel: backlog
  4-2-agent-action-stage-rail: backlog
  epic-4-retrospective: optional
```
(Placed after `epic-2-retrospective`, before `epic-3`, to reflect P0 sequencing. Epic 3 entries unchanged.)

### 4.8 Story 2.7 — annotate as superseded

Add to `spec-2-7-mappanel.md` frontmatter / Spec Change Log:
```
superseded_by: Epic 4 Story 4.1 (Geographic MapPanel). 2.7's component is retained
as the yard/plan schematic and as the no-incident-selected fallback; its caption-
wording test assertions are carried forward into 4.1 unchanged.
```

---

## Section 5 — Implementation Handoff

**Change scope classification: Moderate → Major on the documentation side.**
It amends a spine companion (the UX Design Contract), touches PRD Responsible-AI framing, and adds an epic — but the code is contained to the frontend plus a frontend fixture.

| Recipient | Responsibility | Deliverables |
|-----------|----------------|--------------|
| **PM / Architect** (John / Winston) | Ratify UX-DR7 rewrite, new UX-DR13, PRD §6a note, Spine AD-17, DESIGN.md + EXPERIENCE.md edits. Confirm no `Incident` shape change is needed (entity ids already present). Decide Option A (d3-geo vector) vs Option B (bundled tiles). | Updated `epics.md`, `prd.md`, `ARCHITECTURE-SPINE.md`, `DESIGN.md`, `EXPERIENCE.md`; `sprint-status.yaml` with Epic 4. |
| **Frontend dev** (Amelia / `bmad-build`) | Implement Story 4.1 then 4.2. Add `frontend/src/lib/geo.ts`. Vendor basemap geometry (or tiles). Carry Story 2.7 caption assertions forward. Keep `npm run verify` green. Add App-level tests. | New `MapPanel` (geographic) + `StageRail` components; passing CI; `MapPanel` (2.7) retained as fallback/yard schematic. |
| **Presentation pass** (`bmad-cis-agent-presentation-master`) | Align slide + demo narration with §6a: "visualisation of the mock incident the agents are resolving", never "vessel tracking". | Narration/slide note. |
| **Checkpoint** (`bmad-checkpoint-preview`) | Human review of the Epic 4 branch before it merges near the frozen golden path. | Review sign-off. |

**Success criteria:**
- Selecting an incident shows its affected entities on a real Strait/terminal basemap; markers advance with trace progress.
- A stage rail makes the agent pipeline legible without reading the full log.
- Caption honesty assertions (from Story 2.7) still pass; no runtime network call; `npm run verify` green; App-level tests cover the composed view.
- PRD/UX/Spine docs updated so a judge reads the map as intentional scoping, not an AIS claim.
- Golden path (Epic 1) and its Day-3 freeze untouched.

**Sequencing / dependencies:**
1. PM/Architect ratifies docs + picks Option A/B.
2. Frontend: Story 4.1 (map) → Story 4.2 (stage rail).
3. Presentation pass folds in the framing.
4. Checkpoint review before merge.
Epic 3 Day-5 stretch items slip behind Epic 4.

---

## Open questions for approval

1. **Option A (d3-geo vector, recommended) or Option B (bundled tiles)?** Braed's stated preference is a library + tiles; the analysis recommends vector for demo-safety, design-system fit, and a11y. Needs a decision at approval.
2. **Demo data source** — the Epic 2 retro's open question ("run the demo against fixtures or a live backend?") is now more pointed: the map + rail read the same polled trace either way, but the entity-coordinate fixture assumes the demo-seed incident set. Confirm the demo runs the seeded incidents.
3. **Epic placement** — new Epic 4 (this proposal) vs. two P0 stories prepended to Epic 3. Epic 4 keeps Epic 3's "stretch" semantics clean; confirm preference.

---

## Approval & applied changes (2026-08-28)

**Approved by Braed, 2026-08-28.** Map implementation: **Option A (d3-geo vector)**.

Planning artifacts updated in this session:

| File | Change |
|------|--------|
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Added `epic-4: backlog` with `4-1-geographic-map-panel`, `4-2-agent-action-stage-rail`, `epic-4-retrospective: optional` — placed before `epic-3` to reflect P0 sequencing. |
| `_bmad-output/planning-artifacts/epics.md` | UX-DR7 rewritten; UX-DR13 added; Epic 4 summary added to Epic List; full Epic 4 section with Stories 4.1 and 4.2 added. |
| `_bmad-output/planning-artifacts/prds/.../prd.md` | Added §6a Visualisation Scoping Note. |
| `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` | Added invariant AD-17. |
| `_bmad-output/planning-artifacts/ux-designs/.../DESIGN.md` | "Map/plan panels" component line revised. |
| `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md` | "Map / yard panel" interaction row revised. |
| `_bmad-output/implementation-artifacts/spec-2-7-mappanel.md` | `superseded_by` frontmatter + Spec Change Log entry added. |

**Not yet done (implementation handoff):** Stories 4.1 and 4.2 code, `frontend/src/lib/geo.ts`, vendored basemap TopoJSON, new deps in `frontend/package.json`. Route to a fresh `bmad-build` session per story. Then presentation-narrative alignment (`bmad-cis-agent-presentation-master`) and a `bmad-checkpoint-preview` before merge.
