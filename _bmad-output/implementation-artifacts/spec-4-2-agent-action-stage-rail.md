---
title: 'Agent-action stage rail'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_revision: 'c20cc24f6642170363b2ac4f9c5300b8062e2d86'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - frontend/src/components/ExecutionTrace/ExecutionTrace.tsx
  - _bmad-output/implementation-artifacts/epic-4-context.md
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** An operator following an in-flight incident can only read the raw `ExecutionTrace` text log to know where the AI pipeline is. Epic 4 / UX-DR13 wants a compact at-a-glance stage rail — INGEST … VERIFY — showing which stages are done, which is active, and which errored, without replacing the authoritative trace.

**Approach:** Add a pure derivation `frontend/src/lib/stageRail.ts` that folds an incident's `trace` (`TraceEntry[]`) into a fixed ordered list of rail stages each tagged `done | active | error | pending`, and a read-only `StageRail` component that renders it inside a `BlueprintPanel` with per-stage state carried by shape **and** text (never colour alone). Wire it into the Live Console centre column next to the map. Frontend-only; reads the already-polled trace; no backend, endpoint, `Incident` schema, or golden-path change; `ExecutionTrace` is untouched and remains the detailed log.

## Boundaries & Constraints

**Always:** Rail state is derived **only** from `trace` entries — never from `incident.tier` / `status` / `approval_status`. The rail stage list is fixed and ordered: `INGEST, CORRELATE, ANALYSE, SYNTHESIZE, CONFIDENCE, POLICY, DG CHECK, APPROVAL, EXECUTE, VERIFY` (a compact projection of the backend `STAGES` vocabulary — `ANALYSE` maps the 1–3 `AGENT_CALL` entries; `POLICY` maps `POLICY_START`/`POLICY_DECISION`; bookkeeping stages `NOTIFY` are not shown). A rail stage is `done` when a trace entry maps to it or to any later rail stage; `active` when the newest trace entry maps to it and no later stage has any entry; `error` when a trace entry mapping to it carries `.error` or `detail.retried` / `detail.fallback_used` / `detail.blocked` truthy (error wins over done/active for that stage); `pending` otherwise. An unknown / unmapped trace stage is ignored (does not crash, does not advance the rail). Each rail stage is announced to assistive tech with its state (visible text label + a per-`<li>` accessible name); state also differs by shape/iconography, per UX-DR11. The component renders inside `BlueprintPanel`, adds **no** new interactive controls (no `button`, no `tabindex > -1`, no click/hover handlers), and all CSS colour values route through Story 2.1 tokens (`var(--*)` / `currentColor` / `none`) with every `border-radius` `0` or `var(--radius-*)`. With `incident == null` the rail renders all stages `pending` (degraded-safe, no error). `npm run verify` (lint + build + test) and `npx tsc -b` stay green.

**Block If:** (none — pure derivation over an existing shape; fully automatable.)

**Never:** No change to `ExecutionTrace` / its tests, the backend, `models/incident.py`, or the polling layer. No red/amber/green vocabulary. No new route or endpoint. The rail is not a decision surface — approve/reject stays on the approval banner. No `!` or emoji in any user-facing string.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| MID_PIPELINE | trace ends at `AGENT_CALL` (entries: `CORRELATE`, `AGENT_CALL`) | `INGEST`+`CORRELATE` = `done`, `ANALYSE` = `active`, `SYNTHESIZE`…`VERIFY` = `pending` | n/a |
| ERROR_STAGE | an `EXECUTE` entry with `.error` set (and later `VERIFY` absent) | `EXECUTE` = `error` with an `ERROR` text flag + distinct shape; earlier stages `done`; `VERIFY` `pending` | error state shown even though an `EXECUTE` entry exists (not `done`) |
| RETRY_FLAG | an `AGENT_CALL` entry with `detail.retried === true`, trace continues past it | `ANALYSE` = `error` (flag `RETRY`), later reached stages still `done` | retry/fallback treated as an error-class marker, label not colour-only |
| COMPLETE | trace ends at `VERIFY` (no error entries) | every rail stage `done`; rail shows the terminal state; `ExecutionTrace` unchanged | n/a |
| NO_INCIDENT | `incident = null` (or `trace = []`) | all 10 rail stages render `pending`; one `role`-grouped region; no throw, no error state | n/a |
| UNKNOWN_STAGE | trace contains `stage: "WEATHER_CHECK"` between known stages | unknown entry ignored; rail state reflects only the mapped stages | no crash, no spurious `active` |
| KEYBOARD_SR | rail rendered, navigated by screen reader | each stage exposes its label and state as its accessible name; no focusable/interactive element added | n/a |

</intent-contract>

## Code Map

- `frontend/src/components/ExecutionTrace/ExecutionTrace.tsx` -- READ-ONLY reference: how a trace-consumer component reads `TraceEntry[]` (`entry.stage`, `entry.error`, `entry.detail.retried`/`fallback_used`), sorts by `timestamp`, keeps state non-colour-only (`markerLabel` → `ERROR`/`RETRY`/`FALLBACK` text). Do NOT modify.
- `backend/orchestrator/trace.py` -- `STAGES` tuple (`INGEST, CORRELATE, AGENT_CALL, SYNTHESIZE, CONFIDENCE, POLICY_START, POLICY_DECISION, DG_CHECK, APPROVAL, EXECUTE, NOTIFY, VERIFY`) — the producer vocabulary the rail projects from. READ-ONLY.
- `frontend/src/types/incident.ts` -- `TraceEntry { stage: string; timestamp: string; detail: Record<string,unknown>; error: TraceError | null }`, `Incident.trace`. No change.
- `frontend/src/components/BlueprintPanel/BlueprintPanel.tsx` -- `as` / `className` / `aria-*` passthrough; wrap the rail as `<BlueprintPanel as="section" aria-labelledby={headingId}>`.
- `frontend/src/App.tsx` -- centre column (`app-col--center`) currently: `<IncidentDetail/>` then `<GeoMapPanel incident={selected}/>`. Add `<StageRail incident={selected} />` after `GeoMapPanel`. `selected` is already the `Incident | null`.
- `frontend/src/App.test.tsx` -- `../api/client` stubbed with `allIncidents` / `tier3WithAlternatives`; extend for the composed rail + map on a selected fixture and update on selection change (epic-4-context: "App-level tests must cover the composed console rendering rail + map … updating on selection change").
- `frontend/src/test/fixtures/incidents.ts` -- fixture trace stages present: `AGENT_CALL, APPROVAL, CONFIDENCE, DG_CHECK, EXECUTE, POLICY_DECISION, SYNTHESIZE` — use these; `tier3WithAlternatives` ends on `APPROVAL`.
- `frontend/src/components/MapPanel/MapPanel.css` / `ExecutionTrace.css` -- token-discipline pattern (`--divider`, `--text`, `--text-muted`, `--accent-*`, `--space-*`, `--font-size-micro-label`, `--accent-900` marker dot, zero radius) to mirror in `StageRail.css`.

## Tasks & Acceptance

**Execution:**
- `frontend/src/lib/stageRail.ts` -- NEW pure module. Export `RAIL_STAGES: readonly { id: string; label: string; from: readonly string[] }[]` in the fixed order above (`ANALYSE.from = ['AGENT_CALL']`, `POLICY.from = ['POLICY_START','POLICY_DECISION']`, others map 1:1). Export `type RailState = 'done'|'active'|'error'|'pending'` and `type RailStageView = { id: string; label: string; state: RailState; flag: '' | 'ERROR' | 'RETRY' | 'FALLBACK' }`. Export `deriveRail(trace: TraceEntry[] | null | undefined): RailStageView[]` implementing the Always rules: sort entries by `timestamp` (stable), map each to a rail-stage index via `from` (ignore unmapped), compute the furthest reached index, mark `< reached` = `done`, `=== reached` (newest maps here) = `active`, `> reached` = `pending`; then overlay `error` on any stage that has an entry with `entry.error` or truthy `detail.retried`/`detail.fallback_used`/`detail.blocked`, setting `flag` from `error.fallback_used→'FALLBACK'` / `error.retried→'RETRY'` / `error→'ERROR'` / `detail.fallback_used→'FALLBACK'` / `detail.retried→'RETRY'` (mirrors `ExecutionTrace.markerLabel`). Empty/nullish trace → every stage `pending`, `flag: ''`. Pure, total, no throw.
- `frontend/src/lib/stageRail.test.ts` -- NEW. Cover every I/O matrix row against `deriveRail` directly: MID_PIPELINE, ERROR_STAGE, RETRY_FLAG, COMPLETE (all `done`), NO_INCIDENT (`deriveRail([])` and `deriveRail(null)` → 10 × `pending`), UNKNOWN_STAGE (unmapped stage ignored, no spurious `active`), plus: `POLICY` maps both `POLICY_START` and `POLICY_DECISION`; `ANALYSE` stays a single stage across three `AGENT_CALL` entries; out-of-order timestamps still resolve the newest correctly; `error` overlay beats `done` on the same stage.
- `frontend/src/components/StageRail/StageRail.tsx` -- NEW. Props `{ incident: Incident | null; className?: string }`. `const stages = deriveRail(incident?.trace ?? [])`. Render `<BlueprintPanel as="section" className={['stage-rail', className?.trim()].filter(Boolean).join(' ')} aria-labelledby={headingId}>` → `<h3 id={headingId} className="stage-rail__heading">Pipeline</h3>` → `<ol className="stage-rail__list" role="list">`; each stage an `<li className={"stage-rail__item stage-rail__item--" + state} aria-label={`${label}: ${humanState}${flag ? ' (' + flag + ')' : ''}`}>` containing a shape span (`<span className="stage-rail__marker" aria-hidden="true" />` — CSS gives each state a distinct shape/glyph), the visible `<span className="stage-rail__label">{label}</span>`, a visible `<span className="stage-rail__state">{humanState}{flag && ` · ${flag}`}</span>`, where `humanState` = `done→'done'`, `active→'current'`, `error→'attention'`, `pending→'pending'`. No `tabindex`, no `button`, no handlers. Terminal state (all `done`) needs no special branch — every item simply reads `done`.
- `frontend/src/components/StageRail/StageRail.css` -- NEW. Token-only. `.stage-rail__list` flex (column at narrow width, wrap-friendly), `list-style:none`, `gap: var(--space-2)`, `padding:0`, `margin:0`. `.stage-rail__marker` a small square/again zero-radius; per-state shape differences via `clip-path` / borders / `--accent-900` fill for `error` (mirrors `ExecutionTrace` dot), hollow for `pending`, filled for `done`, ringed for `active`. `.stage-rail__state` `font-size: var(--font-size-micro-label); color: var(--text-muted)`. `error` item: `--accent-900` marker + the visible `attention · ERROR/RETRY/FALLBACK` text (never colour alone). No raw hex, no named colours, every `border-radius` `0` or `var(--radius-*)`.
- `frontend/src/components/StageRail/index.ts` -- NEW. `export { StageRail } from './StageRail';` + prop type.
- `frontend/src/components/StageRail/StageRail.test.tsx` -- NEW. Cover KEYBOARD_SR + render rows: one region named by its `<h3>`; exactly 10 `<li>`; no `button`, no positive `tabindex`, no `on*` attr; for a mid-pipeline fixture the correct items carry `--done` / `--active` / `--pending`; an error/retry fixture shows the `ERROR`/`RETRY` text in the item and the `--error` class; `incident={null}` → 10 `--pending` items, no `--error`; each `<li>` `aria-label` contains the stage label and its state word; CSS static scan mirroring `MapPanel.test.tsx` (no hex, colour props are `var(--*)`/`currentColor`/`none`, radius `0`/`var(--radius-*)`).
- `frontend/src/App.tsx` -- import `StageRail`; render `<StageRail incident={selected} />` in `app-col--center` immediately after `<GeoMapPanel incident={selected} />`.
- `frontend/src/App.test.tsx` -- add: with `allIncidents` stubbed and a row selected, the console shows the `Pipeline` rail region alongside the map, the rail reflects that incident's furthest stage, and selecting a different incident updates the rail. Do not weaken existing assertions.

**Acceptance Criteria:**
- Given a selected incident, when its trace is polled, then the rail renders the fixed stage list with reached stages `done`, the newest stage `active`, and any error/retry/fallback stage marked with a text flag and a distinct shape (not colour alone) — derived only from `trace`.
- Given the incident completes (a `VERIFY` entry with no error), when the rail renders, then every stage reads `done` and `ExecutionTrace` is unchanged and still the authoritative log.
- Given the rail navigated by keyboard / screen reader, when each stage is reached, then its accessible name states the stage label and its state, and the rail adds no focusable or interactive control.
- Given no incident is selected, when the console renders, then the rail shows all stages `pending` with no error state and no throw.
- Given the App-level tests, when they run, then the composed console renders the rail and the map for a selected fixture incident and both update on a selection change; `npm run verify` and `npx tsc -b` stay green; `frontend/src/components/ExecutionTrace/*` is byte-unchanged.

## Spec Change Log

- **2026-08-29 — review (no re-derive; implementation patches):**
  - The Always rule's `detail.blocked` error-overlay trigger over-matched: every Tier-3 `APPROVAL` hold carries `detail.blocked === true` with no `.error`, so a routine awaiting-approval incident rendered its `APPROVAL` rail stage in the error/"attention" style. `detail.blocked` was dropped from the error triggers (kept `.error`, `detail.retried`, `detail.fallback_used` — matching `ExecutionTrace.isMarkerRow`, which does not check `blocked`). Genuine blocks (kill-switch `EXECUTE`) still flag via their `.error`. KEEP: the error-overlay-beats-`done` behaviour and the `ERROR`/`RETRY`/`FALLBACK` flag priority.
  - Rail stage labels use the backend SCREAMING_SNAKE vocabulary (`AGENT_CALL`, `POLICY_DECISION`, `DG_CHECK`) per `epic-4-context.md`, not the invented `ANALYSE`/`POLICY`/`DG CHECK`. The collapse behaviour (one `AGENT_CALL` stage across the 3-way fan-out; `POLICY_DECISION` folds `POLICY_START`) is unchanged.
  - `VERIFY`, when reached with no earlier error, reads state word `complete` (the "terminal state" of epics.md Story 4.2 AC2), distinct from a plain `done` stage.

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14: (high 0, medium 1, low 13)
- defer: 0
- reject: 7: (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` `detail.blocked` was an error-overlay trigger, so every Tier-3 `APPROVAL` hold rendered its rail stage as error/"attention" — dropped `detail.blocked` from the triggers; added a `deriveRail` test that a blocked-only `APPROVAL` entry is not `error`.
  - `[low]` `[patch]` Rail labels `ANALYSE`/`POLICY`/`DG CHECK` were invented vocabulary — relabelled to `AGENT_CALL`/`POLICY_DECISION`/`DG_CHECK` (SCREAMING_SNAKE, per epic-4-context); collapse/`from` mappings unchanged; tests + `aria-label` regex updated.
  - `[low]` `[patch]` `VERIFY` had no distinct terminal indicator — reads state word `complete` when reached without an earlier error; test added.
  - `[low]` `[patch]` No `aria-current` on the active stage — added `aria-current="step"` to the active `<li>`; test added.
  - `[low]` `[patch]` `deriveRail` threw on a null/undefined trace element (breaking its total contract) — nullish entries skipped; test added.
  - `[low]` `[patch]` `detail.retried`/`fallback_used` checked with `=== true` instead of truthy per spec — switched to `Boolean(...)`; truthy-non-bool test added.
  - `[low]` `[patch]` App test asserted the map region is present but not that it updates on selection change — now asserts the map `aria-label` changes with selection alongside the rail.
  - `[low]` `[patch]` No test drove `error.fallback_used`→`FALLBACK` / `error.retried`→`RETRY` via the `error` object, nor multiple markers on one stage — flag-priority cases added.
  - `[low]` `[patch]` No "finished but degraded" coverage — added cases: `VERIFY` reached while an earlier stage keeps its `RETRY`/`FALLBACK` flag; `VERIFY` itself carrying `.error`.
  - `[low]` `[patch]` `deriveRail` re-ran every render and `?? []` was redundant — memoized on `incident?.trace`.
  - `[low]` `[patch]` `.stage-rail__state` (the non-shape meaning carrier, UX-DR11) used `--text-muted` micro-label — bumped to `--text` and `--font-size-caption` for legibility; token scan still passes.
  - `[low]` `[patch]` Visible text and `aria-label` state formats diverged with no shared source — both now derive from one `formatStageState` helper.
  - `[low]` `[patch]` `flex-wrap: wrap` was inert on the unbounded column — removed the dead property (the rail is a deliberate vertical stack, mirroring `ExecutionTrace`).
  - `[low]` `[patch]` The "out-of-order timestamps" test did not actually reorder its entries — rewritten to genuinely shuffle and assert the furthest-reached rule.

## Design Notes

Why `ANALYSE` collapses `AGENT_CALL`: the pipeline fans out to three specialist `AGENT_CALL` entries (berth/crane/yard) — an operator rail wants one "analysing" step, not three identical rows. `ExecutionTrace` keeps every row for the detailed view (UX-DR5).

Why error overlays rather than replaces: a stage can be both reached and flagged (a retried `AGENT_CALL` the pipeline moved past). The rail shows it as `error`-class with a `RETRY` flag so the operator sees the hiccup, while later stages still read `done` — matching how `ExecutionTrace.isMarkerRow` / `markerLabel` treat the same entries.

Golden `deriveRail` shape (state before error overlay):
```ts
const reached = Math.max(-1, ...entries.map(e => railIndexOf(e.stage)).filter(i => i >= 0));
stages.map((s, i) => ({ ...s, state: i < reached ? 'done' : i === reached ? 'active' : 'pending', flag: '' }));
```

## Verification

**Commands:**
- `cd frontend && npx tsc -b` -- expected: exit 0.
- `cd frontend && npm test -- --run` -- expected: all pass incl. new `stageRail` / `StageRail` / extended `App` tests; `ExecutionTrace` suite unchanged and green.
- `cd frontend && npm run lint` -- expected: no errors.
- `cd frontend && npm run build` -- expected: succeeds.

**Manual checks:**
- `git diff --stat` shows no changes under `frontend/src/components/ExecutionTrace/`.

## Auto Run Result

Status: done

### Implemented change

Epic 4 / UX-DR13 Story 4.2. New pure `frontend/src/lib/stageRail.ts` folds an incident's `trace` into a fixed 10-stage ordered rail (`INGEST, CORRELATE, AGENT_CALL, SYNTHESIZE, CONFIDENCE, POLICY_DECISION, DG_CHECK, APPROVAL, EXECUTE, VERIFY` — `AGENT_CALL` collapses the 3-way specialist fan-out, `POLICY_DECISION` folds `POLICY_START`), each tagged `done | active | error | pending` (+ `complete` for a reached terminal `VERIFY`). New read-only `StageRail` component renders it in a `BlueprintPanel` with per-stage state carried by shape **and** text (never colour alone), `aria-current="step"` on the active stage, and no interactive controls. Wired into the Live Console centre column after the map. Frontend-only; reads the already-polled trace; `ExecutionTrace` byte-unchanged and still the authoritative log.

### Files changed

- `frontend/src/lib/stageRail.ts` — NEW pure module: `RAIL_STAGES`, `RailState`/`RailStageView` types, `deriveRail(trace)` (timestamp-sorted, unmapped-stage-tolerant, nullish-element-safe, error overlay on `.error`/truthy `detail.retried`/`detail.fallback_used` — not `detail.blocked`).
- `frontend/src/lib/stageRail.test.ts` — NEW. Every I/O matrix row + POLICY dual-map, ANALYSE-single-across-3, genuine out-of-order reorder, error-overlay-beats-done, `error`-object flag priority, finished-but-degraded, blocked-only APPROVAL not error, malformed-entry no-throw.
- `frontend/src/components/StageRail/{StageRail.tsx,StageRail.css,StageRail.test.tsx,index.ts}` — NEW. `<ol role="list">` of 10 `<li>`, one shared `formatStageState` for visible + accessible text, token-only CSS with a distinct marker shape per state, `--font-size-caption`/`--text` on the state word.
- `frontend/src/App.tsx` — renders `<StageRail incident={selected} />` after `<GeoMapPanel>` in `app-col--center`.
- `frontend/src/App.test.tsx` — composed-console coverage: `Pipeline` rail + `Strait Map` for a selected fixture, rail reflects furthest stage, both rail and map update on selection change, rail resets to all-pending on an empty-trace incident.

### Review findings breakdown

- Patches applied: 14 (0 high, 1 medium, 13 low) — dropped `detail.blocked` from the error overlay (it flagged every routine Tier-3 approval hold as "attention"); relabelled invented `ANALYSE`/`POLICY`/`DG CHECK` to backend SCREAMING_SNAKE names; added a distinct `complete` terminal state at `VERIFY`; `aria-current="step"`; nullish-trace-element guard; truthy (not `=== true`) detail-flag checks; App test now also asserts the map updates on selection; flag-priority + finished-but-degraded + blocked-only test coverage; `useMemo`'d derivation; state text bumped to `--text`/`--font-size-caption` (UX-DR11 carrier); single `formatStageState`; removed inert `flex-wrap`; made the out-of-order test genuinely reorder.
- Deferred: 0.
- Rejected: 7 — inferred-`done` for skipped stages (how a rail works; the accessible name says "done", not "approved"), error-overrides-active at the frontier (documented I/O-matrix rule; ERROR/RETRY flag distinguishes), no automated "ExecutionTrace unchanged" guard (manual `git diff` is the project norm), furthest-index vs newest-timestamp `active` (spec's "no later stage has any entry" clause sanctions it), and test-surface-distribution observations (a pure-fold story is correctly tested at the fold).

### Follow-up review recommendation

`true`. This pass's patch findings: high 0, medium 1, low 13. Score `3 × 1 + 1 × 13 = 16` (≥ 5) → `followup_review_recommended: true`. No high-severity patch; driven by patch volume. A visual check of the rendered rail (marker-shape distinctness across the 5 states, vertical stack fit beside the map) is worth a human glance.

### Verification performed

- `cd frontend && npx tsc -b` → exit 0.
- `cd frontend && npm run lint` → exit 0, no errors/warnings.
- `cd frontend && npm test -- --run` → **712 passed** (23 files; +7 net vs the pre-patch 705; `ExecutionTrace` suite unchanged and green).
- `cd frontend && npm run build` → exit 0 (pre-existing ">500 kB chunk" advisory only — the story 4-1 atlas, unrelated).
- `git diff --stat` since baseline shows `frontend/src/components/ExecutionTrace/` byte-unchanged.

### Residual risks

- **`complete` vs `done` marker** — the `--complete` state shares `--done`'s filled-square marker (only the state word differs). No colour-only signal is introduced, but a purely-visual scan does not distinguish "pipeline finished" from "this stage done"; the word "complete" and (in practice) all-stages-done carry it.
- **Rail is vertical-only** — no responsive horizontal variant; it is a 10-item column beside the map, consistent with `ExecutionTrace`. Fine for the current 3-column layout; revisit if the centre column narrows.
- **Scope** — this run delivered Story 4.2; Epic 4 is now complete. Epic 3 stories 3.3–3.5 remain (handled by the surrounding `/loop`).
