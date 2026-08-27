---
title: 'Story 2.7: MapPanel'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '125c9a7cd251e9ad390520119420d1b1721aa5c1'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-6-askportwatch-natural-language-query.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md'
warnings: []
deferred:
  - summary: >-
      MapPanel caption legibility relies on opacity 0.6, which likely falls below the WCAG
      4.5:1 body-text contrast threshold for this load-bearing "not live AIS" disclaimer.
    evidence: |-
      .map-panel__caption uses opacity: 0.6 on var(--text). The same dimming pattern is
      used codebase-wide for secondary text (mockup .map-caption 0.6, ExecutionTrace
      __time 0.55, IncidentFeed confidence-reason lines), so a fix is a shared muted-text
      token decision, not a MapPanel-only change. tokens.css currently defines no
      contrast-validated --text-muted / --text-secondary token.
    location: >-
      frontend/src/components/MapPanel/MapPanel.css  (.map-panel__caption)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** An operator looking at an incident has no spatial reference for the strait / yard it concerns. The Live Console needs an illustrative map panel — but it must never be mistaken for live vessel tracking (UX-DR7).

**Approach:** Add `MapPanel`, a presentational component rendered inside the shared `BlueprintPanel` primitive (Story 2.2). It draws a hand-built inline SVG schematic (water/strait outline, berth boxes, ship rectangles, crane line-groups — no icon library) and a visible caption that explicitly states the view is illustrative and NOT live AIS / real-time positions. It is fully read-only: no pan, no zoom, no interactivity, no incident-driven data. A `variant` prop switches between a `"strait"` scene and a `"yard"` scene; both are captioned the same way. Mounted in the Live Console centre column below `IncidentDetail` in the existing `App.tsx` demo shell.

## Boundaries & Constraints

**Always:**
- Component at `frontend/src/components/MapPanel/` with `MapPanel.tsx`, `MapPanel.css`, `MapPanel.test.tsx`, `index.ts`.
- Props: `{ variant?: 'strait' | 'yard'; className?: string }`. `variant` defaults to `'strait'`. No other props; no incident/data props.
- Renders `<BlueprintPanel as="section" aria-label="Illustrative map">` containing (in order): an `<h3>` heading ("Strait Map" for `strait`, "Yard Plan" for `yard`); the inline `<svg>`; then the caption element.
- The `<svg>` has `role="img"`, an `aria-label` describing the scene ("Illustrative schematic of the strait approach" / "Illustrative schematic of the terminal yard"), `focusable="false"`, and a `viewBox`. Every decorative child shape is inert; the SVG has no `<script>`, no event handlers, no `<image>`/`<use href>` to an external asset, no icon-font.
- All SVG geometry is hand-authored primitives only: `<rect>`, `<line>`, `<polyline>`, `<polygon>`, `<path>`, `<circle>`. Fills/strokes use `currentColor` or a `var(--*)` token via CSS classes — no raw hex in the TSX or CSS.
- Caption: a visible `<p class="map-panel__caption">` whose text contains, verbatim, the phrase "not live AIS" AND the word "illustrative" (case-insensitive match acceptable in tests). Example: "Illustrative schematic — vessel and berth positions are approximate and not live AIS data." The caption must NOT contain wording implying real-time tracking (no "live positions", "real-time", "current location", "tracking").
- `MapPanel.css`: colours via `var(--*)` only; `border-radius: 0` (or `var(--radius-*)`); px only for structural sizes. Verified by a static CSS scan in the test (same technique as Stories 2.1–2.6): no raw hex, no named CSS colours, every `border-radius` is `0`/`var(--radius-*)`.
- Accessibility floor (UX-DR11): the panel is a labelled `region`; the SVG is a single `role="img"` node (screen readers announce the `aria-label`, not the individual shapes). No colour-only meaning is conveyed (the panel carries no severity/state signal at all).
- Voice & tone (UX-DR12): caption is plain and factual, no exclamation, no emoji.
- `App.tsx`: render `<MapPanel />` (default `strait` variant) inside the centre `<section>`, directly below `<IncidentDetail>`. Keep the demo shell otherwise unchanged; update the shell comment to mention Story 2.7.

**Block If:**
- `BlueprintPanel` does not accept `as` + arbitrary `aria-*` props as Story 2.2 documents.

**Never:**
- No pan / zoom / drag / click handlers / tooltips / hover-reveal on the map.
- No incident, vessel, position, or coordinate data wired in — the scene is fixed illustrative geometry.
- No external map library, tile source, icon library, or image asset; no network request.
- No KillSwitchControl or archive route — those are 2.8–2.9.
- Do not touch `backend/`.
- Caption must never imply the positions are real / live / tracked.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default variant | `<MapPanel />` | renders a `region` "Illustrative map" containing an `<h3>` "Strait Map", one `role="img"` `<svg>`, and the caption | n/a |
| Yard variant | `<MapPanel variant="yard" />` | `<h3>` "Yard Plan"; SVG `aria-label` mentions the yard; caption unchanged in its illustrative/not-live-AIS wording | n/a |
| Caption honesty | either variant | caption text contains "illustrative" and "not live AIS"; does NOT contain "real-time" / "live positions" / "tracking" / "current location" | n/a |
| Read-only | render, then query the panel | no `button`, no `onClick`, no element with `tabindex` > -1 inside the map; SVG `focusable="false"` | n/a |
| Single img node | render | exactly one `[role="img"]` inside the panel; decorative shapes are not separately in the a11y tree | n/a |
| No external refs | render | SVG markup has no `<script>`, no `href`/`xlink:href`, no `<image>`, no `<use>` | n/a |
| className passthrough | `<MapPanel className="x" />` | root panel has both `blueprint-panel` and `x` classes | n/a |
| CSS token scan | read `MapPanel.css` | no raw hex, no named colours, `border-radius` only `0`/`var(--radius-*)` | n/a |

</intent-contract>

## Code Map

- `frontend/src/components/BlueprintPanel/BlueprintPanel.tsx` -- `<BlueprintPanel as="section" className aria-label>`; merges caller `className`, spreads `aria-*`, renders 4 `.blueprint-panel__corner` marks.
- `frontend/src/components/ExecutionTrace/ExecutionTrace.tsx` + `.css` + `.test.tsx` -- nearest sibling pattern: BlueprintPanel wrapper, `<h3>` heading, className-only TSX, token-only CSS, `readFileSync` static CSS scan test.
- `frontend/src/theme/tokens.css` -- available tokens: `--surface`, `--divider`, `--text`, `--accent-100..900`, `--neutral-*`, `--space-1..8`, `--radius-*`, `--font-heading`, `--font-size-micro-label`, `--letter-spacing-micro-label`. No body font-size token (use literal px like siblings).
- `frontend/src/App.tsx` -- centre `<section style={{ flex: 1 }}>` currently renders `<IncidentDetail …/>`; add `<MapPanel />` below it.
- `_bmad-output/planning-artifacts/ux-designs/.../DESIGN.md` (137, 145) -- map panels use custom inline SVG primitives (ship rectangles, crane line-groups, berth/yard boxes), blueprint-framed, captioned below the frame; no icon library.
- `_bmad-output/planning-artifacts/ux-designs/.../EXPERIENCE.md` (56) -- read-only illustrative view, no pan/zoom, caption states what's shown; not the primary decision surface.
- `.../mockups/live-console.html` (108-109, 179-180) -- reference: `.map-caption` 11px opacity .6 "… — illustrative, not live positions"; `.map-box` 150px framed box. This spec upgrades the placeholder box to a real inline-SVG schematic and the caption to explicit "not live AIS" wording.

## Tasks & Acceptance

**Execution:**
- `frontend/src/components/MapPanel/MapPanel.tsx` -- `function MapPanel({ variant = 'strait', className }: MapPanelProps)`: `<BlueprintPanel as="section" className={['map-panel', className]…} aria-label="Illustrative map">` → `<h3 className="map-panel__heading">` (variant title) + `<svg className="map-panel__svg" role="img" aria-label=… viewBox="0 0 320 180" focusable="false">` with a small `strait` scene (water polyline, 2–3 ship `<rect>`s, berth boxes) and a `yard` scene (grid of yard-block `<rect>`s, crane line-groups as `<polyline>`s) selected by `variant` + `<p className="map-panel__caption">` illustrative/not-live-AIS text. Export `MapPanelProps`.
- `frontend/src/components/MapPanel/MapPanel.css` -- `.map-panel`, `.map-panel__heading` (Barlow Condensed micro-label), `.map-panel__svg` (block, `width: 100%`, `height: auto`, `max-height` px, stroke/fill classes using `var(--divider)` / `var(--accent-600)` / `currentColor`), `.map-panel__caption` (`var(--text)`, reduced opacity, small px). Colours via tokens; `border-radius: 0`.
- `frontend/src/components/MapPanel/index.ts` -- `export { MapPanel, default } from './MapPanel'; export type { MapPanelProps } from './MapPanel';`
- `frontend/src/components/MapPanel/MapPanel.test.tsx` -- RTL/jsdom + `readFileSync` CSS scan covering every I/O matrix row: default/yard headings & svg aria-label; caption contains "illustrative" + "not live AIS" and excludes the forbidden real-time phrasings; exactly one `[role="img"]`; no `button`/`onClick`/positive `tabindex`; svg `focusable="false"` and markup free of `<script>`/`href`/`<image>`/`<use>`; `className` passthrough; CSS scan (no hex, no named colours, radius `0`/token).
- `frontend/src/App.tsx` -- import + render `<MapPanel />` below `<IncidentDetail>` in the centre column; update the shell comment to "Stories 2.1–2.7".

**Acceptance Criteria:**
- Given the Live Console renders, when the map panel appears, then it is inside the shared `BlueprintPanel` (1px border + four corner marks), read-only, with no pan/zoom/click affordances.
- Given the map panel's caption, when displayed, then it explicitly states the view is illustrative and not live AIS data, and contains no wording implying real-time or tracked vessel positions.
- Given `variant="yard"`, when rendered, then the heading and SVG `aria-label` describe the yard scene while the caption keeps the same illustrative/not-live-AIS disclaimer.
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, build, and all suites (2.1–2.6 unchanged, 2.7 new) pass, and every I/O matrix row has a passing assertion.

## Spec Change Log

## Review Triage Log

### 2026-08-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 7: (high 0, medium 0, low 7)
- defer: 1: (medium 1)
- reject: 13
- addressed_findings:
  - `[low]` `[patch]` `App.tsx` shell comment folded `MapPanel` into "(with fixture data and a local selection)" though it has neither — reworded so `MapPanel` is described as static/dataless.
  - `[low]` `[patch]` Panel `region` used a fixed `aria-label="Illustrative map"` (identical for both variants, not matching the visible `<h3>`) — switched to `aria-labelledby` pointing at the heading (the IncidentFeed house pattern); heading given a stable generated id.
  - `[low]` `[patch]` The "not live AIS" caption was not reachable from the `<svg>` for screen-reader users — added `aria-describedby` on the `<svg>` pointing at the caption id.
  - `[low]` `[patch]` Caption `font-size: 11px` was a bare literal though `--font-size-micro-label` (11px) exists and the heading already uses it — routed through the token.
  - `[low]` `[patch]` Variant tests asserted only headings/`aria-label` strings — added structural assertions that the strait scene draws water polylines and the yard scene draws its block-grid `<rect>`s, and ran the "no external refs / no `on*` handlers" and "decorative shapes absent from the a11y tree" checks against BOTH variants.
  - `[low]` `[patch]` `.map-panel__svg { color: var(--text) }` was dead (no shape uses `currentColor`) — removed.
  - `[low]` `[patch]` `className` passthrough did not guard a whitespace-only string — trimmed before joining.
- deferred: caption legibility relies on `opacity: 0.6` which may fall below the WCAG 4.5:1 body-text threshold — real for this load-bearing disclaimer, but it is a codebase-wide muted-text-token question (every sibling: `.map-caption`, `execution-trace__time`, IncidentFeed reason lines use the same 0.55–0.6 opacity), not a defect introduced by this change. Recorded in `deferred` frontmatter.
- rejected (noise / spec-mandated / matches sibling pattern / factually N/A): incident-linked spatial context + locus marker (R2 — out of scope on the authority of the two ACs, UX-DR7, and the epic context, which all specify a static illustrative view); no `<title>` child in the svg (`role="img"` + `aria-label`/`aria-describedby` is sufficient); fixed `<h3>` level (every sibling component hardcodes its heading level; shell is "NOT a real layout"); barrel re-exports `default` + named (matches the Story 2.6 `AskPortwatch` barrel just established); `MapPanelProps` has no `id`/`data-*`/rest passthrough (spec: "No other props"); ships and water share `--accent-600` (cosmetic, no palette mandated); semantic accent alias for dark theme (tokens.css is a fixed light palette, no alias layer); `border-radius: 0` declared redundantly (house CSS-scan convention); `.map-panel` sets `display:flex` on the BlueprintPanel root (matches `.execution-trace` sibling pattern; corner marks are absolutely positioned and unaffected); `&mdash;` entity in JSX (`&apos;` precedent in `AskPortwatch`); spec-2-7 artifact not in the frontend diff (it exists in the tree and is committed with the story); `yard` variant not shown in the app shell (shell is a throwaway harness, one instance is enough to exercise the surface).

## Design Notes

**Why a `variant` prop and not incident-driven:** DESIGN.md names both a strait map and a yard/plan view; the ACs require neither to be data-bound. A two-value enum keeps both scenes in one component without inventing a data contract the story doesn't call for.

**Caption wording lock:** tests assert the literal substring "not live AIS" and the word "illustrative", and assert absence of `/real-time|live positions|tracking|current location/i`. This is the load-bearing AC (UX-DR7) — pin it in tests so a later copy edit can't silently weaken it.

**SVG a11y:** one `role="img"` with an `aria-label` is the whole accessible representation; individual `<rect>`/`<line>` children need no `aria-*` and must not be focusable. `focusable="false"` on the `<svg>` suppresses the legacy IE/Edge tab stop.

## Verification

**Commands:**
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test` -- expected: all suites pass (2.1–2.6 unchanged, 2.7 new); every I/O matrix row covered by a passing assertion; 0 failures.

## Auto Run Result

Status: done

**Implemented change:** Added `MapPanel`, a read-only illustrative strait/yard schematic rendered inside the shared `BlueprintPanel`. Hand-authored inline SVG primitives (water polylines + berth/ship rects for `strait`; a block-grid + crane polylines for `yard`), a single `role="img"` node, and a visible caption that states the view is illustrative and not live AIS data (and contains no real-time/tracking wording). Fully non-interactive; no incident/position data. Mounted in the `App.tsx` demo shell centre column below `IncidentDetail`.

**Files changed:**
- `frontend/src/components/MapPanel/MapPanel.tsx` — new component; `variant?: 'strait' | 'yard'` (default `strait`), `className?` passthrough; region labelled via `aria-labelledby` → heading; svg `aria-describedby` → caption.
- `frontend/src/components/MapPanel/MapPanel.css` — token-only styles, `border-radius: 0`, caption font-size via `--font-size-micro-label`.
- `frontend/src/components/MapPanel/index.ts` — barrel exports.
- `frontend/src/components/MapPanel/MapPanel.test.tsx` — RTL/jsdom + static CSS scan; every I/O matrix row, plus distinguishing-geometry per variant and both security/a11y checks run against both variants.
- `frontend/src/App.tsx` — mount `<MapPanel />`; shell comment updated to 2.1–2.7.

**Review findings breakdown:** 7 patches applied (all low — comment misattribution, region `aria-label`→`aria-labelledby`, svg `aria-describedby` for the disclaimer, caption font-size token, variant-geometry + symmetric test coverage, dead CSS `color`, `className` trim guard). 1 deferred (caption `opacity: 0.6` contrast — codebase-wide muted-text-token decision; see `deferred` frontmatter). 13 rejected (out-of-scope incident-linking, spec-mandated prop shape, sibling-pattern parity, or factually N/A — see Review Triage Log).

**Follow-up review recommended:** true. This pass's patched findings: high 0, medium 0, low 7 → score `1×7 = 7` (≥ 5). All low-severity a11y/test polish; a light follow-up pass is advisory, not blocking.

**Verification performed:**
- `cd frontend && npm run build` → `tsc -b` strict + `vite build` succeed (`✓ built in 267ms`).
- `cd frontend && npm test` → `Test Files 10 passed (10)`, `Tests 365 passed (365)`, 0 failures.
- Matrix Test Audit: every I/O & Edge-Case Matrix row has a covering assertion that ran and passed; verification-gap reviewer found no gaps.

**Residual risks:**
- SVG scenes are verified structurally (shape types/counts, a11y, no external refs), not pixel-rendered — the repo has no visual-snapshot tooling. Geometry is fixed illustrative content, so this matches the story's intent.
- Deferred caption-contrast item should be picked up with a shared muted-text token (affects `MapPanel`, `ExecutionTrace`, `IncidentFeed`).
