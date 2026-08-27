---
title: 'Story 2.2: Blueprint Panel Primitive'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '1aa3593c52fa5e46723c47c269d26b1263bf3d74'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-1-design-token-system.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/mockups/live-console.html'
warnings: []
deferred:
  - summary: >-
      BlueprintPanel ships no focus-visible / keyboard-interaction treatment for
      interactive uses (`as="button"` or a role that makes the panel actionable).
    evidence: |-
      The `as` prop lists `button` as a supported root, but the primitive has no
      :focus-visible rule and tests only cover mouse click. Story 2.2's intent scopes
      it to a visual container; UX-DR11's AA-contrast focus ring belongs with the first
      consumer that makes a panel actionable (Story 2.3 feed rows / Story 2.8 kill switch).
    location: >-
      frontend/src/components/BlueprintPanel/BlueprintPanel.css
    severity: low
  - summary: >-
      A BlueprintPanel rendered flush against a container edge overflows ~6px because
      the crosshair corner marks sit at -6px outside the box.
    evidence: |-
      Matches the DESIGN.md geometry (cornerMarkOffset -6px) and cannot be fixed in the
      primitive without breaking the spec. Consuming layouts (Story 2.3 onward) must
      reserve a >=6px gutter around panels or accept clipped corner marks.
    location: >-
      frontend/src/components/BlueprintPanel/BlueprintPanel.css
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 2's incident card, approval card, trace log, and map panels must all share one visual container (1px divider border, zero radius, four crosshair corner marks), but no reusable component exists — each later story would otherwise re-style its own box and they would drift (UX-DR2).

**Approach:** Build one `BlueprintPanel` React component under `frontend/src/components/` that renders the DESIGN.md blueprint-panel: a bordered, square, `--surface` container with four 11px crosshair registration marks offset 6px outside each corner, driven entirely by Story 2.1 tokens. It takes `children`, an optional `as` element, `className`/`style` merge, and forwards arbitrary DOM props (`role`, `aria-*`, `onClick`, `data-*`) so 2.3–2.9 can compose it without re-styling.

## Boundaries & Constraints

**Always:**
- Visual spec matches DESIGN.md `components.blueprint-panel` and the `.blueprint` / `.corner` rules in `mockups/live-console.html` EXACTLY: `border: 1px solid var(--divider)`, `border-radius: 0`, `background: var(--surface)`, default padding `var(--space-4)` (13.6px), `position: relative`; four corner marks, each an 11px×11px box offset `-6px` outside its corner, drawn as a 1px crosshair (`::before` 11×1, `::after` 1×11) in `var(--text)` at `opacity: 0.35`.
- All colors, spacing, and the corner size/offset come from `var(--…)` tokens or the literal `11px`/`-6px`/`1px` structural values the mock uses — no ad hoc hex, no `border-radius` other than `0`.
- The component renders its `children` inside the bordered box, above/below the corner marks (corner marks are decorative, `aria-hidden`, and must not intercept pointer events).
- `className` and inline `style` passed by the caller merge with (never silently replace) the component's own; unknown props (`role`, `aria-*`, `data-*`, `onClick`, `id`, …) are spread onto the root element.
- `as` prop selects the root element/tag (default `div`); the component forwards a ref to that root.
- Default padding is overridable via a prop or a CSS custom property without editing the component.
- New code lives under `frontend/`. Do not touch `backend/`. Reuse Story 2.1's tokens; do not redefine them.

**Block If:**
- DESIGN.md and the mock give irreconcilable corner-mark geometry (they currently agree: 11px size, −6px offset, 1px stroke).

**Never:**
- No incident feed, incident detail, approval banner, execution trace, map, chat, kill-switch, routing, or data-fetching code — those are stories 2.3–2.9.
- Do not introduce Tailwind, a CSS-in-JS runtime, or a component library. Plain co-located CSS + a typed React component only.
- Do not add a second corner-mark hue or round any corner.
- Do not build panel *variants* (elevated, compact, etc.) beyond the single padding override — YAGNI until a consumer needs one.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default render | `<BlueprintPanel>child</BlueprintPanel>` | root `div` carries the `blueprint-panel` class and renders `child`; exactly four corner-mark elements are present, each `aria-hidden` and `pointer-events: none` | No error expected |
| Token-driven styling | rendered panel's stylesheet | CSS rule set for the panel declares `border: 1px solid var(--divider)`, `border-radius: 0`, `background: var(--surface)`, `position: relative`, padding `var(--space-4)`; corner rule declares `11px` box, `-6px` offsets, `1px` strokes, `var(--text)` @ `opacity: 0.35` | Static assertion fails loudly if any declaration is missing/changed |
| `as` override | `<BlueprintPanel as="section" aria-label="Trace">` | root element is `<section>` with `aria-label="Trace"` and the `blueprint-panel` class | No error expected |
| className / style merge | `<BlueprintPanel className="feed-row" style={{marginTop: 4}}>` | root has both `blueprint-panel` and `feed-row` classes; inline style includes `margin-top` plus any component base style — caller values win on conflict | No error expected |
| Prop forwarding | `<BlueprintPanel role="log" data-incident="x" onClick={fn}>` | `role="log"` and `data-incident="x"` appear on the root; clicking it calls `fn` once | No error expected |
| Ref forwarding | `ref` passed to `<BlueprintPanel>` | ref resolves to the rendered root DOM node | No error expected |
| Padding override | padding prop / CSS var set by caller | inner content padding reflects the override, not the 13.6px default | No error expected |
| No children | `<BlueprintPanel />` | renders the bordered box with four corner marks and no content; does not throw | No error expected |

</intent-contract>

## Code Map

- `frontend/src/theme/tokens.css` + `tokens.ts` -- Story 2.1 token layer; consume `--surface`, `--divider`, `--text`, `--space-4`. Do not modify.
- `frontend/src/index.css` -- global base styles; `*{box-sizing:border-box;margin:0;padding:0}` already applies. Blueprint panel CSS is co-located, not added here.
- `frontend/src/theme/tokens.test.ts` -- Story 2.1's guardrail suite currently scans a hardcoded file list (`index.css`, `App.tsx`) for stray hex / bad radius / unresolved `var(--…)`. Generalize its file list to glob `src/**/*.css` + `src/**/*.tsx` so the new component CSS is covered automatically (kills the "scan too narrow" review finding class).
- `_bmad-output/.../mockups/live-console.html` -- `.blueprint` (lines ~67-76) and `.corner` rules are the exact reference implementation for geometry.
- `_bmad-output/.../DESIGN.md` -- `components.blueprint-panel` front-matter map (border, radius, cornerMarkSize 11px, cornerMarkOffset -6px).
- `frontend/src/App.tsx` -- may render one `<BlueprintPanel>` in the demo shell to exercise it end to end; keep the shell minimal and non-layout.
- `frontend/package.json` -- add React Testing Library devDeps (`@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`) — foundational for 2.2–2.9 component tests.

## Tasks & Acceptance

**Execution:**
- `frontend/src/components/BlueprintPanel/BlueprintPanel.tsx` -- the component. Typed props extend the intrinsic element props for `as` (default `'div'`); render root element with merged class `blueprint-panel` + caller `className`, merged `style`, spread rest props, forwarded ref; render `children` then four `<span className="blueprint-panel__corner blueprint-panel__corner--tl|tr|bl|br" aria-hidden="true" />`. Keep the polymorphic typing pragmatic (a small generic or an `ElementType` + `ComponentPropsWithRef` union) — do not over-engineer.
- `frontend/src/components/BlueprintPanel/BlueprintPanel.css` -- co-located styles for `.blueprint-panel` and `.blueprint-panel__corner*` per the Always list; padding via `padding: var(--blueprint-panel-padding, var(--space-4))` so a caller can override with the `--blueprint-panel-padding` custom property; corners `position:absolute`, `pointer-events:none`.
- `frontend/src/components/BlueprintPanel/index.ts` -- re-export `BlueprintPanel` and its props type.
- `frontend/src/components/BlueprintPanel/BlueprintPanel.test.tsx` -- Vitest + RTL suite covering every I/O & Edge-Case Matrix row: render/children, four `aria-hidden` corners with `pointer-events:none`, `as` override, className+style merge, arbitrary prop + `onClick` forwarding, ref forwarding, padding override, empty render. Plus a static scan of `BlueprintPanel.css` text asserting each required declaration string is present and no stray hex / no `border-radius` other than `0`.
- `frontend/vite.config.ts` -- set `test.css: true` (or a setup file) so the co-located CSS import does not break jsdom rendering; add a Vitest `setupFiles` importing `@testing-library/jest-dom` if used.
- `frontend/src/theme/tokens.test.ts` -- generalize the guardrail file list from the hardcoded pair to `src/**/*.css` + `src/**/*.tsx` (exclude test files); keep all existing assertions.
- `frontend/src/App.tsx` -- (optional) wrap the demo content in one `<BlueprintPanel>` to exercise it; no layout work.

**Acceptance Criteria:**
- Given the `BlueprintPanel` component, when rendered, then its container has a 1px `var(--divider)` border, `border-radius: 0`, and four 11px crosshair corner marks positioned 6px outside each corner (verified by DOM structure + a static assertion over the component CSS).
- Given a caller passes `className`, `style`, `as`, a `ref`, or arbitrary DOM props (`role`, `aria-*`, `data-*`, `onClick`), when the panel renders, then all are applied to the same root element and the component's own class/style still apply.
- Given the four corner marks, when the panel renders, then each is `aria-hidden` and does not intercept pointer events (a click on panel content still reaches the content's handler).
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, production build, and all tests (including Story 2.1's, still green) pass.

## Spec Change Log

## Review Triage Log

### 2026-08-27 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 2, low 4)
- defer: 2: (high 0, medium 0, low 2)
- reject: 7: (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` The Story 2.1 token guardrail was loosened while being generalized to a `src/**` glob (the direction it exists to protect 2.3–2.9): per-file token-ref floor collapsed to a repo-wide aggregate; `var(--x, fallback)` refs skipped entirely; CSS named colors and `.ts` files not scanned; `readdirSync` could hand a directory to `readFileSync`. Tightened all of these — `withFileTypes`+`isFile`, `.ts` scanned, `//` comments stripped consistently, `OVERRIDE_HOOKS` allowlist so a typo'd hooked var still fails, CSS named-color blocklist, `endsWith` exclusion, positive "glob covered these files" assertions, and a per-file `var(--…)` floor gated on a styling signal.
  - `[medium]` `[patch]` The "EXACT match to DESIGN.md `components.blueprint-panel`" claim was only a code comment (Story 2.1's token test parses DESIGN.md; this did not). Added a conformance test parsing `DESIGN.md` front-matter (border, radius, cornerMarks, cornerMarkSize 11px, cornerMarkOffset -6px) and asserting `BlueprintPanel.css` implements it; declaration assertions made whitespace-tolerant.
  - `[low]` `[patch]` `--blueprint-panel-padding` was an undocumented public override with no CSS registration — added an `@property` descriptor (`<length-percentage>`, initial 13.6px) and a README "Override hooks" section.
  - `[low]` `[patch]` Added explicit `box-sizing: border-box` to `.blueprint-panel` (self-contained regardless of the global reset) and a comment deriving the `5px` crosshair offset as `(11 - 1) / 2`.
  - `[low]` `[patch]` Test hardening: value now imported from the `./index` barrel (the real 2.3–2.9 entry); added `as="section"` + `ref` runtime-tag test, a corner-marks-follow-children DOM-order test, `userEvent.setup()`, and `expectTypeOf` assertions replacing a no-op runtime "props type" check.
  - `[low]` `[patch]` `vitest.setup.ts`: corrected the comment misattributing `toBeInstanceOf` to jest-dom; added `afterEach(cleanup)` so DOM teardown is robust if `globals` is later disabled.

## Design Notes

Corner-mark markup (matches `mockups/live-console.html` exactly):
```css
.blueprint-panel { position: relative; background: var(--surface);
  border: 1px solid var(--divider); border-radius: 0;
  padding: var(--blueprint-panel-padding, var(--space-4)); }
.blueprint-panel__corner { position: absolute; width: 11px; height: 11px; pointer-events: none; }
.blueprint-panel__corner::before, .blueprint-panel__corner::after {
  content: ""; position: absolute; background: var(--text); opacity: 0.35; }
.blueprint-panel__corner::before { width: 11px; height: 1px; top: 5px; left: 0; }
.blueprint-panel__corner::after  { width: 1px; height: 11px; top: 0; left: 5px; }
.blueprint-panel__corner--tl { top: -6px; left: -6px; }
.blueprint-panel__corner--tr { top: -6px; right: -6px; }
.blueprint-panel__corner--bl { bottom: -6px; left: -6px; }
.blueprint-panel__corner--br { bottom: -6px; right: -6px; }
```

Polymorphic `as`: prefer a minimal typing that keeps `ref` correct for the default `div` and permits common elements (`section`, `article`, `button`, `li`) without a full HOC-style generic. If strict polymorphic ref typing gets heavy, it is acceptable to type `as?: React.ElementType` and `ref` as the default-element ref — a documented pragmatic tradeoff, not a gap.

jsdom note: `getComputedStyle` does not resolve stylesheet-derived `var()` cascades, so border/radius/geometry are verified by (a) DOM structure assertions and (b) a static text scan of `BlueprintPanel.css` — the same technique Story 2.1 uses. Do not rely on `toHaveStyle` for the token-driven properties.

## Verification

**Commands:**
- `cd frontend && npm install` -- expected: RTL devDeps resolve, no error.
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test -- --run` -- expected: Story 2.1 suite + `BlueprintPanel.test.tsx` all pass; every I/O matrix row has a passing assertion; 0 failures.

## Auto Run Result

Status: done

**Implemented change:** Added `BlueprintPanel`, the shared Portwatch visual container primitive, under `frontend/src/components/BlueprintPanel/`: a `forwardRef` polymorphic (`as`) React component rendering a bordered, square, `--surface` box with four decorative 11px crosshair corner marks offset −6px outside each corner, all driven by Story 2.1 tokens. Caller `className`/`style` merge, arbitrary DOM props spread onto the root, corner marks are `aria-hidden` + `pointer-events:none`, padding overridable via the registered `--blueprint-panel-padding` custom property (default `--space-4`). Story 2.1's token guardrail suite was generalized from a hardcoded `(index.css, App.tsx)` pair to a `src/**/*.{css,ts,tsx}` glob (then hardened — see triage) so 2.3–2.9 component styling is covered automatically.

**Files changed:**
- `frontend/src/components/BlueprintPanel/BlueprintPanel.tsx` — the component (new).
- `frontend/src/components/BlueprintPanel/BlueprintPanel.css` — co-located styles; `@property --blueprint-panel-padding`, `box-sizing:border-box`, exact DESIGN.md/mock geometry (new).
- `frontend/src/components/BlueprintPanel/index.ts` — barrel re-export (new).
- `frontend/src/components/BlueprintPanel/BlueprintPanel.test.tsx` — 23-test RTL + static-scan + DESIGN.md-conformance suite (new).
- `frontend/vitest.setup.ts` — jest-dom matchers + `afterEach(cleanup)` (new).
- `frontend/vite.config.ts` — `test.css: true`, `test.setupFiles`.
- `frontend/tsconfig.test.json` — include `vitest.setup.ts`.
- `frontend/package.json` / `package-lock.json` — `@testing-library/{react,dom,jest-dom,user-event}` devDeps.
- `frontend/src/theme/tokens.test.ts` — guardrail generalized + hardened (90 assertions, up from 64).
- `frontend/src/App.tsx` — demo shell content wrapped in one `<BlueprintPanel as="section">` (non-layout).
- `frontend/README.md` — "Components" / "Override hooks" section.

**Review findings breakdown:** 6 patches applied (0 high, 2 medium, 4 low) — see Review Triage Log. 2 deferred (focus-visible treatment for interactive panels; ~6px overflow when a panel is flush to a container edge — both low, both land with Story 2.3+). 7 rejected as noise (`as`-misuse runtime guards for custom-component/void/Fragment; `dangerouslySetInnerHTML` collision guard; a single-use `--corner-mark-opacity` token; `css:true` rationale nit; exporting the private `CORNER_SUFFIXES` for tests; `getComputedStyle`/snapshot geometry — jsdom can't; `box-sizing` "relies on global reset" — now moot, added explicitly).

**Follow-up review recommended:** true. This pass's patch findings — high 0, medium 2, low 4; score `3×2 + 1×4 = 10` (≥ 5).

**Verification performed:**
- `npm install` — PASS (0 vulnerabilities).
- `npm run build` (`tsc -b && vite build`) — PASS (app/node/test projects typecheck under strict, incl. `expectTypeOf`; `dist/` emitted).
- `npm test -- --run` — PASS (2 files, 113 assertions, 0 failures; `tokens.test.ts` 90, `BlueprintPanel.test.tsx` 23). Story 2.1's contract suite still green.
- Matrix Test Audit — every I/O & Edge-Case Matrix row is covered by a test that ran and passed.

**Residual risks:**
- Token-driven visual properties (border, radius, corner geometry) are verified by DOM structure + static CSS text scan + a DESIGN.md-parse conformance check, not by a rendered cascade — jsdom does not resolve CSS custom-property cascades.
- The polymorphic `ref` is typed to `HTMLDivElement` regardless of `as` (spec-sanctioned pragmatic tradeoff); runtime behavior with `as="section"` is now test-covered, but a consumer using `as="li"` gets a nominally wrong ref type.
- `@property` at-rules are inert under jsdom; they affect real browsers only, and no test depends on applied CSS.
