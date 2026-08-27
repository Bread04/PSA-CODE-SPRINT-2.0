---
title: 'Story 2.4: IncidentDetail + ApprovalBanner'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
baseline_revision: 'bcea1b8967c7a5ca74b5705de4c93fd41cc99a68'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-3-incidentfeed.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/mockups/live-console.html'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** When an incident reaches Tier 3, the operator has nowhere to see the recommendation or act on it. There is a feed (2.3) but no center-column detail view and no approval card — so approve / reject / pick-a-different-option (FR11, AD-11) is impossible, and a kill-switch-blocked Tier 1/2 incident has no manual-action surface (UX-DR4, Day-4 slice).

**Approach:** Add `IncidentDetail` (center column, driven by the selected incident) and, pinned at its top when the incident is Tier-3-pending **or** `blocked_by_kill_switch`, an `ApprovalBanner`: a BlueprintPanel showing situation / recommendation / predicted impact / confidence(+reason), any DG-gate-rejected options struck through with their reason, the ranked alternatives, and Approve / Reject / "use this option" controls wired to `POST /incidents/{id}/approval` with the exact AD-11 action payloads. A `postApproval` client and a `useApproval` submit hook carry the write. The banner announces once via `aria-live="assertive"` on first appearance, never auto-dismisses, and has no timeout-driven default.

## Boundaries & Constraints

**Always:**
- `postApproval(incidentId, body, signal?)` POSTs `${API_BASE}/incidents/${incidentId}/approval` with a JSON body that is exactly one of: `{action:"approve"}`, `{action:"reject"}`, `{action:"select_alternative", option_id:<string>}` (AD-11). `select_alternative` with no `option_id` throws before any request. No other keys are ever sent — never a free-form plan edit. Same `ApiError` / timeout discipline as `fetchIncidents`.
- `useApproval(onSuccess?)` returns `{ submit(incidentId, body), submitting, error, reset }`; it serialises submits (ignores a call while one is in flight), sets `error` (never throws to render), and calls `onSuccess` (e.g. `useIncidents().refetch`) after a resolved POST.
- The `ApprovalBanner` renders inside one `BlueprintPanel` and shows: a pulsing status dot; a heading in the plain Tier-1 register ("Approval needed", or "Needs manual action — kill switch engaged" when blocked); **Situation** (`entity_refs` joined, or `incident_id` if none — mirrors the backend `_build_card`); **Recommendation** (`options` entry whose `option_id === recommended_option_id`, its `description`); **Predicted impact** (`delay_min` / `cost` / `yard_impact` / `risk` from that option); **Confidence** (`incident.confidence` as a large number, with `confidenceReason(incident)` inline when non-null).
- Any option the DG gate rejected is shown struck through with its reason, NOT hidden. Source: `trace` entries with `stage === 'DG_CHECK'` and `detail.violation === true` — render `detail.reason` (a string that names the offending `option_id`) as a struck-through line. If there are no such entries, render nothing for this section.
- Ranked alternatives = every `options` entry except the recommended one, each with its `description` and a control that calls `submit(incident_id, {action:"select_alternative", option_id})`.
- Approve → `submit(id, {action:"approve"})`; Reject → `submit(id, {action:"reject"})`. For a `blocked_by_kill_switch` incident (any tier) only Approve is offered ("resolved via the same existing Approve action") — no Reject, no alternatives.
- Every control in the banner is a real `<button>` (or a native control): one Tab stop each, operable by Enter and Space, with a focus ring visible at AA contrast against `--surface`. While `submitting`, action buttons are `disabled`.
- `aria-live="assertive"` is set on the banner for its first appearance only: mount with `aria-live="assertive"`, then flip to `aria-live="off"` after the first paint. The parent gives the banner `key={incident.incident_id}` so switching to a different incident's banner remounts and re-announces. It does NOT re-announce on a same-incident content update (poll refresh).
- The banner has no timer: no auto-dismiss, no countdown, no default action. It stays mounted as long as the incident is Tier-3-pending / blocked.
- `IncidentDetail` with `incident == null` renders a plain "Select an incident from the feed." line — not an error, not blank. A selected non-actionable incident renders a read-only summary (situation, recommendation & impact when `options` exist, else a plain status line) with no action controls.
- All visual values come from Story 2.1 tokens; the pulse is a CSS `@keyframes` (opacity 1 ↔ 0.25). Reuse the `BlueprintPanel` primitive. Shared incident helpers (`formatEntityRef`, `formatIncidentLabel`, `confidenceReason`, `statusPhrase`) move to `src/lib/incident.ts`; `incidentFeed.helpers.ts` imports them from there. New code under `frontend/`. Do not touch `backend/`.

**Block If:**
- The on-disk backend contradicts the AD-11 payload (`backend/orchestrator/run.py` `approve_incident`) or the DG-rejection trace shape (`backend/orchestrator/run.py` DG_CHECK append, `backend/policy/dg_gate.py` `dg_rejection_reason`) such that the derivations above cannot hold.

**Never:**
- No execution-trace viewer, AskPortwatch, map, kill-switch *control*, archive route, or router — stories 2.5–2.9.
- Never send a payload key other than `action` and (for `select_alternative`) `option_id`. No plan text, no edited impact, no free-form field.
- No auto-dismiss, no timeout default, no sound. No `aria-live` that re-fires on every render.
- Do not reclassify a `blocked_by_kill_switch` Tier 1/2 incident to Tier 3 — it stays its tier; the banner is offered because of the flag, not a tier change.
- Do not invent backend fields (no `situation`/`recommendation` field on `Incident` — derive them). Do not build a websocket or a polling loop here (the write hook only POSTs and calls `onSuccess`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tier-3 pending selected | `tier:3, approval_status:"pending"`, recommended option + 2 alts | ApprovalBanner renders: pulsing dot, situation, recommendation, impact, confidence, 2 alternatives, Approve + Reject | n/a |
| First appearance announce | banner mounts | `aria-live="assertive"` on mount, `"off"` after first paint | n/a |
| Same-incident re-render | banner already mounted, incident prop updates (poll) | `aria-live` stays `"off"` — no re-announce | n/a |
| Switch incidents | selected id changes to another Tier-3-pending incident | banner remounts (`key`), announces once again | n/a |
| Approve click | operator clicks Approve | `postApproval(id, {action:"approve"})` called exactly once; `onSuccess` fires on resolve; buttons disabled while in flight | POST rejects → inline plain retry line, banner stays, buttons re-enabled |
| Reject click | operator clicks Reject | `postApproval(id, {action:"reject"})` | as above |
| Select alternative | operator activates an alternative's control | `postApproval(id, {action:"select_alternative", option_id:<that id>})` — no other keys | as above |
| select_alternative missing id | `submit(id,{action:"select_alternative"})` with no `option_id` | throws / rejects before any `fetch`; surfaced as `error` | no request sent |
| DG-rejected option | `trace` has `DG_CHECK` entry `detail.violation:true, detail.reason:"…option 'opt-2'…"` | a struck-through line showing that reason appears in the banner, not hidden | n/a |
| Kill-switch blocked | `blocked_by_kill_switch:true, tier:1` selected | banner shows "Needs manual action — kill switch engaged", Approve only (no Reject, no alternatives); tier still shows 1 | n/a |
| No timeout | banner mounted, fake-advance timers by minutes, no clicks | banner still mounted, no `postApproval` call, no state change | n/a |
| Keyboard operation | Tab to Approve, press Enter; Tab to an alternative, press Space | each activates its handler once; visible focus ring | n/a |
| Nothing selected | `incident == null` | "Select an incident from the feed." line, no banner, no error role | n/a |
| Non-actionable selected | `tier:1, status:"resolved"` selected | read-only summary, no Approve/Reject/alternative controls | n/a |

</intent-contract>

## Code Map

- `backend/orchestrator/run.py` -- `DecisionCard` fields (`situation`, `recommendation`, `predicted_impact`, `confidence`, `alternatives`) and `_build_card` (`situation = ", ".join(entity_refs)`); `approve_incident` = the AD-11 semantics; DG_CHECK trace append at ~L239 (`detail = {"violation": true, "reason": <str>}` + an `error` shape).
- `backend/policy/dg_gate.py` -- `dg_rejection_reason(option)` = `"DG/IMDG segregation violation: option '<option_id>' affects dangerous goods and cannot be auto-executed at any tier."` — the exact string the banner renders struck-through.
- `backend/models/incident.py` -- `approval_status` literal set; confirms no `situation`/`recommendation` field exists.
- `frontend/src/api/client.ts` -- add `postApproval` beside `fetchIncidents`; reuse `API_BASE`, `ApiError`, the timeout pattern.
- `frontend/src/hooks/useIncidents.ts` -- exposes `refetch`; `useApproval`'s `onSuccess` is wired to it by the eventual integration (App demo may pass a stub).
- `frontend/src/components/IncidentFeed/incidentFeed.helpers.ts` -- currently owns `formatEntityRef` / `formatIncidentLabel` / `confidenceReason` / `statusPhrase`; move these to `src/lib/incident.ts` and re-point imports. `sortIncidents` / `rowPresentation` stay put.
- `frontend/src/components/BlueprintPanel/` -- container primitive for the banner; `--blueprint-panel-padding` hook available.
- `frontend/src/test/fixtures/incidents.ts` -- extend with Tier-3-with-alternatives and a DG-rejected-trace fixture.
- `_bmad-output/.../mockups/live-console.html` -- `.approval-banner`, `.dot-pulse`, `.approval-row`, `.confidence`, `.struck`, `.reason`, `.actions`, `.btn*` rules = exact geometry/animation reference.
- `_bmad-output/.../EXPERIENCE.md` -- "Approval banner" behavioural rules, "Tool timeout / degraded confidence" and "DG re-plan" state patterns, "Accessibility Floor" (assertive on first appearance only), Voice Do/Don't.

## Tasks & Acceptance

**Execution:**
- `frontend/src/lib/incident.ts` -- move `formatEntityRef`, `formatIncidentLabel`, `confidenceReason`, `statusPhrase` here verbatim (keep signatures). Update `incidentFeed.helpers.ts` to import/re-export from it so Story 2.3's tests stay green; adjust `incidentFeed.helpers.test.ts` import paths if needed.
- `frontend/src/api/client.ts` -- `export type ApprovalAction = { action: 'approve' } | { action: 'reject' } | { action: 'select_alternative'; option_id: string }`; `postApproval(incidentId: string, body: ApprovalAction, signal?): Promise<unknown>` — validates `select_alternative.option_id` is a non-empty string (throws `ApiError` if not), POSTs JSON, applies the shared timeout, wraps failures in `ApiError`, guards `res.json()`.
- `frontend/src/api/client.test.ts` -- add: approve/reject bodies serialised exactly; `select_alternative` includes only `action` + `option_id`; missing `option_id` → throws, no `fetch`; non-2xx → `ApiError`; timeout → `ApiError`.
- `frontend/src/hooks/useApproval.ts` -- `useApproval(onSuccess?: () => void)`; `{ submit, submitting, error, reset }`. `submit` no-ops while `submitting`; on resolve clears `error`, calls `onSuccess`; on reject sets `error`. Aborts in flight + no post-unmount state set.
- `frontend/src/hooks/useApproval.test.ts` -- success path (calls `postApproval`, flips `submitting`, fires `onSuccess`); failure path (sets `error`, `onSuccess` not called); concurrent `submit` ignored; unmount mid-flight.
- `frontend/src/components/IncidentDetail/incidentDetail.helpers.ts` -- `dgRejectedReasons(incident): string[]` (from `DG_CHECK`/`violation` trace entries); `bannerModel(incident)` → `{ situation, recommendation: string | null, impact: PredictedImpact | null, alternatives: RecoveryOption[] }`.
- `frontend/src/components/IncidentDetail/incidentDetail.helpers.test.ts` -- both helpers across: no options, recommended-not-in-options, multiple DG_CHECK entries, empty `entity_refs`.
- `frontend/src/components/IncidentDetail/ApprovalBanner.tsx` -- props `{ incident, submitting, error, onAction(body: ApprovalAction) }`. First-appearance `aria-live` via `useState<'assertive'|'off'>('assertive')` + `useEffect` flipping to `'off'`. Pulsing dot, heading, rows, struck DG lines, alternatives (each a `<button>`), Approve/Reject (`<button>`), inline `error` line. `blocked_by_kill_switch` branch = Approve-only + blocked heading.
- `frontend/src/components/IncidentDetail/IncidentSummary.tsx` -- read-only situation / recommendation / impact / confidence for a non-actionable selected incident.
- `frontend/src/components/IncidentDetail/IncidentDetail.tsx` -- props `{ incident: Incident | null, submitting, error, onApprovalAction }`. `null` → placeholder line. Else `<h2>` label (`formatIncidentLabel`) + meta line; if `(tier===3 && approval_status==='pending') || blocked_by_kill_switch` → `<ApprovalBanner key={incident.incident_id} …>`, else `<IncidentSummary …>`.
- `frontend/src/components/IncidentDetail/IncidentDetail.css` -- `.approval-banner*`, `.incident-detail*` from mock geometry; `@keyframes` pulse; struck style (`text-decoration: line-through`); all colour/spacing via tokens; `:focus-visible` rings; button styles from DESIGN.md `button-primary`/`button-secondary` (44px min-height). Any `var(--x, fallback)` hook added → also add to `tokens.test.ts` `OVERRIDE_HOOKS`.
- `frontend/src/components/IncidentDetail/index.ts` -- barrel.
- `frontend/src/components/IncidentDetail/{IncidentDetail,ApprovalBanner}.test.tsx` -- RTL suites covering every I/O matrix row (announce-once, no re-announce, remount-on-switch, each action payload exactly, DG struck line, kill-switch Approve-only, no-timeout via fake timers, keyboard activate, placeholder, non-actionable summary, submitting disables, error line).
- `frontend/src/test/fixtures/incidents.ts` -- add `tier3WithAlternatives` (recommended `opt-1` + `opt-2`,`opt-3`), `tier3DgRejected` (trace has a `DG_CHECK` `violation:true` entry naming `opt-2`). Reuse `killSwitchBlocked` for the blocked case.
- `frontend/src/App.tsx` -- render `<IncidentDetail>` in the center column driven by the selected fixture; pass a stub `onApprovalAction` + `submitting={false}` `error={null}` (no live backend). Keep it demo-only.

**Acceptance Criteria:**
- Given a Tier-3 incident is selected, when the approval card first appears, then it uses `aria-live="assertive"` on that first appearance only, shows situation / recommendation / predicted impact / confidence (with its degradation reason when applicable), and has a pulsing status dot.
- Given an option was DG-gate-rejected during re-planning, when the card renders, then that option's reason appears struck through, not hidden.
- Given the card is showing, when time passes with no operator action, then it stays visible with no auto-dismiss and no timeout-driven default.
- Given the operator clicks Approve / Reject / an alternative, when the action is sent, then `POST /incidents/{id}/approval` is called with `{action:"approve"}` / `{action:"reject"}` / `{action:"select_alternative", option_id:<id>}` respectively and nothing else.
- Given a Tier 1/2 incident with `blocked_by_kill_switch:true` is selected, when its detail renders, then it shows a "needs manual action — kill switch engaged" tag and is resolvable via the same Approve action; the tier is not shown as 3.
- Given any control in the card, when navigated via Tab / Enter / Space, then Approve / Reject / alternative are all operable without a mouse, with a visible focus ring.
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, build, and all suites (2.1–2.3 unchanged, 2.4 new) pass.

## Spec Change Log

## Review Triage Log

## Design Notes

**`aria-live` first-appearance:** `const [live, setLive] = useState<'assertive'|'off'>('assertive'); useEffect(() => { const t = setTimeout(() => setLive('off'), 0); return () => clearTimeout(t); }, []);` Render `<BlueprintPanel aria-live={live} …>`. Parent supplies `key={incident.incident_id}`, so a different incident remounts and re-announces; a same-incident poll update does not. A test asserts `aria-live="assertive"` synchronously after render and `"off"` after `await act` / timer flush.

**DG-rejected derivation:** the rejected option is generally NOT in the final `incident.options` (the re-plan replaced it). Its only durable record is the `DG_CHECK` trace entry: `detail = {violation: true, reason: "DG/IMDG segregation violation: option 'opt-2' affects dangerous goods and cannot be auto-executed at any tier."}`. Render that `reason` string struck-through. Optionally parse `option '([^']+)'` for a short "Option opt-2" struck label with the full reason beneath (mock's two-line treatment) — either is acceptable; do not fabricate a description.

**Banner content source:** derive from the live `Incident` (mirrors `_build_card`), NOT the `APPROVAL` trace entry's `detail.card` — the card's `alternatives` is a list of strings and loses `option_id`, which `select_alternative` needs. `situation = entity_refs.join(', ') || incident_id`.

**jsdom note:** pulse animation, focus-ring contrast, button colours are verified by DOM structure + a static `IncidentDetail.css` scan (`@keyframes` name present, `animation:` on the dot, `line-through` on the struck class, `:focus-visible` outline via `var(--accent-700)`), not `getComputedStyle` — same technique as 2.1–2.3.

## Verification

**Commands:**
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test -- --run` -- expected: all suites pass (2.1–2.3 unchanged after the `src/lib/incident.ts` move, 2.4 new); every I/O matrix row has a passing assertion; 0 failures.

## Review Triage Log

### 2026-08-28 — Retrospective reconciliation pass (epic-2 retro item 3)
Story 2.4 was committed as pre-session WIP without the build-auto 4-reviewer pass. This pass reviewed the as-built code and closed the gaps:
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 1, low 1)
- defer: 0
- reject: 3
- addressed_findings:
  - `[medium]` `[patch]` The story shipped with **no tests** — added `incidentDetail.helpers.test.ts` (bannerModel / dgRejectedReasons / formatPredictedImpact, incl. non-mutation + dangling-id), `IncidentDetail.test.tsx` (placeholder routing, Tier-3 banner content, AD-11 payloads for approve / reject / select_alternative, submitting-disables, error line, DG-struck option shown-not-hidden, kill-switch-blocked = Approve-only, BlueprintPanel + 4 corner marks, first-appearance `aria-live` relax, CSS token scan), and `useApproval.test.ts` (POST body, re-entrancy guard, ApiError capture without throwing, `onSuccess`, `reset`, no-state-after-unmount).
  - `[low]` `[patch]` `IncidentSummary` only rendered a status line when the incident had **no** options, so a resolved / approved / rejected incident *with* options showed recommendation + impact but never stated its state — now the plain `statusPhrase` line always renders.
- rejected: `aria-live="assertive"` at mount is a weak announce (a region that mounts already-populated may not be spoken) — kept as spec'd (epic context mandates this exact attribute); folded into the item-7 polish note. `.approval-banner__btn--secondary` is a dead modifier class (base style already is the secondary look) — harmless, left. `key={i}` on the struck-reasons list — static list, low, left.

## Auto Run Result

Status: done

**Implemented change (as-built, verified in this reconciliation pass):** The centre detail column — `IncidentDetail` routes a selected incident to the pinned `ApprovalBanner` (Tier-3-pending OR `blocked_by_kill_switch`, tier never reclassified) or the read-only `IncidentSummary`, or a plain "Select an incident" line when nothing is selected. `ApprovalBanner` (one reused `BlueprintPanel`) shows situation / recommendation / predicted impact / confidence + degradation reason, DG-gate-rejected options struck-through-not-hidden with their reason, ranked alternatives, and Approve / Reject / select-alternative controls wired to the exact AD-11 payloads; `aria-live="assertive"` on first appearance then relaxed; no timer / auto-dismiss. `useApproval` is the render-safe submit hook (serialised, aborts on unmount, refetch on success). Shared incident derivations were moved to `src/lib/incident.ts`.

**Files (as-built):** `frontend/src/components/IncidentDetail/{IncidentDetail,ApprovalBanner,IncidentSummary}.tsx`, `incidentDetail.helpers.ts`, `IncidentDetail.css`, `index.ts`; `frontend/src/hooks/useApproval.ts`; `frontend/src/lib/incident.ts`. Reconciliation added the three test files above and the `IncidentSummary` status-line fix.

**Review findings breakdown:** 2 patches applied (1 medium: missing tests; 1 low: summary status line), 0 deferred, 3 rejected. See Review Triage Log.

**Follow-up review recommended:** false — the medium finding (zero coverage) is fully closed; the rest is covered by epic-2 retro item 7.

**Verification performed:**
- `cd frontend && npm run lint` → clean (0 errors, 0 warnings).
- `cd frontend && npm run build` → `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test` → 19 files / 555 tests pass, 0 failures.
