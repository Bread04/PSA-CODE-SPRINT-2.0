---
title: 'Port portwatch-tuas chrome + primitives into frontend/src'
type: 'feature'
created: '2026-08-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'a6d1d60db2571d44f1d150bcb3bf32c9ed8da8a4'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-29/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The token re-value (commit `a6d1d60`) put the Harbor Signal palette/type on `frontend/src` but left the *chrome* untouched — the shell has no harbor-grid/grain, the rail is a flat column, there is no real topbar, and none of portwatch-tuas's `PortwatchPrimitives` exist. It does not read as `frontend/portwatch-tuas/client/src`.

**Approach:** Match `frontend/portwatch-tuas/client/src`'s chrome and primitives **exactly** — the `.app-shell` grid + grain, the `.app-rail`, the `.topbar`, the `.panel` family (`.panel-header` / `.panel-body` / `.panel-accent` / single `.corner-mark`), `.section-heading` / `.eyebrow`, and every `PortwatchPrimitives` component with portwatch's class names and CSS values. **Visual-conformance tests follow the new design — update or rewrite any assertion that pins the retired blueprint look.** Only genuine *behavioural* contracts are preserved (routing, keyboard focus, screen-reader semantics, reduced-motion). Hand-rolled CSS (no Tailwind/shadcn), `lucide-react` for icons. Also fix the white-map regression (`--geo-land`). Presentation-only — no backend, endpoint, hook, or route-target change.

## Boundaries & Constraints

**Always (matching portwatch-tuas exactly):**
- Every chrome value comes from `frontend/portwatch-tuas/client/src/index.css` / `PortwatchPrimitives.tsx` / `pages/Home.tsx`, transcribed to the values in Design Notes. Where the spine (`ux-PSA CODE SPRINT-2026-08-29/DESIGN.md`) and portwatch-tuas disagree, the spine wins — but they are aligned.
- **Token discipline stays** (it is orthogonal to the design): guardrail #6 in `tokens.test.ts` must pass — no raw `#hex` / CSS named colour in swept `src/**` CSS/TSX, `font-size` via `var(--font-size-*)`, `border-radius` ∈ `{0, var(--radius-*), 9999px}` = `{0,4px,8px,16px,22px,9999px}`, no `opacity:.6`, every `var(--x)` declared. `rgba(...)` literals may stay inline (no hex/named inside). Every new token in BOTH `tokens.css` and `tokens.ts` (`tokens` object + `flattenTokens()`) — parity + exhaustiveness are checked.
- **Radius snap:** portwatch's `5px`/`7px` radii → `var(--radius-sm)` (4) / `var(--radius-md)` (8). No new `--radius-*`.
- `BlueprintPanel` is **re-implemented** to portwatch's `.panel`: one 18px seafoam `::before` L-bracket (top-left) + a **single** `.corner-mark` ⌐ (bottom-right, 9px), plus `.panel-header` / `.panel-body` / `.panel-index` / `.panel-accent` / `.panel-interactive`. The 4 corner dots are gone. `BlueprintPanel.test.tsx`'s static-scan assertions are rewritten to the new treatment (keep its DOM/behaviour its).
- The rail nav renders `.rail-button`-styled elements with portwatch's structure and classes verbatim. Elements stay `<a href="#/">` / `<a href="#/archive">` (our hash routing via `useHashRoute` — not portwatch's `activeView` state); everything else — `.rail-button` class, `min-height`, gradient `.active` bg, `.active::before` glow edge bar, badge `<b>`, icon — matches. `App.test.tsx` nav assertions are updated to the new markup where a query targets changed structure.
- Panel headings become `SectionHeading` (`.section-heading` > `.eyebrow` + `<h2>` + optional `.section-heading__detail` + `action`), matching portwatch. Each panel's `.test.tsx` heading assertion is updated to the new element/eyebrow/text.
- 9 component "token-discipline" `describe` blocks: update the pinned token names/values freely to the new chrome (they exist to enforce *a* design token system, not the blueprint palette). Keep the "no raw hex / every colour a `var()`" spirit.

**Behavioural contracts that stay sacred (never regress these):**
- Routing: `#/` (live) and `#/archive`, driven by `useHashRoute`. No new route/target.
- a11y semantics: `role="navigation"` name `"Primary"`; `role="main"` on live only; `role="banner"` both routes; regions named `Incidents` / `Strait Map` / `Pipeline` / `Agent Roster` / `Incident Archive`; kill switch `role="switch"` name `/autonomous execution/i`; `StageRail` 10 `listitem`s; `ExecutionTrace` `role="log"` `aria-live="polite"`; `aria-current="page"` on the active nav link; collapse `<button>` `aria-expanded` + accessible name `/collapse|expand navigation rail/i`; `AgentRoster` state as text+shape, never colour-only.
- `.app-route` is the programmatic focus target on route change (tabIndex/ref preserved).
- Rail collapse persists via `sessionStorage['portwatch.rail.collapsed']`, storage-throw safe.
- `prefers-reduced-motion: reduce` (global block in `index.css`) covers `dot-pulse` and every new transition; the 1s topbar clock is a state tick (allowed), no other looping animation.
- Hooks unchanged: `useIncidents` / `useApproval` / `useKillSwitch` / `useAskPortwatch` / `useHashRoute`. Single write path (approval + kill-switch).

**Ask First:**
- `lucide-react` as a new dependency (approved in the intent — recorded here so review sees it was deliberate; verify the current version on the web).

**Never:**
- No `backend/` change, no new endpoint, no new write path, no SSE, no new route or route-target change.
- Do NOT port portwatch-tuas features the PRD lacks: workforce/staffing card, fleet tabs + mock vessels, the `api-open.data.gov.sg` radar fetch, the KPI/MetricCard strip (deferred), the fuller map composition — trace/toggles/nodes (deferred; this build only fixes the land fill).
- No Tailwind, no shadcn.
- Do NOT delete a test — rewrite its expectations. Behavioural/a11y its (above) must still pass unchanged.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|---|---|---|---|
| Token parity | `tokens.css` + `tokens.ts` after the chrome tokens | `tokens.test.ts` passes: three-way parity, key-count parity, radius/px hygiene | fails loudly |
| Guardrail sweep | all `src/**` CSS/TSX after the port | zero raw-hex / named-colour / bare-font-size / non-token-radius / undeclared-`var()` | enumerates file:line |
| Shell renders | `<App/>` on `#/` | `.app-shell::before` (grid) + `::after` (grain) rules present; `.app-rail` translucent + `backdrop-filter`; a `.topbar` with `.breadcrumb` + `.live-chip` + `.topbar-time`; nav = 2 `<a>` links, names `Live Console` / `Archive`, hrefs `#/` / `#/archive` | — |
| Panel = portwatch `.panel` | any `BlueprintPanel` rendered | one `::before` L-bracket + one `.corner-mark` in the DOM (not 4 corner spans); `.panel-header` / `.panel-body` when a heading is present | — |
| Rail collapse | click `.app-rail__collapse` | `.app-shell--rail-collapsed` toggles, `aria-expanded` flips, persists across re-mount, storage-throw safe | no throw |
| Topbar clock | `<App/>` mounted | a mono time element renders and updates each second; interval cleared on unmount | — |
| Reduced motion | `prefers-reduced-motion: reduce` | `dot-pulse` + all transitions instant; `index.css` retains the `@media` block | — |
| White-map fix | `GeoMapPanel` rendered | `.geo-map__land` fill = `var(--geo-land)` (dark), `--geo-land` declared in `tokens.css` + `tokens.ts` | — |
| Primitives | import each `PortwatchPrimitives` component | renders with portwatch class names (`.panel`, `.section-heading`, `.status-pill`, `.metric-card`, `.signal-tag`, `.tiny-sparkline`, `.countdown-track`, `.empty-state`, `.link-button`, `.rail-button`, `.corner-mark`); tone classes set only `color` | — |

</frozen-after-approval>

## Code Map

**Target** — `frontend/portwatch-tuas/client/src/index.css` + `components/PortwatchPrimitives.tsx` + `pages/Home.tsx`. Exact values in Design Notes.

- `frontend/src/theme/tokens.css` + `tokens.ts` — add the ~40 chrome tokens (Design Notes table): `--geo-land`, `--panel-border`, `--panel-bg`, `--panel-accent-border`, `--panel-hover-border`, `--panel-bracket`, `--corner-mark-border`, `--rail-bg`, `--rail-border`, `--topbar-bg`, `--topbar-border`, `--chrome-backdrop-blur`, `--grid-line`, `--grid-size`, `--grid-opacity`, `--grain-opacity`, `--nav-active-grad-from/-to`, `--nav-hover-bg`, `--nav-idle`, `--nav-active-text`, `--rail-eyebrow`, `--rail-foot`, `--rail-foot-strong`, `--rail-status`, `--live-chip-border/-bg/-text`, `--breadcrumb`, `--breadcrumb-strong`, `--topbar-time`, `--metric-card-bg`, `--metric-value`, `--eyebrow`, `--status-pulse-glow`, `--font-size-nano` (9px), `--font-size-pico` (8px), `--font-size-section-heading` (21px), `--font-size-metric-value` (27px), `--panel-header-text` (#d9eeeb), `--panel-header-detail` (#688c91). Each in `tokens.ts` `tokens.*` + `flattenTokens()`.
- `frontend/src/theme/tokens.test.ts` — 6 describe blocks, parses the 08-29 `DESIGN.md`. Adding tokens both sides keeps parity/exhaustiveness green. Update the spot-check block if it hard-codes a count. Guardrail #6 unchanged.
- `frontend/src/App.tsx` + `App.css` — shell tree in the investigation Part B1. **App.css:** `.app-shell::before` grid (two `linear-gradient`s in `var(--grid-line)`, `background-size: var(--grid-size)`, `opacity: var(--grid-opacity)`, `mask-image: linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0) 76%)`), `.app-shell::after` grain (verbatim `feTurbulence` data-URI, `opacity: var(--grain-opacity)`, `mix-blend-mode: screen`). `.app-rail` → `background: var(--rail-bg)`, `backdrop-filter: blur(var(--chrome-backdrop-blur))`, `border-right: 1px solid var(--rail-border)`, portwatch padding. `.app-rail__brand` lockup (beacon mark + `PORTWATCH`/`<small>TUAS`). `.app-rail__eyebrow` (mono, `var(--rail-eyebrow)`, `.16em`, uppercase — text "OPERATIONS"). `.app-nav__link` restyled to `.rail-button`: `min-height: 44px`, `gap: var(--space-3)`, `color: var(--nav-idle)`, `:hover { color: var(--text); background: var(--nav-hover-bg) }`, `[aria-current='page'] { color: var(--nav-active-text); background: linear-gradient(90deg, var(--nav-active-grad-from), var(--nav-active-grad-to)); font-weight: var(--font-weight-heading); text-decoration: underline }` (keep weight+underline for `IncidentArchive.test.tsx`), `::before` glow edge bar (exists). `.app-rail__foot` + `.app-rail__status` (pulse dot + "All systems nominal", `var(--rail-status)`). Radii snap to `var(--radius-md)`/`var(--radius-sm)`. **App.tsx:** brand lockup markup; eyebrow; foot/status; a `.topbar` inside `.app-body` above/replacing `.app-header` with `.breadcrumb` (`<ChevronRight/>` from lucide + `<strong>` = `selected ? formatIncidentLabel(selected) : 'Dashboard'`), `.live-chip` (`<span class="status-dot pulse" aria-hidden>` + "Live feed connected"), `.topbar-time` (`SGT ` + `toLocaleTimeString('en-GB',{hour12:false})`, `setInterval` 1s, cleared on unmount), then `KillSwitchControl`. Preserve `.app-route`, `.app-col--*`, every role/label/href.
- **NEW** `frontend/src/components/PortwatchPrimitives/PortwatchPrimitives.tsx` + `PortwatchPrimitives.css` + `index.ts` + `PortwatchPrimitives.test.tsx` — port **Panel, SectionHeading, StatusPill, MetricCard, SignalTag, TinySparkline, CornerMark, RailButton, LinkButton, CountdownBar, EmptyState** verbatim from the source (signatures in Design Notes A9). `SignalTone = 'teal'|'amber'|'red'|'green'|'slate'` → `signal-{tone}` classes setting only `color`. Author `.tiny-sparkline`/`.spark-fill`, `.empty-state`/`.empty-mark`, `.countdown-track`/`.countdown-fill`, `.link-button` CSS to match the source values. Tests: each renders with its portwatch class names; tone class sets `color` not `background`.
- `frontend/src/components/BlueprintPanel/BlueprintPanel.tsx` + `.css` + `.test.tsx` — **re-implement** `BlueprintPanel` to render portwatch's `.panel`: `<Root class="blueprint-panel panel {className}">{children}<span class="corner-mark" aria-hidden/></Root>` (one corner mark, not 4). Optionally have it delegate to the new `Panel` primitive. `.css` → the portwatch `.panel` + `::before` + `.corner-mark` + `.panel-header`/`.panel-body`/`.panel-index`/`.panel-accent`/`.panel-interactive` values (Design Notes A4). `.test.tsx` static-scans rewritten to the new CSS; keep the DOM its (`aria-hidden` mark, `as` prop, `style` passthrough) — but assert **1** `.corner-mark`, not 4 `.blueprint-panel__corner`. Update every importer that referenced `.blueprint-panel__corner` (none in runtime code; `App.test.tsx` does not).
- The 9 panels (`IncidentFeed`, `IncidentDetail`+`ApprovalBanner`, `ExecutionTrace`, `AskPortwatch`, `GeoMapPanel`, `MapPanel`, `KillSwitchControl` [no heading], `StageRail`, `AgentRoster`, `IncidentArchive`) — replace each plain `<hN class="…__heading|__title">Text</hN>` with `<SectionHeading eyebrow="…" title="Text" />` (which emits `.section-heading` > `.eyebrow` + `<h2 class="section-heading__title …__heading">`). Give the `<h2>` the panel's existing heading class so any CSS keyed on it still applies; the panel `.test.tsx` heading assertion updates to: eyebrow text present, title text present, `.section-heading` container present. Behavioural its (`role`, `aria-live`, list counts, text like "Needs approval" / `ERROR`/`RETRY`/`FALLBACK`) unchanged.
- `frontend/src/components/GeoMapPanel/GeoMapPanel.css` — `.geo-map__land { fill: var(--geo-land); }` (was `var(--accent-100)`).
- `frontend/src/App.test.tsx` — update nav/topbar assertions to the new markup (nav links keep `role=link` + names + hrefs; add: a `.topbar` region/element, a `.live-chip`, the clock updates). Keep the rail-collapse + focus + role its.
- `frontend/package.json` — add `lucide-react` (verify current version), `npm install`.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/theme/tokens.css` + `tokens.ts` — ~40 chrome tokens added both sides (`--geo-land`, `--panel-*`, `--rail-*`, `--topbar-*`, `--nav-*`, `--grid-*`, `--grain-opacity`, `--chrome-backdrop-blur`, `--live-chip-*`, `--breadcrumb*`, `--metric-*`, `--eyebrow`, `--status-pulse-glow`, `--rail-collapse-border`, `--countdown-fill-width`, `--font-size-nano/pico/section-heading/metric-value`). Orphan `--shadow-panel*` / `--bracket-seafoam` removed.
- [x] `frontend/src/theme/tokens.test.ts` — `flattenTokens()` extended; guardrail #6 + parity green.
- [x] `frontend/package.json` + `npm install` — `lucide-react@^1.37.0` (web-verified current).
- [x] `frontend/src/components/PortwatchPrimitives/*` (new) — 11 primitives + `PanelHeader` + CSS + test, tokenised, lucide icons, portwatch class names; tone classes set only `color`; `type="button"`, `aria-hidden` icons, Space-key `preventDefault`, defensive guards (per review).
- [x] `frontend/src/components/BlueprintPanel/*` — re-implemented to portwatch `.panel` (one `.corner-mark` + one `::before` bracket, no `.blueprint-panel__corner` spans); `.panel-header`/`.panel-body`/`.panel-index`/`.panel-accent`/`.panel-interactive` classes; CSS-scan test rewritten; DOM/behaviour its kept.
- [x] `frontend/src/App.css` — `.app-shell::before` grid + `::after` grain; translucent blurred `.app-rail` + brand + `OPERATIONS` eyebrow + foot/status; `.app-nav__link` reduced to link-reset + focus + `[aria-current]` weight/underline, `.rail-button` styling shared from PortwatchPrimitives.css; `.topbar` + `.breadcrumb` + `.live-chip` + `.topbar-time`; dead `.app-header*` removed; `dot-pulse` deduped to one source.
- [x] `frontend/src/App.tsx` — brand `<h1>` lockup, eyebrow, foot/status; `.topbar` with `<TopbarClock/>` (isolated 1s tick, `Asia/Singapore` tz), breadcrumb (handles `#/archive`), live chip; `readCollapsed` moved to `lib/railCollapse.ts`; every role/label/href/`.app-route`/`.app-col--*` preserved.
- [x] 9 panels — each plain heading → `<PanelHeader level={3}>` (`level={4}` for nested `ApprovalBanner`), eyebrow + compact `<h3>`; `.approval-banner__dot` restored; region naming → `aria-labelledby`; each panel `.test.tsx` heading assertion updated; behavioural its untouched.
- [x] `frontend/src/components/GeoMapPanel/GeoMapPanel.css` — land fill → `var(--geo-land)`; `.test.tsx` pins it.
- [x] `frontend/src/App.test.tsx` — nav/topbar/shell assertions added; clock test uses real fake timers (`vi.setSystemTime` + `advanceTimersByTime`); breadcrumb query scoped to `header.topbar`; collapse/focus/role its kept.
- [x] Other `*.test.tsx` token-discipline blocks swept — no token renamed, only added, so no cascade; verified.
- [x] `cd frontend && npm run verify` — lint clean (0 warnings), `tsc -b && vite build` OK, 884 tests pass (26 files). Independently re-verified.
- [x] **End-to-end (live backend + frontend):** `GET /incidents` poll drives the feed; incident selection populates detail/roster/stage-rail/trace; `POST /incidents/{id}/approval` resolves the incident (trace grows `EXECUTE`/`VERIFY`, map markers flip to `done`); `POST /kill-switch` shows the red banner + topbar readout, offset so the rail never covers it; `GET /incidents/query` returns a grounded NL answer. Zero console/page errors.

**Acceptance Criteria:**
- Given `npm run verify`, then lint clean, `tsc -b && vite build` OK, every vitest suite passes (conformance tests assert the new chrome; behavioural/a11y its unchanged).
- Given the guardrail sweep over all `src/**` after the port, then zero raw-hex / named-colour / bare-font-size / non-token-radius / undeclared-`var()` violations.
- Given `<App/>` on `#/`, then the shell has the grid + grain pseudo-element rules, the rail is translucent/blurred with brand lockup + `OPERATIONS` eyebrow + glowing active edge bar + foot status, and a topbar renders a breadcrumb + a `LIVE` chip with a pulsing dot + a ticking `SGT HH:MM:SS` clock — matching `frontend/portwatch-tuas/client/src`.
- Given any `BlueprintPanel`, then the DOM has one `.corner-mark` and one `::before` L-bracket (no `.blueprint-panel__corner` spans).
- Given `GeoMapPanel`, then `.geo-map__land` fills dark (`var(--geo-land)`), no white landmass.
- Given `prefers-reduced-motion: reduce`, then `dot-pulse` + all transitions are suppressed.

## Design Notes

**Exact target values** (`frontend/portwatch-tuas/client/src/index.css`; snap `5px`/`7px` radii to `--radius-sm`/`--radius-md`):

*Shell* — grid: two `linear-gradient` 1px lines `rgba(85,154,156,.055)`, `background-size: 40px 40px`, layer `opacity: .24`, `mask-image: linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0) 76%)`. Grain: `opacity: .025`, `mix-blend-mode: screen`, copy the `feTurbulence` `data:image/svg+xml` URI verbatim from `.app-shell::after`.

*Rail* — `width: 214px` / collapsed `74px`; `padding: 22px 14px 18px`; `background: rgba(6,20,27,.88)`; `backdrop-filter: blur(18px)`; `border-right: 1px solid rgba(84,150,154,.2)`. Brand mark 31×31 `filter: drop-shadow(0 0 10px rgba(102,224,210,.25))`; wordmark 11px/700 `#ecfbf7`; `<small>` 8px/500 `#66e0d2` `.24em`. Eyebrow mono 500 9px `.16em` uppercase `#557d85`. `.rail-button` `min-height: 44px; padding: 0 10px; gap: 12px`; idle `#6a9196`; `:hover { color:#c2dcda; background: rgba(78,137,143,.1) }`; `.active { color:#d8fbf3; background: linear-gradient(90deg, rgba(54,122,128,.24), rgba(40,82,89,.08)) }`; `.active::before { left:-14px; width:2px; height:24px; background:#66e0d2; box-shadow:0 0 12px rgba(102,224,210,.55) }`; badge `<b>` `#efb15b` mono 600 9px; radius `7px` → `var(--radius-md)`. Foot mono 10px `#52767b`, `strong` `#8fb7b6`. Status `#8bd4c7` Space Grotesk 600 + `.status-dot.pulse`. Collapse control 25×25, `border: 1px solid rgba(102,224,210,.34)`, `background:#0b222a`, radius `5px` → `var(--radius-sm)`.

*Topbar* — `height: 72px; padding: 0 34px; background: rgba(7,20,27,.64); backdrop-filter: blur(18px); border-bottom: 1px solid rgba(84,150,154,.16)`. Breadcrumb mono 10px `.09em` uppercase `#62868b`; `strong` `#d6ebe8`/500. Live chip `padding: 6px 10px; border: 1px solid rgba(102,224,210,.28); background: rgba(36,109,108,.1); color:#89d9ce`; mono 9px uppercase; square. Time `#668a8e` mono 10px.

*Panel* — `.panel { border: 1px solid rgba(85,147,151,.21); background: rgba(14,36,44,.73); border-radius: 8px; box-shadow: 0 14px 40px rgba(0,0,0,.12), inset 0 1px 0 rgba(191,255,245,.025); overflow: hidden }`. `::before { top:-1px; left:-1px; width:18px; height:18px; border-top:1px solid rgba(102,224,210,.65); border-left:1px solid rgba(102,224,210,.65) }`. `.corner-mark { right:10px; bottom:10px; width:9px; height:9px; border-right:1px solid rgba(102,224,210,.38); border-bottom:1px solid rgba(102,224,210,.38) }`. `.panel-accent { border-color: rgba(102,224,210,.4); box-shadow: 0 0 0 1px rgba(102,224,210,.05), 0 18px 54px rgba(0,0,0,.16), inset 0 1px 0 rgba(193,255,248,.04) }`. `.panel-interactive:hover { border-color: rgba(237,177,92,.62) } :focus-visible { outline: 2px solid` an amber token `; outline-offset: 3px }`. `.panel-header { padding: 17px 18px 14px; display:flex; justify-content:space-between; gap:16px; border-bottom: 1px solid rgba(85,147,151,.15) } h3 { font-size: var(--font-size-section-title); color: var(--panel-header-text); letter-spacing:-.01em } p { font-size: var(--font-size-caption); color: var(--panel-header-detail) }`. `.panel-body { padding: 18px }`. `.panel-index { font-size: var(--font-size-nano); color:#557f84 }`.

*Section heading* — `.eyebrow { color:#69c8c0; font-family: var(--font-mono); font-weight: 600; font-size: var(--font-size-micro-label); letter-spacing: .17em; text-transform: uppercase }`. `.section-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:17px } .section-heading__title / h2 { font-size: var(--font-size-section-heading); letter-spacing:-.035em; color: var(--text) } .section-heading__detail { font-size: var(--font-size-body); color:#75989c; line-height:1.5 }`.

*Primitive signatures* (port verbatim): `Panel({children,className,accent,onClick})` — `<section class="panel [panel-accent] [panel-interactive]">`, `role=button`+tabIndex+Enter/Space when `onClick`; `SectionHeading({eyebrow,title,detail,action})`; `StatusPill({tone,children,pulse})`; `MetricCard({label,value,suffix,delta,tone='teal',icon,note})`; `SignalTag({label,tone='slate',icon='dot'|'check'|'alert'|'info'|'loading'})`; `TinySparkline({points,tone='teal'})`; `CornerMark({className})`; `RailButton({active,icon,label,onClick,badge})`; `LinkButton({children,onClick,icon=true,tone='ghost'|'solid'})`; `CountdownBar({percent,tone='amber'})`; `EmptyState({title,detail})` — `.empty-mark` text `∕∕`.

**`rgba(0,0,0,…)` for mask/shadow stops is fine** — the guardrail bans named `black`/`white`, not `rgba(0,0,0,…)`.

**Nav elements stay `<a href>`** for hash routing; the `.rail-button` *look* is applied to `.app-nav__link`. `RailButton` is still ported (used nowhere in `App.tsx`, available for parity/future).

**Deferred** (`deferred-work.md`): the KPI/MetricCard strip (primitive is ported, no strip mounted) and the fuller map composition (route trace / Berths-Yards-Routes toggles / nodes — this build only darkens the land fill).

## Verification

**Commands:**
- `cd frontend && npm run verify` — lint clean, `tsc -b && vite build` OK, all vitest suites pass.
- `cd frontend && npm test -- tokens.test.ts BlueprintPanel PortwatchPrimitives App` — parity/guardrail + panel + primitives + shell tests pass.
- `cd frontend && npx tsc -b --noEmit` — no type error (primitives, `lucide-react`).

**Manual checks:**
- `npm run dev` → faint harbor grid fading downward + film grain; translucent blurred rail with the beacon + PORTWATCH/TUAS lockup, `OPERATIONS` eyebrow, glowing seafoam edge bar on the active item, foot status line; a real topbar with breadcrumb + `LIVE` chip (pulsing dot) + ticking `SGT HH:MM:SS`. Panels have one bottom-right corner mark + one top-left bracket. Strait Map land is dark.

## Spec Change Log

- **2026-08-29 review (blind-hunter + visual):** Code Map/Tasks said "panel headings become `SectionHeading` (`.section-heading` > `.eyebrow` + `<h2>` 21px)". portwatch-tuas actually uses the compact `.panel-header` (`<h3>` ~15px + optional `.panel-index`) for panels and reserves `.section-heading` (h2 21px) for view intros. Corrected as a patch: the 9 panels get a compact eyebrow + `<h3>` header (ApprovalBanner nested = `<h4>`); `SectionHeading` (h2) stays ported for future view intros. Design Notes already carry the correct `.panel-header` values. KEEP: the ported tokens, shell (grid/grain/rail/topbar), primitives, and `--geo-land` fix are correct — only the panel header treatment changes.

## Suggested Review Order

**Token layer (entry point)**

- ~40 chrome tokens added (panel/rail/topbar translucent bg + borders, grid/grain, nav gradient/hover/text, live-chip, breadcrumb, `--geo-land`, mono size ramp); orphan `--shadow-panel*`/`--bracket-seafoam` removed.
  [`tokens.css:120`](../../frontend/src/theme/tokens.css#L120)
- Mirror + `flattenTokens()` (parity test).
  [`tokens.ts`](../../frontend/src/theme/tokens.ts)

**Shell — grid, grain, rail, topbar**

- `.app-shell::before` harbor grid + `::after` verbatim `feTurbulence` grain; translucent blurred `.app-rail`; the `.rail-button` look is authored once (in PortwatchPrimitives.css) and shared by the nav `<a>`.
  [`App.css:31`](../../frontend/src/App.css#L31)
- `<TopbarClock/>` — isolated 1s tick, `Asia/Singapore` tz + `h23`; breadcrumb (handles `#/archive`); brand `<h1>` lockup; `OPERATIONS` eyebrow; foot status.
  [`App.tsx:39`](../../frontend/src/App.tsx#L39)
- `readCollapsed` + key moved out of `App.tsx` (clears the fast-refresh lint warning).
  [`railCollapse.ts`](../../frontend/src/lib/railCollapse.ts)

**Primitives (new)**

- 11 portwatch primitives + `PanelHeader` (compact eyebrow + `<h{level}>`), tokenised, lucide icons, tone classes set only `color`; `type="button"`, `aria-hidden` icons, Space-key `preventDefault`, defensive guards.
  [`PortwatchPrimitives.tsx`](../../frontend/src/components/PortwatchPrimitives/PortwatchPrimitives.tsx)
  [`PortwatchPrimitives.css:81`](../../frontend/src/components/PortwatchPrimitives/PortwatchPrimitives.css#L81)

**Panel re-implement**

- `BlueprintPanel` → portwatch `.panel`: one `::before` L-bracket + one `.corner-mark` (no 4 corner spans); `.panel-header`/`-body`/`-index`/`-accent`/`-interactive`.
  [`BlueprintPanel.tsx`](../../frontend/src/components/BlueprintPanel/BlueprintPanel.tsx)
  [`BlueprintPanel.css`](../../frontend/src/components/BlueprintPanel/BlueprintPanel.css)

**Panels + map**

- 9 panels: heading → `<PanelHeader level={3}>` (`4` for nested `ApprovalBanner`); `.approval-banner__dot` restored; region naming → `aria-labelledby`.
  [`StageRail.tsx`](../../frontend/src/components/StageRail/StageRail.tsx)
- Map land fill → `var(--geo-land)` (dark); pinned by its test.
  [`GeoMapPanel.css`](../../frontend/src/components/GeoMapPanel/GeoMapPanel.css)

**Tests**

- Shell/topbar/clock assertions; the clock test uses real fake timers now (a frozen clock would fail).
  [`App.test.tsx`](../../frontend/src/App.test.tsx)
