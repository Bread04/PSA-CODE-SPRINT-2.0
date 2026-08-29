---
title: 'Harbor Signal re-skin + agent roster (frontend/src)'
type: 'feature'
created: '2026-08-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'a6d5a38da56b59f48fc5f7665b81bdb3487b00f6'
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-29/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-29/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `frontend/src` implements the retired "blueprint" DESIGN.md (greyscale, Barlow Condensed, zero-radius). The team pivoted the UX to "Harbor Signal" (`ux-PSA CODE SPRINT-2026-08-29`, follows `frontend/portwatch-tuas/src`), and the multi-agent pipeline still isn't shown per-specialist. Architecture AD-18/AD-19 make this a presentation-only change (data already on the API).

**Approach:** Re-value the design-token layer to Harbor Signal **keeping token names stable** so component CSS mostly rides along; re-skin the shared `BlueprintPanel` and the `App` shell (add the left command rail + 72px topbar); add a read-only `AgentRoster` fed from `Incident.agents` + `AGENT_CALL` trace state; rewrite the token/panel conformance tests to the new spec. No data-flow, hook, endpoint, or route-target changes.

## Boundaries & Constraints

**Always:**
- Token **names** in `theme/tokens.css` / `tokens.ts` stay stable wherever a name still has a Harbor Signal counterpart (`--bg`, `--surface`, `--text`, `--text-muted`, `--divider`, the `--accent-*` ramp, `--neutral-*`, `--space-*`, `--radius-*`, `--font-*`, `--font-size-*`, `--letter-spacing-*`, `--col-left`/`--col-right`). Only **values** change. New tokens may be added (`--rail-width`, `--rail-width-collapsed`, `--topbar-height`, shadow/glow); none removed unless it has no Harbor Signal role (then sweep its references).
- `tokens.css` ≡ `tokens.ts` ≡ `ux-PSA CODE SPRINT-2026-08-29/DESIGN.md` front-matter — the parity the reworked `tokens.test.ts` enforces.
- Guardrail #6 in `tokens.test.ts` (no raw hex / no CSS named colors / `font-size` only via `var(--font-size-*)` / no `opacity:0.6` text de-emphasis / `border-radius ∈ {0, var(--radius-*), 9999px}` / every `var(--x)` resolves) MUST still pass across all shipped `src/**` CSS — every Harbor Signal colour, shadow, glow, and radius routes through a token.
- Every existing **class name**, `role`, `aria-*`, and visible-text contract is preserved (`.app-route`, `.blueprint-panel`, `.blueprint-panel__corner`, `.stage-rail__item--*`, `.geo-map__marker`, `.execution-trace__mock` text, `ERROR`/`RETRY`/`FALLBACK`, `role="navigation" name="Primary"` with links `#/` and `#/archive`, etc.). Behavioural / DOM / a11y tests stay green untouched.
- `prefers-reduced-motion: reduce` disables the confidence tween, status-dot breathing, and panel/hover transitions (global `@media` block in `index.css`, mirroring `portwatch-tuas/index.css`).
- Fonts self-hosted (no CDN): swap `@fontsource/barlow*` → `@fontsource/space-grotesk` + `@fontsource/ibm-plex-mono`; update `main.tsx` imports.

**Ask First:**
- Renaming the `BlueprintPanel` component or its `blueprint-panel` class (wide rename; class-name-coupled tests). Default: keep both, re-skin the CSS only.
- Any change under `backend/`, to `src/hooks/`, `src/api/`, `useHashRoute`, or route targets (`#/`, `#/archive`).
- Adding the "Active Incidents" view or renaming Archive → "Audit Trail" — deferred (`deferred-work.md`); the rail here carries the existing Dashboard (`#/`) + Archive (`#/archive`) items only.

**Never:**
- No new endpoint, no new write path (approval + kill-switch stay the only writes), no SSE.
- Do not import portwatch-tuas features the PRD lacks — workforce/staffing card, fleet tabs, live gov.sg radar fetch (see `reconcile-portwatch-tuas-src.md`).
- Do not delete conformance tests — rewrite their expected values to Harbor Signal.
- Do not add Tailwind or shadcn (portwatch-tuas uses them; `frontend/src` stays hand-rolled CSS + tokens).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Roster: full bundle | `incident.agents` = 3 entries (berth/crane/yard) | `AgentRoster` renders 3 chips, berth→crane→yard, each showing agent name + `summary` + expandable `actions`/`constraints` | N/A |
| Roster: run state from trace | incident has `AGENT_CALL` trace entries; crane's carries `error.fallback_used=true` | crane chip shows `FALLBACK` (or `TIMEOUT` when `error` present without fallback), berth/yard show `COMPLETE` | derive from trace only; no crash if an agent has no `AGENT_CALL` entry → `COMPLETE` |
| Roster: empty | `incident.agents` = `[]` (or absent) | `AgentRoster` renders nothing (or a quiet "no specialist run" line), no error | N/A |
| Roster: null incident | no incident selected | `AgentRoster` renders nothing | N/A |
| Token parity | `tokens.css`, `tokens.ts`, 08-29 `DESIGN.md` | reworked `tokens.test.ts` passes: every token three-way equal, key-count parity, radius/px hygiene against the new values | test fails loudly on any drift |
| Guardrail sweep | all `src/**` shipped CSS after re-skin | no raw hex, no named colours, `font-size` only via token, radius via token/0/9999px, every `var(--x)` resolves | test enumerates offending file:line |
| Reduced motion | `prefers-reduced-motion: reduce` | confidence numeral, status dots, panel transitions are static | N/A |

</frozen-after-approval>

## Code Map

- `frontend/src/theme/tokens.css` — 46 `:root` custom props, grouped (base/accent ramp/accent-2/neutral/spacing/layout/radius/typography). Re-value to Harbor Signal; add `--rail-width:214px`, `--rail-width-collapsed:74px`, `--topbar-height:72px`, `--shadow-panel`, `--bracket-seafoam` (+ any glow/alpha used). `--header-height`→72. `--radius-sm/default/md/lg`→ `4px/8px/8px/16px` (+ add `--radius-xl:22px`), `--radius-tag`→`4px`, `--radius-full` stays `9999px`. `--space-1..8`→ `4/8/12/16/20/24` (+2 steps if needed). `--font-heading`→`"Space Grotesk", system-ui, sans-serif`; add `--font-mono:"IBM Plex Mono", ui-monospace, monospace`; `--font-body`→Space Grotesk. Palette: `--bg:#07141B`, `--surface:#0D1C26`, plus `--surface-elevated:#122833`, `--surface-subtle:#183243`, `--divider:#214459`, `--text:#EAF7F9`, `--text-muted:#A4B8C0`; recolour the `--accent-*` ramp as a seafoam ramp anchored on `#66E0D2` and repurpose `--accent-2`/signal roles to `amber #F7B267` / `red #E8695A` (map per DESIGN.md Colors). Keep every existing name that has a target.
- `frontend/src/theme/tokens.ts` — mirror object (`tokens.color/space/radius/font/layout`) + derived types. Update values; add the new keys; keep the `divider` CSS-vs-TS special-case note if still divergent (Harbor Signal `--divider` is a flat hex → the divergence can go away).
- `frontend/src/theme/tokens.test.ts` (513 lines) — parses `ux-PSA CODE SPRINT-2026-08-26/DESIGN.md` with a mini-YAML parser + `expected{}` builder assuming `colors.<name>`, `spacing.<n>`, `rounded.<name>`, `typography.<role>.<prop>`. **Rework:** point at the 08-29 file; extend the parser/`expected{}` for its nested schema (`colors.background.ink`, `colors.signalSeafoam`, `typography.display.family`, `rounded.sm..xl` unit-less ints, `spacing.xs..xxl`). Update inlined literals (`#597ea3`, `rgba(29,31,32,0.16)`, `'Barlow Condensed'`, `'Barlow'`, `'0'` radii, `'3px'`, `'10.2px'`, `'13.6px'`, the 10–18 range, spacing base). Keep all 6 describe blocks' intent; retune the radius-hygiene allowlist to the new radius values; keep guardrail #6 logic, only its allowed radius/px set changes.
- `frontend/src/index.css` — `color-scheme: light`→`dark`; `body` background→`var(--bg)` ink (already tokenised). Add the global `@media (prefers-reduced-motion: reduce)` block. Optionally add the shell `::before` harbor grid + `::after` grain (tokenised colours) — keep subtle, gate behind reduced-motion for any animation.
- `frontend/src/main.tsx` — replace the three `@fontsource/barlow*` imports with `@fontsource/space-grotesk/400.css` + `/600.css` and `@fontsource/ibm-plex-mono/400.css` (+ `/500.css` if used).
- `frontend/package.json` — deps: drop `@fontsource/barlow`, `@fontsource/barlow-condensed`; add `@fontsource/space-grotesk`, `@fontsource/ibm-plex-mono` (`^5`). Run `npm install` to refresh the lockfile.
- `frontend/src/components/BlueprintPanel/BlueprintPanel.css` (75) — re-skin: `background:var(--surface)`, `border:1px solid var(--divider)`, `border-radius:var(--radius-md)` (8px), `box-shadow:var(--shadow-panel)`, `overflow:hidden`. Restyle the 4 `.blueprint-panel__corner` spans as thin seafoam corner marks (keep all 4 in DOM; a `.blueprint-panel--active` modifier may brighten them). Add the top-left L-bracket via `::before` on `.blueprint-panel` (tokenised seafoam, ~18px). `@property --blueprint-panel-padding` stays; initial → `var(--space-4)` (16px).
- `frontend/src/components/BlueprintPanel/BlueprintPanel.test.tsx` (322) — parses the 08-26 DESIGN.md `components.blueprint-panel` + static-scans the CSS for `border-radius:0`, `11px`/`-6px`/`opacity:0.35` corners, `background:var(--text)`. **Rework** the parse target + scan expectations to the Harbor Signal panel (radius 8px, seafoam L-bracket, corner-mark treatment). Keep the DOM its (4 corner spans, order, `aria-hidden`, `pointer-events:none`).
- `frontend/src/App.tsx` (129) + `App.css` (86) — replace the top text-link `nav` with a **persistent left command rail** (`--rail-width` / collapsed `--rail-width-collapsed`, collapse toggle, active item = 2px seafoam left-edge bar) carrying Dashboard (`#/`) + Archive (`#/archive`); keep `role="navigation" aria-label="Primary"` and both `<a href>` + `aria-current`. Add a `--topbar-height` (72px) bar (brand lockup + kill switch + a mono clock is optional). Body grid shifts to `margin-left: var(--rail-width)`. Keep `.app`, `.app-route` (+`tabIndex`/ref/focus-on-route-change), `.app-main`, the three `.app-col*` (widths `--col-left`/`flex`/`--col-right`), `.app-header`/`.app-nav`/`.app-nav__link` class hooks (IncidentArchive.test.tsx reads `.app-nav__link[aria-current='page']` in `App.css`).
- `frontend/src/App.test.tsx` (230) — role/text/behaviour only; should stay green if the class names + nav roles above are preserved. Re-run to confirm; adjust only if a query targets removed markup.
- 8 component `.css` files (`IncidentFeed`, `IncidentDetail`+`ApprovalBanner`, `ExecutionTrace`, `AskPortwatch`, `GeoMapPanel`, `MapPanel`, `KillSwitchControl`, `StageRail`, `IncidentArchive`) — **only edit where a token name is being removed or a raw literal exists.** Investigation shows they already route colour/spacing through `var(--*)`; re-valuing the tokens re-skins them for free. Sweep each for: bare px in `font-size` (already tokenised per epic-2 F5), any inlined stroke width / dimension that the guardrail now rejects.
- 8 matching `.test.tsx` "routes visual values through Story 2.1 tokens" `describe` blocks — update expected values: focus-ring token if `--accent-700`'s role moves, `--accent-900` dot/banner → whatever the new "critical surface" token is, radius `0` → new radius tokens, any `=== '#hex'` inline. Keep every behavioural/DOM/aria `it`.
- `frontend/src/types/incident.ts` (70) — add `agents: AgentRecommendation[]` to `Incident` (default `[]` semantics; backend AD-19 now sends it). New `AgentRecommendation = { agent: 'berth'|'crane'|'yard'; summary: string; actions: string[]; constraints: string[]; rationale: string }`.
- `frontend/src/test/fixtures/incidents.ts` (460, ~19 fixtures) — add `agents: []` to every fixture; give `tier3PendingNewer`/`tier3WithAlternatives`/`degradedConfidenceFallback` (or similar) a realistic 3-entry roster so `AgentRoster` tests + Storybook-style rendering have data. Trace `AGENT_CALL` entries where a fixture depicts a specialist run.
- `frontend/src/lib/stageRail.ts` (157) — reference only; `RAIL_STAGES` + `deriveRail` show the pattern for `lib/agentRoster.ts`. `AGENT_CALL` fan-out collapse logic lives here.
- **NEW** `frontend/src/lib/agentRoster.ts` + `agentRoster.test.ts` — `deriveRoster(incident) → AgentChipView[]` where `AgentChipView = { agent, summary, actions, constraints, state: 'complete'|'timeout'|'fallback' }`. `state` from the incident's `AGENT_CALL` trace entries (`error.fallback_used` → fallback; `error` w/o fallback → timeout; else complete; no entry → complete). Pure logic, jsdom-free.
- **NEW** `frontend/src/components/AgentRoster/{AgentRoster.tsx,AgentRoster.css,AgentRoster.test.tsx,index.ts}` — read-only. Side-by-side chips (`BlueprintPanel as="section"`, `blueprint-panel agent-roster`), one per agent, berth→crane→yard, `state` shown as a `.agent-roster__chip--{state}` class + label (never colour-only). Mounted in `App.tsx` centre column directly after `StageRail`. All colour/space via tokens.
- `frontend/vite.config.ts` — `test.css: true` already; no change expected.

## Tasks & Acceptance

**Execution:**
- [x] `frontend/src/theme/tokens.css` — re-value to Harbor Signal per Code Map; stable names, add rail/topbar/shadow tokens, new radius + spacing values.
- [x] `frontend/src/theme/tokens.ts` — mirror the new values/keys; update derived types + the divider note. _(divider special-case removed — Harbor Signal `--divider` is a flat hex.)_
- [x] `frontend/src/theme/tokens.test.ts` — repoint to the 08-29 DESIGN.md; new nested front-matter parser; split parity (DESIGN-anchored subset three-way + derived ramps css≡ts); retuned radius/px hygiene; guardrail #6 kept; + reduced-motion presence check.
- [x] `frontend/src/index.css` — `color-scheme: dark`; `prefers-reduced-motion` block. Shell grid/grain skipped (guardrail bans raw literals in shipped CSS; visual risk for no test value).
- [x] `frontend/src/main.tsx` + `frontend/package.json` — fonts → Space Grotesk 400/600 + IBM Plex Mono 400/500/600; `npm install` refreshed the lockfile.
- [x] `frontend/src/components/BlueprintPanel/BlueprintPanel.css` — 8px radius, `--shadow-panel` (+ inset highlight), seafoam 18px `::before` L-bracket, 4 corner spans → 3px seafoam registration dots.
- [x] `frontend/src/components/BlueprintPanel/BlueprintPanel.test.tsx` — parses `components.panel`; scan reworked to the new treatment; DOM its unchanged.
- [x] `frontend/src/App.tsx` + `frontend/src/App.css` — persistent left rail (214/74, collapse toggle w/ sessionStorage + `aria-controls`, 2px seafoam active bar) + 72px topbar; `KillSwitchBanner` re-anchored `position: fixed` with `app-shell--kill-engaged` offset; all `.app-route` / nav-role / `.app-col*` / `.app-nav__link` hooks preserved; nav glyphs → inline SVG.
- [x] 8 component `.css` files — **zero edits needed** (they route colour/space through `var(--*)`; re-valuing the tokens re-skinned them).
- [x] 8 component `.test.tsx` token-discipline blocks — **zero edits needed** (they assert token *names*, which stayed stable; verified no hardcoded hex).
- [x] `frontend/src/types/incident.ts` — `AgentName`, `AgentRecommendation`, `Incident.agents`.
- [x] `frontend/src/test/fixtures/incidents.ts` — `agents: []` on all 15 fixtures; `demoRoster()` helper; realistic rosters + `AGENT_CALL` traces on `tier3WithAlternatives` (crane fallback) and `tier3PendingNewer`.
- [x] `frontend/src/lib/agentRoster.ts` + `agentRoster.test.ts` — `deriveRoster` (pure/total; run-state from `AGENT_CALL` trace; `rationale` carried; defensive agent-match + summary fallback).
- [x] `frontend/src/components/AgentRoster/*` — component + css + test + index; mounted in a full-width `.app-live` row below `.app-main` (not the centre column — chips need the width to sit side-by-side at 1280px).
- [x] Run `npm run verify` — lint clean (1 non-blocking `react-refresh` warning on the exported `readCollapsed` test hook), `tsc -b && vite build` OK, 806 tests pass.

**Acceptance Criteria:**
- Given the re-skin is applied, when `npm test` runs in `frontend/`, then every test passes — conformance tests assert the Harbor Signal values, behavioural/a11y tests are unchanged.
- Given `npm run build` (`tsc -b && vite build`), when it runs, then it succeeds with no type error (incl. the new `agents` type + `AgentRoster`).
- Given the guardrail sweep in `tokens.test.ts`, when it runs over all shipped `src/**` CSS, then it reports zero raw-hex / named-colour / non-token-radius / bare-font-size / unresolved-`var()` violations.
- Given an incident with `agents` populated and an `AGENT_CALL` fallback trace entry, when the Live Console renders, then `AgentRoster` shows three chips in berth→crane→yard order with the crane chip labelled `FALLBACK`.
- Given `prefers-reduced-motion: reduce`, when the console renders, then no numeral tween / dot breathing / panel transition runs.

## Design Notes

**Keep-names-change-values is the core lever.** Component `.css` files reference `var(--accent-700)`, `var(--radius-md)`, `var(--space-3)` etc. — re-valuing those tokens re-skins ~90% of the UI with no component edit. Only touch a component `.css` when a token name genuinely has no Harbor Signal counterpart, or a raw literal slipped past the guardrail. This keeps the diff auditable and the behavioural tests untouched.

**Token role remap (fill exact values from `ux-PSA CODE SPRINT-2026-08-29/DESIGN.md`):**
```
--bg           #f2f2f3 → #07141B        --surface      #e9e9ea → #0D1C26
--text         #1d1f20 → #EAF7F9        --text-muted   #585c60 → #A4B8C0
--divider      color-mix → #214459
--accent-500/600/700  steel-blue → seafoam ramp around #66E0D2   (600/700 keep the "primary action / focus ring" role)
--accent-900   #1d2d3d → a critical-surface ink (kill-switch banner / blocked dot)  — or introduce --signal-red #E8695A and point those rules at it (component .css edit)
--accent-2     #728fab → amber #F7B267  (watch / degraded)
--radius-sm/default/md/lg  0/0/0/0 → 4/8/8/16 ; add --radius-xl 22 ; --radius-tag 3px→4px
--space-1..8   3.4-base → 4/8/12/16/20/24 (+extend)
--header-height 54 → 72 ; add --rail-width 214 / --rail-width-collapsed 74
--font-heading/-body  Barlow* → "Space Grotesk" ; add --font-mono "IBM Plex Mono"
```
Where a rule's *role* changes hue family (e.g. `--accent-900` was "darkest steel" now needs to read as "critical red"), prefer adding a named signal token (`--signal-red`, `--signal-amber`, `--signal-seafoam`) and repointing that component's `.css` — clearer than overloading the ramp.

**AgentRoster state, not colour.** `state` renders as a text label + a `--chip--{state}` class (shape/border), never hue alone (EXPERIENCE.md Accessibility Floor). `deriveRoster` mirrors `deriveRail`'s trace-reading style so the two projections stay recognisably kin (epic-4 retro item 2's concern).

**BlueprintPanel keeps its name.** A rename touches 8 importers + class-coupled tests for no user-visible gain; the CSS re-skin alone delivers the Harbor Signal panel.

## Verification

**Commands:**
- `cd frontend && npm run verify` — expected: lint clean, `tsc -b && vite build` succeeds, all vitest suites pass.
- `cd frontend && npm test -- tokens.test.ts BlueprintPanel agentRoster AgentRoster` — expected: the reworked conformance tests + new roster tests pass.
- `cd frontend && npx tsc -b --noEmit` — expected: no error from `Incident.agents` / `AgentRoster`.

**Manual checks:**
- `npm run dev`, open the console: dark marine ground, Space Grotesk chrome, IBM Plex Mono numerals, left command rail with a seafoam active bar, 8px panels with a seafoam top-left bracket. Select the Tier 3 demo incident → `AgentRoster` shows berth/crane/yard side by side, crane = `FALLBACK`.

## Suggested Review Order

**Token layer (entry point — the whole re-skin pivots on this)**

- Every token re-valued to Harbor Signal, names held stable so component CSS rides along untouched. `--accent-900` is deliberately repurposed to critical-red (`= --signal-red`).
  [`tokens.css:21`](../../frontend/src/theme/tokens.css#L21)
- The mirror; `divider` special-case dropped (Harbor Signal `--divider` is a flat hex).
  [`tokens.ts:1`](../../frontend/src/theme/tokens.ts#L1)
- Conformance rework: new nested front-matter parser for the 08-29 DESIGN.md, split parity (DESIGN-anchored subset three-way + derived ramps css≡ts), guardrail #6 kept, + a reduced-motion presence check.
  [`tokens.test.ts:1`](../../frontend/src/theme/tokens.test.ts#L1)

**Shell — rail, topbar, kill-switch overlap**

- Persistent left rail (214/74, collapse toggle w/ sessionStorage + `aria-controls`), full-width `.app-live` row for the roster, `app-shell--kill-engaged` offset.
  [`App.tsx:150`](../../frontend/src/App.tsx#L150)
- `KillSwitchBanner` re-anchored `position: fixed; z-index: 30`; `--banner-height` offsets the fixed rail + body while engaged (the review fix — the fixed rail was covering the banner).
  [`KillSwitchControl.css:122`](../../frontend/src/components/KillSwitchControl/KillSwitchControl.css#L122)
- Rail / body / active-route-bar layout; nav glyphs are inline SVG (not Unicode geometric chars).
  [`App.css:31`](../../frontend/src/App.css#L31)

**Panel treatment**

- 8px radius, `--shadow-panel` + inset highlight, one 18px seafoam `::before` L-bracket; the 4 corner spans are now 3px registration dots (de-duped the doubled bracket).
  [`BlueprintPanel.css:46`](../../frontend/src/components/BlueprintPanel/BlueprintPanel.css#L46)

**Agent roster (new — the "Orchestra" per-specialist view)**

- `deriveRoster`: pure/total fold of `incident.agents` + `AGENT_CALL` trace → ordered berth/crane/yard chips; run-state from trace only; `rationale` carried; defensive agent-match + summary fallback.
  [`agentRoster.ts:72`](../../frontend/src/lib/agentRoster.ts#L72)
- The component: read-only chips, run-state as class + text token + border-shape (never colour-only), `actions`/`constraints`/`rationale` behind a native `<details>`.
  [`AgentRoster.tsx:49`](../../frontend/src/components/AgentRoster/AgentRoster.tsx#L49)
- Type: `AgentName` / `AgentRecommendation` / `Incident.agents` (matches backend AD-19).
  [`incident.ts`](../../frontend/src/types/incident.ts)

**Tests**

- App-level: roster shows on the Live Console for a roster-bearing incident (crane = `FALLBACK`), absent on `#/archive`; rail collapse toggle + sessionStorage persistence + storage-failure safety.
  [`App.test.tsx`](../../frontend/src/App.test.tsx)
- `deriveRoster` matrix rows + the review-added edge cases (case-insensitive trace match, blank-summary em-dash, non-canonical agent dropped).
  [`agentRoster.test.ts:70`](../../frontend/src/lib/agentRoster.test.ts#L70)
- Fixtures: `agents: []` on all 15 + `demoRoster()` + realistic rosters/traces on `tier3WithAlternatives` (crane fallback) and `tier3PendingNewer`.
  [`incidents.ts`](../../frontend/src/test/fixtures/incidents.ts)
