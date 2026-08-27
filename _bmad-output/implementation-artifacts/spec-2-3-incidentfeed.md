---
title: 'Story 2.3: IncidentFeed'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'a4888334079460edffa53a175fb1775b46ccce25'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-2-blueprint-panel-primitive.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/mockups/live-console.html'
warnings: [oversized]
deferred:
  - summary: >-
      Secondary text is rendered as var(--text) at opacity 0.6 (feed title, stale
      line, empty line, status line, confidence reason) — this may fall below WCAG
      AA contrast against var(--surface).
    evidence: |-
      The mock (live-console.html) uses opacity 0.6 for .panel-title / .feed-sub
      throughout, so this spans the whole design, not just the feed. Only the focus
      ring's AA contrast is asserted. Needs a design-token pass (a proper muted-text
      token vetted for contrast), not a per-component fix.
    location: >-
      frontend/src/components/IncidentFeed/IncidentFeed.css
    severity: low
  - summary: >-
      The incident feed list is not an aria-live region, so incidents appearing,
      resolving, or reordering between polls are silent to screen-reader users.
    evidence: |-
      EXPERIENCE.md's aria-live requirements name the trace log, the Ask answer, and
      the approval banner — not the feed. A frequently-reordering list as a live region
      is also noisy. Deferred pending a UX decision on whether feed changes should be
      announced.
    location: >-
      frontend/src/components/IncidentFeed/IncidentFeed.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The operator has no surface to watch incidents across the port. Epic 2 has a token system (2.1) and a panel primitive (2.2) but no data layer and no feed — nothing polls the Incident API, types its payload, or renders a scannable list that surfaces the one Tier-3 incident that needs a human without burying it (UX-DR3, Day-4 slice).

**Approach:** Add the frontend data layer this first surface needs — TypeScript types mirroring the backend `Incident`/`RecoveryOption`/`TraceEntry` shapes, a `fetchIncidents` API client, and a `useIncidents` polling hook (2–3s interval, keeps last-good data, exposes staleness) — then build `IncidentFeed`: a reverse-chronological list of rows inside one `BlueprintPanel`, each row a keyboard-operable `<button>` with a status dot + text label, Tier-3-pending rows pinned to the top, an in-progress progress bar, quiet resolution tags, an inline plain-language confidence-degradation reason, and a "last updated Xs ago" indicator when polling goes stale.

## Boundaries & Constraints

**Always:**
- TS types use the backend JSON field names VERBATIM (snake_case): `incident_id`, `status` (`"open"|"resolved"`), `entity_refs`, `tier` (`1|2|3|null`), `confidence` (int 0–100), `recommended_option_id`, `options`, `approval_status` (`"n/a"|"pending"|"approved"|"rejected"`), `blocked_by_kill_switch`, `trace`, `created_at`, `last_signal_at`. `TraceEntry`: `stage`, `timestamp`, `detail`, `error` (`{stage,error,retried,fallback_used}|null`). `RecoveryOption`: `option_id`, `description`, `predicted_impact` (`{delay_min,cost,yard_impact,risk}`), `reversible`, `dg_involved`.
- API base URL comes from `import.meta.env.VITE_API_BASE_URL` (default `''` → same-origin). `fetchIncidents()` GETs `${base}/incidents`, returns `Incident[]`, and throws a typed error on network failure or non-2xx.
- `useIncidents` polls every `POLL_INTERVAL_MS` (2500). On a failed poll it keeps the last successful `incidents` (never clears to empty) and exposes `error`; it sets `isStale` once `Date.now() - lastUpdatedAt` exceeds `STALE_AFTER_MS` (8000). It clears its timer on unmount.
- Sort order: rows where `tier === 3 && approval_status === 'pending'` come first (in that group, most-recent `last_signal_at` first); all other rows follow by `last_signal_at` descending, `created_at` as tiebreak. Sorting is a pure function of the incident list — selecting or interacting with one row never reorders or mutates another (FR16).
- Each row renders a 7×7px status dot AND a text label together — Tier 3 pending → `accent-900` dot + "Needs approval"; Tier 1/2 open/in-progress → light `accent-300` dot + status text; resolved → `accent-300` dot + "Auto-resolved" (Tier 1) or "Auto-resolved" + a small non-sound notification badge (Tier 2); `blocked_by_kill_switch` → dot + "Needs manual action — kill switch engaged" tag. Severity is NEVER dot color alone (UX-DR11).
- An open, non-pending incident shows a 2px progress bar beneath its label: `neutral-300` track, `accent-600` fill.
- When `confidence < 100`, the row shows a one-line plain-language reason from `confidenceReason(incident)` (derived from `trace`: `error.fallback_used` → "using last known state"; `detail.mock_forced` → "response mocked for demo stability"; an explicit `CONFIDENCE` stage `detail.reason` if present; otherwise "Confidence reduced from 100") — not just the lower number (UX-DR10).
- Rows are `<button type="button">`; the whole row is one Tab stop, activates on Enter and Space, and shows a focus ring visible at AA contrast against `--surface` (UX-DR11). The selected row is marked (`aria-pressed` / `aria-current`) and visually distinct.
- When `isStale`, the feed shows a small non-blocking "Last updated Xs ago" line at its top — never an error screen that hides the last-known rows (UX-DR10).
- Row label text is plain and factual per EXPERIENCE.md's Do/Don't table — derived from `entity_refs` (humanize `type:ID` → "Type ID", join with " · ") plus, when present, the recommended option's `description` or a plain status phrase. No coined severity words, no emoji (UX-DR12).
- All visual values come from Story 2.1 tokens; the feed container is one `BlueprintPanel`. New code under `frontend/`. Do not touch `backend/`.

**Block If:**
- The backend `Incident` shape on disk (`backend/models/incident.py`) contradicts the field list above in a way that changes what the feed must render.

**Never:**
- No incident detail, approval banner, execution-trace viewer, AskPortwatch, map, kill-switch control, archive route, or app router — those are stories 2.4–2.9. `useIncidents` polls the list endpoint only; no `GET /incidents/{id}`, no write calls.
- No websocket/SSE. No state-management library. No date library (compute "Xs ago" with `Date.now()`).
- Do not invent backend fields (no `title`, no `summary`, no `resolution_outcome`) — derive display strings from the real shape.
- Do not make each row its own corner-marked `BlueprintPanel` — the mock composition is plain bordered rows inside one panel; the spine defers composition to the mock.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tier-3 pending vs recency | list with a Tier-3 `pending` incident older than a Tier-1 resolved one | the Tier-3 row renders first | n/a |
| Multiple Tier-3 pending | two `tier:3 pending` incidents | both above all non-pending rows, newer `last_signal_at` first | n/a |
| Tier 1 resolved | `tier:1 status:resolved` | `accent-300` dot + "Auto-resolved" tag, no badge, no progress bar | n/a |
| Tier 2 resolved | `tier:2 status:resolved` | "Auto-resolved" tag + a small notification badge (not sound) | n/a |
| Open in progress | `status:open approval_status:"n/a"` | 2px progress bar (`neutral-300`/`accent-600`) under the label | n/a |
| Degraded confidence | `confidence:67`, trace has `error.fallback_used:true` | row shows "…using last known state" inline, plus the number | if no trace hint, shows "Confidence reduced from 100" |
| Mock-forced confidence | trace entry `detail.mock_forced:true` | row reason reads "response mocked for demo stability" | n/a |
| Kill-switch blocked | `blocked_by_kill_switch:true`, `tier:1` | "Needs manual action — kill switch engaged" tag; `tier` shown as 1, not 3 | n/a |
| Concurrent selection | 2 open incidents, select #1 then #2 | each selectable independently; #1's row is unchanged when #2 is selected; `onSelect` fires with the clicked `incident_id` | n/a |
| Keyboard operation | focus a row, press Enter, then Space on another | `onSelect` fires once per activation; focus ring visible | n/a |
| Poll success | `fetchIncidents` resolves with N incidents | `incidents` = N, `lastUpdatedAt` updated, `isStale` false, `error` null | n/a |
| Poll failure after success | first poll ok, second rejects | `incidents` unchanged (last good), `error` set; after `STALE_AFTER_MS`, `isStale` true and the feed shows "Last updated Xs ago" | never throws to the render tree; no empty list flash |
| Empty list | `fetchIncidents` resolves `[]` | feed renders its panel with a plain "No incidents" line, not an error | n/a |
| Unmount mid-poll | component unmounts between intervals | timer cleared; no state update after unmount (no act warning) | n/a |

</intent-contract>

## Code Map

- `backend/models/incident.py` -- authoritative `Incident` / `TraceEntry` field names & literals (snake_case). `created_at` + `last_signal_at` are the timestamp fields (no `updated`/`timestamp`). No `title`/`summary`/`resolution_outcome` field exists.
- `backend/models/recovery.py` -- `RecoveryOption` / `PredictedImpact` field names (`option_id`, `predicted_impact.delay_min|cost|yard_impact|risk`, `reversible`, `dg_involved`).
- `_bmad-output/.../ARCHITECTURE-SPINE.md` -- AD-6 (poll 2–3s, read-only), API seed (`GET /incidents -> list[Incident summary]`), `VITE_API_BASE_URL` convention is this story's to set.
- `_bmad-output/.../EXPERIENCE.md` -- "State Patterns" table (Tier 1 silent / Tier 2 notify / Tier 3 pin / stale poll / concurrent) and the Voice Do/Don't table; "Accessibility Floor" (Tab/Enter/Space, AA focus rings, no color-alone).
- `_bmad-output/.../mockups/live-console.html` -- `.feed-row`, `.status-dot.tier3|tier1`, `.progress-track`/`.progress-fill`, `.tag`, `.feed-sub` rules give exact geometry (7×7 dot, 2px bar, 10.2/13.6 padding).
- `frontend/src/components/BlueprintPanel/` -- container primitive; wrap the feed list in one `<BlueprintPanel>`. Its `--blueprint-panel-padding` hook is available.
- `frontend/src/theme/tokens.css` + `tokens.ts` -- all color/space/type tokens. `tokens.test.ts` guardrail auto-scans new `src/**/*.{css,ts,tsx}` — new CSS must route through tokens (no raw hex, no non-zero radius except the 3px tag).
- `frontend/vitest.setup.ts` -- RTL + jest-dom + `afterEach(cleanup)` already wired. Use `vi.useFakeTimers()` for the polling-hook tests.
- `frontend/src/App.tsx` -- may mount `<IncidentFeed>` with fixture data in the demo shell; no real layout/router.

## Tasks & Acceptance

**Execution:**
- `frontend/src/types/incident.ts` -- `Tier`, `IncidentStatus`, `ApprovalStatus`, `PredictedImpact`, `RecoveryOption`, `TraceEntry`, `Incident` interfaces with the verbatim snake_case field names. No behavior.
- `frontend/src/api/client.ts` -- `API_BASE` from `import.meta.env.VITE_API_BASE_URL ?? ''`; `class ApiError extends Error` (carries `status?`); `fetchIncidents(signal?): Promise<Incident[]>` → `GET ${API_BASE}/incidents`, throws `ApiError` on `!res.ok` or network reject.
- `frontend/src/hooks/useIncidents.ts` -- `POLL_INTERVAL_MS = 2500`, `STALE_AFTER_MS = 8000`. Returns `{ incidents: Incident[]; lastUpdatedAt: number | null; isStale: boolean; error: ApiError | null }`. Polls on mount + interval; aborts in-flight on unmount; keeps last-good `incidents` on failure; recomputes `isStale` on a lightweight tick (e.g. a 1s interval or `setTimeout`) so the "Xs ago" text advances.
- `frontend/src/components/IncidentFeed/incidentFeed.helpers.ts` -- pure helpers: `sortIncidents(list)`, `formatEntityRef(ref)` / `formatIncidentLabel(incident)`, `confidenceReason(incident): string | null`, `secondsAgo(ts, now)`.
- `frontend/src/components/IncidentFeed/IncidentFeed.tsx` -- props `{ incidents; selectedId: string | null; onSelect(id): void; lastUpdatedAt: number | null; isStale: boolean }`. Renders one `<BlueprintPanel>` with a "Incidents" micro-label title, an optional stale line, and the sorted rows (each an `IncidentRow`). Empty list → plain "No incidents" line.
- `frontend/src/components/IncidentFeed/IncidentRow.tsx` -- one `<button type="button">` row: status dot (`--dot` class by state), label (`formatIncidentLabel`), status text/tag, Tier-2 notification badge, kill-switch tag, progress bar (open & not pending), `confidenceReason` line when `confidence < 100`. `aria-pressed={selected}`. Keyboard: native button handles Enter/Space.
- `frontend/src/components/IncidentFeed/IncidentFeed.css` -- `.incident-feed__*` and `.incident-row__*` styles from the mock geometry, all via tokens; `:focus-visible` ring (`outline: 2px solid var(--accent-700); outline-offset: 2px` or equivalent AA-contrast treatment) on the row; selected-row treatment (e.g. `border-color: var(--accent-400)` per the mock's `.feed-row.selected`).
- `frontend/src/components/IncidentFeed/index.ts` -- barrel export.
- `frontend/src/test/fixtures/incidents.ts` -- typed fixtures: tier1-resolved, tier2-resolved, tier3-pending (×2, different `last_signal_at`), open-in-progress, degraded-confidence (fallback), mock-forced, kill-switch-blocked.
- `frontend/src/components/IncidentFeed/IncidentFeed.test.tsx` -- RTL suite covering every I/O matrix row that concerns rendering/interaction (sort, dot+label pairing, tags, badge, progress bar, confidence reason, kill-switch tag, independent selection, keyboard activate, empty list, stale line).
- `frontend/src/hooks/useIncidents.test.ts` -- fake-timer tests: poll success updates state; poll failure keeps last-good + sets `error`; `isStale` after threshold; timer cleared on unmount (no post-unmount update).
- `frontend/src/api/client.test.ts` -- `fetch` stubbed: happy path parses array; non-2xx → `ApiError` with `status`; network reject → `ApiError`.
- `frontend/src/App.tsx` -- render `<IncidentFeed>` with fixtures + local `useState` selection (demo only).

**Acceptance Criteria:**
- Given a Tier-3 incident awaiting approval and a more recent Tier-1 incident, when the feed renders, then the Tier-3 row is above the Tier-1 row.
- Given any row, when it conveys tier/severity, then a text label always accompanies the status dot (never color alone), and the row is reachable and activatable by Tab + Enter + Space with a visible AA-contrast focus ring.
- Given an incident with `confidence < 100`, when its row renders, then a plain-language reason string is shown alongside the number.
- Given the incident poll fails after a prior success, when the feed re-renders, then the last-known rows stay visible and a "Last updated Xs ago" line appears — no blocking error screen, no empty flash.
- Given two open incidents, when the operator selects one then the other, then each selection is independent and `onSelect` receives the clicked `incident_id`; neither row's rendered state is affected by the other's selection.
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, build, Story 2.1/2.2 suites, and the new suites all pass.

## Spec Change Log

## Review Triage Log

### 2026-08-27 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 20: (high 0, medium 4, low 16)
- defer: 2: (high 0, medium 0, low 2)
- reject: 7: (high 0, medium 0, low 7)
- addressed_findings:
  - `[medium]` `[patch]` `fetchIncidents` only guarded `fetch()` — a non-JSON 200 body threw a raw `SyntaxError` and a non-array body flowed into `sortIncidents`/`map`. Now `res.json()` is wrapped and a non-array payload is rejected, both as `ApiError`; `useIncidents` defensively coerces a non-array result to `[]`.
  - `[medium]` `[patch]` Overlapping / out-of-order polls: `setInterval` had no in-flight guard and two polls shared one `AbortController`, so a slow earlier response could clobber a newer one. Added a monotonic request-sequence token — only the latest response commits state.
  - `[medium]` `[patch]` `IncidentFeed` could not distinguish "backend unreachable on cold start" from "empty port". Added an `error?` prop; when `error && incidents.length === 0 && lastUpdatedAt === null` the feed shows a plain non-blocking "Can't reach the incident service — retrying." line instead of "No incidents".
  - `[medium]` `[patch]` Added `incidentFeed.helpers.test.ts` (23 assertions) unit-testing every pure helper directly — `sortIncidents` incl. the `created_at` tiebreak, full `formatIncidentLabel` (multi-ref join + recommended-description tail + status-phrase fallback), all five `confidenceReason` branches incl. the `CONFIDENCE`-stage `detail.reason` branch and the `mock_forced`-over-`fallback_used` precedence, `secondsAgo`, `formatAge`. Added `client.test.ts` non-JSON / non-array cases, a `useIncidents` slow-poll-no-clobber case and a `refetch()` case, and `tier: null` / `open+approved` fixtures.
  - `[low]` `[patch]` Progress bar had `role="progressbar"` with no `aria-valuenow/min/max` (a motif, not a real value). Made it `aria-hidden` decorative; the visible "In progress" text carries the state.
  - `[low]` `[patch]` The confidence-reason line was gated on `confidence < 100` at the row level, so a `mock_forced` / `fallback_used` trace at full confidence showed nothing. It now renders whenever `confidenceReason` is non-null.
  - `[low]` `[patch]` The whole-row `<button>` fused label + status + badge + reason into one accessible name. Added an explicit `aria-label` (`<label> — <status>`) and `aria-describedby` → the reason span's `id` when a reason renders.
  - `[low]` `[patch]` Unified the two status vocabularies (`statusPhrase`'s lowercase "analyzing/awaiting approval/auto-resolved" vs `rowPresentation.statusText`'s "In progress/Needs approval/Auto-resolved") onto one shared phrase set.
  - `[low]` `[patch]` Removed the redundant identical `.incident-row__dot--open/--resolved/--blocked` CSS rules; gave the kill-switch `--blocked` dot `var(--accent-900)` (needs attention), still paired with the tag text.
  - `[low]` `[patch]` Added the missing `.incident-row__confidence-reason` CSS rule; added a `rowPresentation` branch for `open` + `approved`/`rejected` ("Approved — executing" / "Rejected"); softened the stale-literal `IncidentFeed.css` header comment.
  - `[low]` `[patch]` The "Incidents" title is now an `<h2 id>` with `aria-labelledby` on the panel (was a bare `<div>` + duplicate `aria-label`).
  - `[low]` `[patch]` URL join strips a trailing slash on `API_BASE`; abort detection is by `err.name === 'AbortError'` regardless of instance type; `secondsAgo` JSDoc corrected to epoch-millis; a 7.5s request timeout was added (`AbortSignal.any` + `AbortSignal.timeout`, `TimeoutError` → `ApiError`).
  - `[low]` `[patch]` `useIncidents`'s permanent 1 Hz staleness tick was replaced with a single re-armed `setTimeout` to the threshold (no 1 Hz re-render of every consumer while healthy); the "Xs ago" text now rolls up to `Xm` / `Xh` for long outages; `refetch()` is exposed for Story 2.4's post-mutation refresh.

## Design Notes

No `title` field exists on `Incident`. `formatIncidentLabel` derives a label from `entity_refs`: split each on `:`, title-case the type, upcase/space the id (`vessel:MSC-ANNA` → "Vessel MSC ANNA"), join refs with " · "; append `" — " + recommended option description` when `recommended_option_id` resolves in `options`, else a plain status phrase ("analyzing", "auto-resolved", "awaiting approval"). This is grounded in real fields and stays factual (UX-DR12); it will not read exactly like EXPERIENCE.md's hand-written example, which is acceptable — the example illustrates tone, not a required data source.

"Row inside a blueprint panel" (DESIGN.md) + "spine wins on conflict with any mock" (EXPERIENCE.md), and the mock's rows are plain bordered boxes with no corner marks: the feed **list** is one `BlueprintPanel`; **rows** are plain `<button>`s styled to `.feed-row`. Story 2.9 "reuses the IncidentFeed row and blueprint-panel styling" is satisfied by reusing `IncidentRow` + the panel container.

`confidenceReason` precedence: `mock_forced` (any trace entry `detail.mock_forced === true`) → "response mocked for demo stability"; else any `error.fallback_used === true` → "using last known state"; else a `CONFIDENCE`-stage `detail.reason` string if present; else `confidence < 100` → "Confidence reduced from 100"; else `null`.

jsdom note: token-driven visual values (dot color, bar colors, focus ring) are verified by DOM structure + class assertions + a static scan of `IncidentFeed.css`, not `getComputedStyle` — same technique as 2.1/2.2. Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync` for the hook; stub `fetch` via `vi.stubGlobal`.

## Verification

**Commands:**
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test -- --run` -- expected: all suites pass (2.1 + 2.2 unchanged, 2.3 new); every I/O matrix row has a passing assertion; 0 failures.

## Auto Run Result

Status: done

**Implemented change:** Added the frontend data layer and the incident feed. `src/types/incident.ts` mirrors the backend `Incident` / `RecoveryOption` / `TraceEntry` shapes verbatim (snake_case). `src/api/client.ts` (`fetchIncidents`, `ApiError`) GETs `${VITE_API_BASE_URL}/incidents` with a 7.5s timeout and surfaces every failure as a typed error. `src/hooks/useIncidents.ts` polls every 2.5s, keeps last-good data on failure, exposes `{ incidents, lastUpdatedAt, isStale, error, refetch }`, uses a request-sequence token against out-of-order responses, and re-arms a single staleness timeout. `IncidentFeed` renders a reverse-chronological list inside one `BlueprintPanel` with Tier-3-pending rows pinned to the top; `IncidentRow` is a keyboard-operable `<button>` with a status dot always paired with text, quiet resolution tags, a Tier-2 notification badge, an in-progress motif bar, a plain-language confidence-degradation reason, and a distinct kill-switch state. Cold-start-unreachable, stale ("Last updated Xs/Xm/Xh ago"), and empty states are all non-blocking. Backend HTTP API does not exist yet — the layer is built to the architecture-spine contract and tested with fixtures.

**Files changed:** `src/types/incident.ts`, `src/api/client.ts` (+ `.test.ts`), `src/hooks/useIncidents.ts` (+ `.test.ts`), `src/components/IncidentFeed/{IncidentFeed,IncidentRow}.tsx`, `incidentFeed.helpers.ts` (+ `.test.ts`), `IncidentFeed.css`, `IncidentFeed.test.tsx`, `index.ts`, `src/test/fixtures/incidents.ts`, `src/App.tsx` (demo shell composes the feed with fixtures).

**Review findings breakdown:** 20 patches applied (0 high, 4 medium, 16 low) — see Review Triage Log. 2 deferred (secondary-text opacity-0.6 AA contrast, a design-token-wide concern; feed list not an aria-live region — pending UX decision). 7 rejected as noise (a claimed `number|null` type error that TS 4.4 aliased-condition narrowing handles and the build disproves; `parseTs` returning 0 as an acceptable deterministic fallback for a Pydantic-validated backend; a Tier-1/2 + `pending` state that cannot occur; `--col-left` "undefined" — it is a Story 2.1 token; CSS-scan brittleness — an accepted technique; the "refetch contract will change" framing — addressed; kill-switch "least prominent" beyond the dot change).

**Follow-up review recommended:** true. This pass's patch findings — high 0, medium 4, low 16; score `3×4 + 1×16 = 28` (≥ 5).

**Verification performed:**
- `npm run build` (`tsc -b` strict + `vite build`) — PASS.
- `npm test -- --run` — PASS (6 files, 220 assertions, 0 failures): `tokens.test.ts` 127, `BlueprintPanel.test.tsx` 23, `client.test.ts` 8, `useIncidents.test.ts` 7, `IncidentFeed.test.tsx` 32, `incidentFeed.helpers.test.ts` 23. Stories 2.1 / 2.2 suites still green.
- Matrix Test Audit — every I/O & Edge-Case Matrix row is covered by a test that ran and passed; render/interaction rows in `IncidentFeed.test.tsx`, hook/poll rows in `useIncidents.test.ts`, client rows in `client.test.ts`, helper rows in `incidentFeed.helpers.test.ts`.

**Residual risks:**
- The data layer is unverified against a live backend (none exists yet) — it is built to the architecture-spine contract; the `Block If` backend field cross-check passed against `backend/models/incident.py`.
- `useIncidents` is fully unit-tested but not yet wired into the running app (`App.tsx` uses fixtures with `isStale={false}` / `error={null}`); real hook↔feed integration and the router are later-story work.
- Token-driven visual values (dot/bar colors, focus ring) are verified by DOM structure + a static `IncidentFeed.css` scan, not a rendered cascade — jsdom limitation, per the spec's jsdom note.
- The progress bar is a fixed-width motif (matching the mock), not a bound value.
