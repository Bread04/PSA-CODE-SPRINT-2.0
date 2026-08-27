# Portwatch Console (frontend)

Greenfield React 19 + TypeScript + Vite operator console for Tuas Port disruption
orchestration (Epic 2). The Live Console (`App.tsx`) polls the backend
`GET /incidents` every 2-3s and drives the incident feed, detail + approval
banner, execution trace, natural-language query, kill switch, and a session-scoped
incident archive route (`#/archive`).

Run `npm install`, then:

| command | does |
|---|---|
| `npm run dev` | Vite dev server. Point it at the backend via `frontend/.env.development` (`VITE_API_BASE_URL`, defaults to `http://127.0.0.1:8000`); start the API with `python backend/run_api.py`. |
| `npm run build` | `tsc -b` strict typecheck + production build |
| `npm test` | Vitest suite (component, hook, contract, and `App` integration tests) |
| `npm run lint` | ESLint (flat config: typescript-eslint + react-hooks + jsx-a11y) |
| `npm run verify` | `lint` + `build` + `test` — what CI runs |

CI (`.github/workflows/ci.yml`) runs `verify` for the frontend and `pytest` for
the backend on every push / PR.

## Conventions

- **Design tokens.** `src/theme/tokens.css` is the only place literal hex / px
  colour + type values may live. Components consume `var(--*)`; secondary text
  uses `var(--text-muted)`, never `opacity` on `--text`. `tokens.test.ts`
  guardrail #6 fails any shipped `.css` with a raw hex, a named colour, a bare
  `font-size` px literal, a disallowed `border-radius`, or `opacity: 0.6` on
  text.
- **Barrels.** `src/components/<Name>/index.ts` re-exports the named component(s)
  and their prop `type`s only — no `default` re-export. Component files do not
  declare a `default` export either (`App.tsx` is the one entrypoint exception).
- **Hooks** that own a request are render-safe: serialised (a call while one is
  in flight is ignored), abort on unmount, never throw into render, expose
  `{ …state, submit/refetch, reset }`. `useApproval` is the reference shape.
- **i18n.** Not wired — user-facing strings are inline. A `strings` module is a
  deliberate non-goal for this single-locale console (recorded in the Epic 2
  retrospective).

`src/theme/` is the canonical DESIGN.md token system: `tokens.css` declares every
color, spacing, radius, layout, and typography value as a `:root` custom property
(the only place literal hex/px values may live), and `tokens.ts` is the typed
mirror of those same values. `src/theme/tokens.test.ts` fails loudly if the two
ever disagree or drift from DESIGN.md — and its consumer-guardrail scan now
covers every `.css` / `.ts` / `.tsx` file under `src/` (tokens definition files
and tests excluded).

## Components

`src/components/BlueprintPanel/` — the shared blueprint container primitive
(1px divider border, zero radius, four crosshair corner marks) used by every
incident card, the approval card, the trace log, and the map panels. Its visual
contract is verified against DESIGN.md `components.blueprint-panel` in
`BlueprintPanel.test.tsx`.

### Override hooks

- `--blueprint-panel-padding` — set this custom property on (or above) a
  `BlueprintPanel` to override its default padding (`--space-4`, 13.6px) without
  editing the component. Registered via `@property` in `BlueprintPanel.css` and
  allow-listed in `tokens.test.ts`.
