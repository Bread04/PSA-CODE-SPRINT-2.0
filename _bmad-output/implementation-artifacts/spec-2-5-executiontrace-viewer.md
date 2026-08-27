---
title: 'Story 2.5: ExecutionTrace Viewer'
type: 'feature'
created: '2026-08-28'
status: 'in-progress'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'bcea1b8967c7a5ca74b5705de4c93fd41cc99a68'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-4-incidentdetail-approvalbanner.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** An operator who approves an execution plan has no way to see *what actually happened* — the trace of backend stages (INGEST → CORRELATE → AGENT_CALL → SYNTHESIZE → CONFIDENCE → POLICY_DECISION → DG_CHECK → APPROVAL → EXECUTE → VERIFY). Without a visible execution trace, failures, retries, and fallbacks are invisible and the operator cannot audit or trust an outcome.

**Approach:** Add `ExecutionTrace`, a BlueprintPanel in the right column of the Live Console driven by `incident.trace`. It renders an append-only, newest-at-top log (`role="log" aria-live="polite"`) with one row per `TraceEntry`, sorted reverse-chronologically by `timestamp`. Each row shows a SCREAMING_SNAKE stage badge, the stage-specific `detail`, and a non-colour-only error/retry/fallback marker (accent-900 dot + bolder text + a textual `ERROR`/`RETRY`/`FALLBACK` flag, per UX-DR11 — never colour-only). Entries where `detail.mock_forced === true` are annotated "response mocked for demo stability" and are never byte-identical to a live row. Every row is keyboard-operable (`tabIndex={0}` + `aria-label`). This is a demo-shell integration over the `allIncidents` fixture; the polling/router arrive in later stories.

## Boundaries & Constraints

**Always:**
- `ExecutionTrace` props: `{ trace: TraceEntry[] }`. Renders nothing about incidents other than the trace; it is fed `incident.trace` by the integrator.
- The log container has `role="log"` and `aria-live="polite"` and `aria-relevant="additions"`. Rows are rendered newest-first: sort a copy of `trace` by `timestamp` descending.
- Each row is a `div` with `tabIndex={0}` and an `aria-label` that summarises the stage and the human-readable message (e.g. `"CORRELATE: correlated 3 signals"` or `"EXECUTE, error: <msg>"`).
- Stage vocabulary is SCREAMING_SNAKE; the badge renders the raw `stage` string. A row whose `stage` is not in the known set is still rendered (with a muted style) — never dropped.
- Marker rows (error / retry / fallback) get a visible `accent-900` square dot AND a textual flag (`ERROR` when `entry.error != null`; `FALLBACK` when `detail.fallback_used === true`; `RETRY` when `detail.retried === true`). The distinction is never colour-only.
- The human-readable message per row, in priority order:
  1. If `detail.mock_forced === true` → render the annotation "response mocked for demo stability" (and the row is also flagged so it is never identical to a live row).
  2. Else if `entry.error != null` → use `entry.error.error` (the failure message).
  3. Else a `detail` string field in order of preference: `reason`, `message`, `note` (whichever is a non-empty string).
  4. Else empty (stage badge only).
- `detail` is `Record<string, unknown>` — read fields defensively (boolean via `=== true`, strings via `typeof === 'string'`).
- All visual values come from Story 2.1 tokens; the component CSS uses only `var(--*)` colours, `border-radius: 0`, and px only for the small marker dot / structural sizes. No hex, no named CSS colours in the component CSS.

**Block If:**
- `types/incident.ts` `TraceEntry` does not match `{ stage, timestamp, detail, error }` as read.

**Never:**
- No AskPortwatch, map, kill-switch *control*, or archive route — those are 2.6–2.9.
- Never omit a row; never reorder into chronological order; never drop unknown stages.
- Never use colour alone to signal error/retry/fallback (UX-DR11).
- Never fabricate a `detail` message; only render fields that exist.
- Do not touch `backend/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty trace | `trace: []` | Renders the panel heading + an "No trace entries yet." line; `role="log"` present; 0 rows | n/a |
| Reverse-chrono | trace with 3 entries t1<t2<t3 | rows rendered t3, t2, t1 (newest first) | n/a |
| Error row | `entry.error = {stage, error, retried, fallback_used}` | accent-900 dot + `ERROR` flag + bolder text + `entry.error.error` message; `aria-label` includes ", error" | n/a |
| Retry marker | `detail.retried === true` (no error) | `RETRY` flag + dot | n/a |
| Fallback marker | `detail.fallback_used === true` | `FALLBACK` flag + dot | n/a |
| Mock forced | `detail.mock_forced === true` | annotation "response mocked for demo stability" rendered; flag so not identical to a live row | n/a |
| Unknown stage | `stage: "WIDGET"` | row still rendered, stage badge in muted style | n/a |
| Keyboard | Tab to a row, focus | row is focusable (`tabIndex=0`) with visible focus outline | n/a |
| aria-live | log mounts | `role="log"` + `aria-live="polite"` | n/a |

</intent-contract>

## Code Map

- `frontend/src/types/incident.ts` -- `TraceEntry` (`stage:string`, `timestamp:string`, `detail:Record<string,unknown>`, `error:TraceError|null`); `TraceError` (`stage, error, retried, fallback_used`).
- `frontend/src/components/ExecutionTrace/ExecutionTrace.tsx` -- new component (props `{ trace }`).
- `frontend/src/components/ExecutionTrace/ExecutionTrace.css` -- token-only styles, `border-radius:0`, px only for marker dot / structure.
- `frontend/src/components/ExecutionTrace/ExecutionTrace.test.tsx` -- RTL/jsdom suite covering the I/O matrix.
- `frontend/src/test/fixtures/incidents.ts` -- already carries `trace` arrays on several fixtures; add a richer trace fixture if existing ones are empty.
- `_bmad-output/.../EXPERIENCE.md` (line 54) -- trace is append-only, newest at top, one row per stage; renders live via polling.
- `_bmad-output/.../DESIGN.md` (line 144) -- trace `role="log" aria-live="polite"`, 2-col grid (timestamp | stage + text), 1px dividers, accent-900 dot on error entries.

## Tasks & Acceptance

**Execution:**
- `frontend/src/components/ExecutionTrace/ExecutionTrace.tsx` -- `function ExecutionTrace({ trace }: { trace: TraceEntry[] })`: `section.execution-trace.blueprint-panel` with an `<h3>` heading "Execution Trace"; inner `div[role="log"][aria-live="polite"][aria-relevant="additions"]`; empty state line when `trace.length === 0`; otherwise map sorted entries to rows.
- `frontend/src/components/ExecutionTrace/ExecutionTrace.css` -- `.execution-trace*`, `.execution-trace__row*`, `.execution-trace__dot` (accent-900, `border-radius:0`), `.execution-trace__flag` (accent-900 border), `.execution-trace__msg`, `.execution-trace__mock`; all colours via `var(--*)`, px only for dot/sizes, `border-radius:0`.
- `frontend/src/components/ExecutionTrace/ExecutionTrace.test.tsx` -- assertions: `role="log"` + `aria-live="polite"`; reverse-chrono order (assert timestamp order of rendered rows); error row has `ERROR` flag + bolder + dot; `RETRY`/`FALLBACK` flags; mock annotation text present; each row `tabIndex=0` and has `aria-label`; unknown stage still rendered.
- `frontend/src/App.tsx` -- add a right column (`<aside>` with `flex: 1 1 400px` / `width: var(--col-right)`) rendering `<ExecutionTrace trace={selected?.trace ?? []} />`; keep the demo shell (no live backend, inert selection).

**Acceptance Criteria:**
- Given an incident with a non-empty `trace` is selected, when its detail renders, then the right column shows an execution trace that is `role="log" aria-live="polite"`, lists rows newest-first, labels each row with its SCREAMING_SNAKE stage, and highlights error/retry/fallback rows with an accent-900 dot plus a textual `ERROR`/`RETRY`/`FALLBACK` flag (never colour alone).
- Given a trace entry where `detail.mock_forced === true`, when the trace renders, then that entry shows the annotation "response mocked for demo stability" and is visually distinguishable from a live row.
- Given any trace row, when navigated by Tab, then it is focusable with a visible focus outline and carries an `aria-label` describing the stage and message.
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, build, and all suites (2.1–2.4 unchanged, 2.5 new) pass.

## Spec Change Log

## Review Triage Log

## Design Notes

**Sorting:** copy `trace` then `.sort((a,b) => b.timestamp.localeCompare(a.timestamp))` (ISO-8601 UTC strings compare lexicographically). Newest first.

**Marker precedence:** `error` → ERROR; else `fallback_used` → FALLBACK; else `retried` → RETRY. The dot + flag make the state perceivable without colour.

**mock_forced:** rendered as a separate italic annotation line; the row is always flagged (it is never a "clean" live row) so it can never be byte-identical to a live entry.

**jsdom note:** focus-ring contrast and dot colour are verified by DOM structure + a static `ExecutionTrace.css` scan (`--accent-900` referenced on the dot/flag, `border-radius: 0` present, no hex/named colour), not `getComputedStyle` — same technique as 2.1–2.4.

## Verification

**Commands:**
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test -- --run` -- expected: all suites pass (2.1–2.4 unchanged, 2.5 new); every I/O matrix row has a passing assertion; 0 failures.
