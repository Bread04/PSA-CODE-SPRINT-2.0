---
title: 'Story 2.1: Design Token System'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'aaaeba1141a975423b46ee2f448d2b794fd4c180'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/mockups/live-console.html'
warnings: []
deferred:
  - summary: >-
      Frontend has no ESLint / Prettier / .editorconfig setup; the "no ad hoc hex / no
      arbitrary px" guardrail ACs are practically a lint-rule job and are currently
      enforced only by a bespoke Vitest text scan.
    evidence: |-
      Standard Vite react-ts template ships an ESLint config; this scaffold dropped it.
      Story 2.1 intent scopes the story to "the theme and a minimal app shell only", so
      tooling setup was left out. Later Epic 2 component stories will benefit from lint
      enforcement landing before feature code.
    location: >-
      frontend/
    severity: low
  - summary: >-
      No CI workflow runs `tsc -b` + the token contract suite on changes, so a token
      mismatch or drift from DESIGN.md could merge undetected.
    evidence: |-
      The token contract suite's value is automatic drift detection; nothing invokes it
      outside a manual run. Out of scope for Story 2.1 (no CI mention in the intent or
      epic-2 context).
    location: >-
      frontend/ (repo CI config)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Epic 2 is a greenfield React 19 + TypeScript + Vite operator console, but no `frontend/` app exists and there is no shared theme. Every later Epic 2 component (2.2–2.9) needs one canonical implementation of DESIGN.md's exact token set so components never reinvent colors, type, spacing, or radius (UX-DR1).

**Approach:** Scaffold the `frontend/` Vite + React + TS app, then implement DESIGN.md's token set once as (a) CSS custom properties applied at `:root` and consumed globally, and (b) a typed TypeScript token object mirroring the same values. Self-host the Barlow / Barlow Condensed fonts via `@fontsource` so the type spec holds offline. This story ships the theme and a minimal app shell only — no incident UI.

## Boundaries & Constraints

**Always:**
- Token values match DESIGN.md's front-matter EXACTLY (colors, spacing scale, radius, typography, layout dimensions). DESIGN.md is the single source of truth; where the `live-console.html` mock differs, DESIGN.md wins.
- Every color is exposed as a named token (`--bg`, `--surface`, `--divider`, `--text`, `--accent-100`…`--accent-900`, `--accent-2`, `--accent-2-100`, `--accent-2-900`, `--neutral-100`, `--neutral-300`, `--neutral-500`, `--neutral-700`, `--neutral-900`). No literal hex outside the token definition files.
- Spacing tokens derive from the 3.4px base: `--space-1: 3.4px`, `--space-2: 6.8px`, `--space-3: 10.2px`, `--space-4: 13.6px`, `--space-6: 20.4px`, `--space-8: 27.2px`. Layout: `--header-height: 54px`, `--col-left: 296px`, `--col-right: 400px`.
- Radius tokens: `--radius-sm`, `--radius-default`, `--radius-md`, `--radius-lg` all `0`; `--radius-tag: 3px`; `--radius-full: 9999px`.
- Font tokens: `--font-heading` is a stack led by `"Barlow Condensed"`; `--font-body` is a stack led by `"Barlow"`. `--font-weight-heading: 600`, `--font-weight-body: 400`. Named type-role tokens for micro-label (11px / 0.14em / uppercase), incident title (29px), confidence readout (38px).
- The CSS token layer and the TS token object expose the same values — a mismatch is a bug.
- App builds and typechecks with `strict` TypeScript. Fonts load from a bundled dependency, not a network CDN.
- New code lives under `frontend/`. Do not touch `backend/`.

**Block If:**
- DESIGN.md and epic-2-context.md give conflicting token values that cannot be reconciled by "DESIGN.md wins".
- A required token value is absent from DESIGN.md and cannot be derived from the stated scale.

**Never:**
- No incident feed, detail, approval, trace, map, chat, kill-switch, or routing components — those are stories 2.2–2.9.
- No Tailwind, CSS-in-JS runtime, MUI, or other component/utility framework. Plain CSS custom properties + a TS module only.
- No second hue family for "success"/"danger". No `border-radius` other than the tag 3px anywhere in shipped CSS.
- No responsive breakpoints; desktop-only is a later concern, not this story's.
- Do not add a state-management library, data fetching, or API calls.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Heading type token consumed | an element styled with `font-family: var(--font-heading)` / `--font-weight-heading` | resolved `font-family` string lists `Barlow Condensed` as the first family; weight token is `600` | No error expected |
| Body type token consumed | an element styled with `var(--font-body)` / `--font-weight-body` | resolved `font-family` lists `Barlow` as the first family; weight token is `400` | No error expected |
| Accent color token requested | `--accent-600` | resolves to `#597ea3`; full ramp 100–900 present with DESIGN.md hexes | No error expected |
| Default radius token requested | `--radius-default` (and `sm`/`md`/`lg`) | resolves to `0` | No error expected |
| Tag radius token requested | `--radius-tag` | resolves to `3px` | No error expected |
| Panel-padding spacing token requested | `--space-3` / `--space-4` | resolve to `10.2px` / `13.6px` (both inside the 10–18px panel-padding range) | No error expected |
| TS token object vs CSS layer | `tokens.ts` values compared to the `tokens.css` declarations | every shared key holds an identical value | Test fails loudly on any mismatch |

</intent-contract>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md` -- token source of truth: front-matter `colors`, `typography`, `rounded`, `spacing`, `components` maps hold every value to implement.
- `_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/mockups/live-console.html` -- reference only: shows the offline font fallback stack (`"Barlow Condensed","Oswald","Arial Narrow",sans-serif` / `Barlow,Arial,sans-serif`) and `--divider: rgba(29,31,32,0.16)` as the concrete equivalent of DESIGN.md's `color-mix` divider.
- `_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md` -- Stack table (React 19.2.8, TypeScript 5.x, Vite 8.1.3) and the `frontend/src/{routes,components}/` source-tree seed.
- `frontend/` -- does not exist yet; create the Vite React-TS app here.
- `backend/` -- untouched; read-only reference for repo conventions (pytest.ini style, no monorepo tooling).

## Tasks & Acceptance

**Execution:**
- `frontend/package.json` -- scaffold a Vite React + TS app (`react` 19.x, `react-dom` 19.x, `vite` ^8, `typescript` ~5.x, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@fontsource/barlow`, `@fontsource/barlow-condensed`). Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `test` (`vitest`).
- `frontend/tsconfig.json` (+ `tsconfig.node.json`) -- standard Vite React-TS config with `"strict": true`.
- `frontend/vite.config.ts` -- React plugin; `test` block with `environment: "jsdom"`, `globals: true`.
- `frontend/index.html` -- root HTML, `#root`, title "Portwatch Console", `<html lang="en">`.
- `frontend/src/main.tsx` -- React 19 `createRoot` entry; import the font packages (weights 400 + 600 for Barlow, 600 for Barlow Condensed) and `./theme/tokens.css` and `./index.css`.
- `frontend/src/theme/tokens.css` -- all design tokens as `:root` custom properties per the Boundaries list. Single place literal hex/px values may appear.
- `frontend/src/theme/tokens.ts` -- typed token object (`export const tokens = { color: {...}, space: {...}, radius: {...}, font: {...}, layout: {...} } as const`) mirroring `tokens.css` exactly; export helper types.
- `frontend/src/index.css` -- base element styles wired to tokens only: `body` uses `--font-body`/`--font-weight-body`/`--bg`/`--text`; headings + `button` use `--font-heading`/`--font-weight-heading`; `*{box-sizing:border-box;margin:0;padding:0}`; `:root{ color-scheme: light }`. No hardcoded colors/radii.
- `frontend/src/App.tsx` -- minimal shell: a single blueprint-less placeholder (header bar at `--header-height` + a line of body text + one `<button>`) that visually exercises heading, body, accent, and spacing tokens. Not a real layout.
- `frontend/src/theme/tokens.test.ts` -- Vitest suite covering every I/O & Edge-Case Matrix row: assert `tokens.ts` values equal the DESIGN.md values; parse `tokens.css` text and assert each declaration string is present with the matching value; assert `tokens.ts` and the parsed `tokens.css` agree on every shared key; assert no `border-radius` value other than `0`, `3px`, or `9999px` appears in `tokens.css`.
- `frontend/README.md` -- one short paragraph: what the app is, `npm install` / `npm run dev` / `npm test`, and that `src/theme/` is the DESIGN.md token system.
- `frontend/.gitignore` -- `node_modules`, `dist`, coverage.

**Acceptance Criteria:**
- Given the frontend theme is initialized, when any heading, label, data value, or `<button>` renders, then its font resolves through `--font-heading` (Barlow Condensed, weight 600) and body text resolves through `--font-body` (Barlow, weight 400).
- Given any surface needs an accent color, when it is styled, then the value comes from a `--accent-*` (100–900) or `--accent-2*` token — the repo contains no ad hoc accent hex outside `tokens.css` / `tokens.ts`.
- Given any shape in the shipped CSS, when rendered, then its `border-radius` is `0`, except the tag token which is `3px` (`--radius-full` exists but is unused in this story).
- Given any panel padding or spacing value, when applied, then it references a `--space-*` token derived from the 3.4px base (panel padding uses `--space-3`/`--space-4` = 10.2/13.6px, inside 10–18px), never an arbitrary pixel literal.
- Given a clean checkout, when `npm install && npm run build && npm test` runs in `frontend/`, then install, typecheck, production build, and all token tests pass.

## Spec Change Log

## Review Triage Log

### 2026-08-27 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 2, low 7)
- defer: 2: (high 0, medium 0, low 2)
- reject: 8: (high 0, medium 0, low 8)
- addressed_findings:
  - `[medium]` `[patch]` tokens.test.ts compared tokens against a hand-transcribed copy of DESIGN.md — a transcription typo would pass green. Test now parses the real DESIGN.md front-matter (`colors`/`typography`/`rounded`/`spacing`) as the sole comparison baseline, via a dep-free YAML front-matter parser.
  - `[medium]` `[patch]` Guardrail assertions only scanned `tokens.css`. Added a suite that also reads `src/index.css` and `src/App.tsx`: no raw hex literal, no `border-radius` (incl. longhand) outside `0`/`3px`/`9999px`/`var(--radius-*)`, and every referenced `var(--NAME)` resolves to a property declared in `tokens.css`.
  - `[low]` `[patch]` `npm test` ran Vitest in watch mode — changed to `vitest run`; added `test:watch`.
  - `[low]` `[patch]` `tsconfig.app.json` leaked `vitest/globals`+`node` types into the whole app tree and compiled test files in the production `tsc -b` — dropped the `types` leak, excluded `*.test.ts(x)` from the app project, added a referenced `tsconfig.test.json` so tests stay typechecked.
  - `[low]` `[patch]` Hardened `tokens.test.ts` parser: duplicate `--name` declaration throws; px-literal regex tightened to `\d+(?:\.\d+)?px`; `tokens.css` path resolves via `import.meta.dirname ?? dirname(fileURLToPath(import.meta.url))`; `readFileSync` calls rethrow with a clear "not found at <path>" message.
  - `[low]` `[patch]` Added bidirectional exhaustiveness checks — no undocumented extra `--*` token in `tokens.css`, every DESIGN.md-derived token declared, every `tokens.ts` leaf maps to a CSS declaration; shared/expected lists derived from parsed sources instead of hand-maintained.
  - `[low]` `[patch]` Removed the unused, untyped `cssVar()` helper from `tokens.ts` (kept the exported helper types).
  - `[low]` `[patch]` `index.html`: added `meta description`, an inline `data:` URI SVG favicon, and a `noscript` line. `App.tsx`: header title is now an `<h1>` so a real heading element exercises the heading token.
  - `[low]` `[patch]` `package.json`: added `"engines": { "node": ">=20.11" }` (test relies on `import.meta.dirname`).

## Design Notes

Font strategy: `@fontsource/barlow` + `@fontsource/barlow-condensed` self-host the real faces so "uses Barlow Condensed (600)" is literally true offline. The token stacks still carry fallbacks (`"Barlow Condensed","Oswald","Arial Narrow",sans-serif` and `Barlow,Arial,sans-serif`) matching the mock, so a missing face degrades sensibly.

Divider token: DESIGN.md specifies `color-mix(in srgb, #1d1f20 16%, transparent)`. Ship that as `--divider` (modern browsers support it); `tokens.ts` may record the equivalent `rgba(29,31,32,0.16)` — note the equivalence in a comment so the mismatch check knows they are intentionally paired.

Golden shape for `tokens.ts`:
```ts
export const tokens = {
  color: { bg: '#f2f2f3', surface: '#e9e9ea', text: '#1d1f20',
           accent: { 100:'#eef6ff', /* …600:'#597ea3'… */ 900:'#1d2d3d' } },
  space: { 1: '3.4px', 2: '6.8px', 3: '10.2px', 4: '13.6px', 6: '20.4px', 8: '27.2px' },
  radius: { default: '0', tag: '3px', full: '9999px' },
  layout: { headerHeight: '54px', colLeft: '296px', colRight: '400px' },
} as const;
```

## Verification

**Commands:**
- `cd frontend && npm install` -- expected: completes with no error; `@fontsource/*` packages resolve.
- `cd frontend && npm run build` -- expected: `tsc -b` passes under strict mode and `vite build` emits `dist/` with no error.
- `cd frontend && npm test -- --run` -- expected: Vitest runs `src/theme/tokens.test.ts`; every matrix-row assertion passes; 0 failures.

## Auto Run Result

Status: done

**Implemented change:** Scaffolded the greenfield `frontend/` Vite + React 19 + TypeScript app and implemented DESIGN.md's token set as the shared theme: `src/theme/tokens.css` (`:root` custom properties — the only place literal hex/px live), `src/theme/tokens.ts` (typed `as const` mirror + helper types), `src/index.css` (base element styles wired to tokens), self-hosted Barlow / Barlow Condensed via `@fontsource`, and a minimal non-layout `App.tsx` shell that exercises the heading/body/accent/spacing tokens. A Vitest contract suite parses the real `DESIGN.md` front-matter and fails on any drift between it, `tokens.ts`, and `tokens.css`, plus guardrail scans over `index.css`/`App.tsx`.

**Files changed (all new, under `frontend/`):**
- `package.json`, `package-lock.json` — Vite React-TS app; deps `react`/`react-dom` 19, `@fontsource/barlow`, `@fontsource/barlow-condensed`; `engines.node >=20.11`; scripts `dev`/`build`/`preview`/`test` (`vitest run`)/`test:watch`.
- `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` + `tsconfig.test.json` — strict solution-style config; test files in their own referenced project, not the app build graph.
- `vite.config.ts` — React plugin; `test` block (`jsdom`, globals).
- `index.html` — root HTML, `lang="en"`, meta description, inline `data:` favicon, `noscript`.
- `src/main.tsx` — React 19 `createRoot`; imports font faces + `tokens.css` + `index.css`.
- `src/theme/tokens.css` — all design tokens as `:root` custom properties.
- `src/theme/tokens.ts` — typed token object + exported helper types.
- `src/theme/tokens.test.ts` — DESIGN.md-parsed contract suite + consumer guardrails + exhaustiveness checks (64 assertions).
- `src/index.css` — token-wired base element styles.
- `src/App.tsx` — minimal token-exercising shell (`<h1>` header + body line + accent `<button>`).
- `src/vite-env.d.ts`, `README.md`, `.gitignore`.

**Review findings breakdown:** 9 patches applied (0 high, 2 medium, 7 low) — see Review Triage Log. 2 deferred (ESLint/Prettier setup; CI drift-detection workflow — both low). 8 rejected as noise (light-only palette is per DESIGN.md not an omission; line-height tokens absent from DESIGN.md; type-role tokens intentionally unconsumed until later stories; speculative CSS-parser edge cases with no current failure; coverage tooling not required; jsdom `getComputedStyle` render test not meaningful for `var()` cascades).

**Follow-up review recommended:** true. This pass's patch findings — high 0, medium 2, low 7; score `3×2 + 1×7 = 13` (≥ 5).

**Verification performed:**
- `npm install` — PASS (117 packages, 0 vulnerabilities; `@fontsource/*` resolved).
- `npm run build` (`tsc -b && vite build`) — PASS (app/node/test projects typecheck under strict; `dist/` emitted).
- `npm test -- --run` (`vitest run`) — PASS (1 file, 64/64 assertions, 0 failures).
- Matrix Test Audit — every I/O & Edge-Case Matrix row is covered by a test that ran and passed.

**Residual risks:**
- The contract suite reads `DESIGN.md` via a relative path out of `frontend/`; if that planning artifact moves, the suite fails loudly (`"DESIGN.md not found at <path>"`) rather than silently passing.
- Token consumption is verified by static text scan (hex/radius/`var()` resolution), not by a rendered-cascade assertion — jsdom does not resolve CSS custom-property cascades, so a full computed-style check was judged not worthwhile at this layer.
- Resolved dependency versions float above the arch-spine pins (`vite` 8.2.2 vs 8.1.3, `vitest` 4.x, `typescript` 5.9.3) — all within the spec's `^8` / `~5.x` ranges.
