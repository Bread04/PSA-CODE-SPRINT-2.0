---
title: 'Story 2.6: AskPortwatch Natural-Language Query'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: 'b00e9c8b4485dda139c137ac9eaa0ce29153e906'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-5-executiontrace-viewer.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Any user (e.g. a terminal planner) needs to check a specific incident's status in plain language — "What's the status of MSC Anna?" — without first selecting a row or navigating the feed. The console today has no query surface at all (UX-DR6, FR12, UJ-2).

**Approach:** Add a read-only query path to the API client (`GET /incidents/query?q=&incident_id=` → `{answer: string}`) plus a render-safe submit hook, and an `AskPortwatch` BlueprintPanel in the Live Console right column below the trace: a free-text input, a primary submit button, and ghost-style suggestion chips. Submitting (Enter, button, or chip) calls the endpoint; the returned `answer` string renders verbatim in an `accent-100` bubble inside an `aria-live="polite"` region. The query never requires an incident to be selected; if one is selected, its `incident_id` is passed as an optional hint only. Honesty about "no match" is the backend's responsibility — the frontend renders whatever `answer` it returns and never synthesises an incident status itself. This is a demo-shell integration over the existing `App.tsx` shell; live polling/router wiring is unchanged.

## Boundaries & Constraints

**Always:**
- `fetchQuery(q: string, incidentId?: string, signal?: AbortSignal): Promise<{ answer: string }>` in `frontend/src/api/client.ts`. URL: `${API_BASE}/incidents/query?q=<enc>`; append `&incident_id=<enc>` ONLY when `incidentId` is a non-empty string after trim. Same failure discipline as `fetchIncidents`: network reject, non-2xx, non-object body or missing/`non-string` `answer`, or the shared `REQUEST_TIMEOUT_MS` timeout all surface as `ApiError`; a caller abort re-throws as-is.
- `fetchQuery` throws `ApiError` synchronously (before any `fetch`) when `q` is empty or whitespace-only.
- A submit hook `useAskPortwatch()` in `frontend/src/hooks/` modelled on `useApproval`: `{ submit(q, incidentId?), answer: string | null, submitting: boolean, error: ApiError | null, reset() }`. Re-entrant `submit` while one is in flight is ignored (serialised). A submit never throws into render. A successful submit sets `answer` and clears `error`; a failed one sets `error` and leaves the previous `answer` untouched. In-flight request aborted on unmount; no state set after unmount.
- `AskPortwatch` component (`frontend/src/components/AskPortwatch/`, with `AskPortwatch.tsx`, `AskPortwatch.css`, `AskPortwatch.test.tsx`, `index.ts`). Props: `{ onSubmit: (q: string, incidentId?: string) => void; answer: string | null; submitting: boolean; error: ApiError | null; selectedIncidentId?: string | null; suggestions?: string[] }`.
- Rendered inside the shared `BlueprintPanel` primitive (Story 2.2) — no one-off container. Heading "Ask Portwatch".
- A `<form>` with a single-line text `<input>` (accessible label "Ask about any incident") + a `button-primary`-styled submit button labelled "Ask". Submitting via the form (Enter in the input) and clicking the button behave identically. Submit is a no-op when the trimmed input is empty or when `submitting` is true.
- Suggestion chips: render one `type="button"` chip per `suggestions` entry, styled ghost/text-only (`button-ghost` idiom). Default `suggestions` when the prop is omitted: `["Where's MSC Anna?", "Any incidents awaiting approval?", "What's blocked by the kill switch?"]`. Clicking a chip sets the input value to that text AND immediately submits it — same path as free text.
- On submit the component calls `onSubmit(trimmedQ, selectedIncidentId ?? undefined)` — it passes the hint through untouched; it never blocks or requires a selection.
- Answer region: a container with `aria-live="polite"` `aria-atomic="true"` that renders, in priority order: the `error` message as a plain line ("Couldn't reach Portwatch — try again.") when `error != null`; else the `answer` string in an `accent-100`-background bubble when `answer != null`; else nothing (no bubble, no placeholder text before the first ask). While `submitting`, a plain "Asking…" line shows.
- Accessibility floor (UX-DR11): input, button, and every chip operable via Tab/Enter/Space; visible `:focus-visible` outline `2px solid var(--accent-700)` with offset; no meaning conveyed by colour alone.
- Voice & tone (UX-DR12): all microcopy plain and factual — no exclamation, no emoji, identical register regardless of content.
- `AskPortwatch.css` uses `var(--*)` for every colour, `border-radius: 0` (or `var(--radius-*)`), px only for structural sizes; no raw hex, no named CSS colours. Verified by a static CSS scan in the test (same technique as 2.1–2.5).
- `App.tsx`: mount `<AskPortwatch>` in the right `<aside>` below `<ExecutionTrace>`, wired to a `useAskPortwatch()` instance, passing `selectedIncidentId={selectedId}`. Keep the existing demo shell (fixtures, inert selection, no live backend).

**Block If:**
- The architecture query-endpoint contract is not `GET /incidents/query?q=&incident_id=` → `{answer: str}` (ARCHITECTURE-SPINE.md line 225–226).

**Never:**
- Never gate the query behind an incident selection; never send `incident_id` when nothing is selected; never send an empty `incident_id`.
- Never synthesise, guess, or template an incident status on the client; only render the backend `answer` string.
- Never add a new backend endpoint, and do not touch `backend/`.
- No MapPanel, KillSwitchControl, or archive route — those are 2.7–2.9.
- No polling of the query endpoint; it fires once per explicit submit only.
- No websocket/SSE, no state library.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Query, no selection | `fetchQuery("where is MSC Anna")` | GET `${API_BASE}/incidents/query?q=where%20is%20MSC%20Anna`, no `incident_id` param; resolves `{answer}` | n/a |
| Query with hint | `fetchQuery("status?", "inc-42")` | URL also has `&incident_id=inc-42` | n/a |
| Blank hint ignored | `fetchQuery("q", "   ")` | no `incident_id` param in URL | n/a |
| Empty question | `fetchQuery("   ")` | throws `ApiError` synchronously, no `fetch` call | ApiError, message mentions the empty question |
| Non-2xx | endpoint returns 500 | rejects `ApiError`, `.status === 500` | ApiError |
| Bad body | 200 body `{}` (no `answer`) or non-object | rejects `ApiError` mentioning `answer` | ApiError |
| Caller abort | signal aborted mid-flight | rejects with the original `AbortError` (not wrapped) | pass-through |
| Chip click | click "Where's MSC Anna?" chip | input value becomes that text; `onSubmit("Where's MSC Anna?", …)` fired once | n/a |
| Enter to submit | focus input, type text, press Enter | `onSubmit` fired once with trimmed text | n/a |
| Empty submit | input empty, click "Ask" | `onSubmit` NOT called | n/a |
| Re-entrant submit | `submitting` true, submit again | ignored; `onSubmit`/`fetchQuery` not called again | n/a |
| Answer render | `answer = "MSC Anna: berth B3, ETA +90m, awaiting approval."` | that exact string shown in an `accent-100` bubble inside `aria-live="polite"` | n/a |
| No-match answer | `answer = "No incident matches that vessel."` | rendered verbatim, same styling — not treated as an error | n/a |
| Error state | `error != null` | plain "Couldn't reach Portwatch — try again." line; previous `answer` (if any) not shown as if current | n/a |
| Submitting | `submitting = true` | "Asking…" line visible; submit button/chip re-submit is a no-op | n/a |

</intent-contract>

## Code Map

- `frontend/src/api/client.ts` -- add `fetchQuery`; reuse `API_BASE`, `REQUEST_TIMEOUT_MS`, `ApiError`, `isAbortError`, `isTimeoutError`, `AbortSignal.any/timeout` pattern already established by `fetchIncidents`/`postApproval`.
- `frontend/src/api/client.test.ts` -- `vi.stubGlobal('fetch', …)` harness; add a `describe('fetchQuery')` block covering the matrix's client rows.
- `frontend/src/hooks/useApproval.ts` -- the exact state-machine template to mirror for `useAskPortwatch` (refs for re-entrancy + mountedRef + AbortController, `void (async () => …)()`).
- `frontend/src/hooks/useAskPortwatch.ts` -- new hook (+ `useAskPortwatch.test.ts` optional; matrix hook rows may be covered via the component test).
- `frontend/src/components/ExecutionTrace/ExecutionTrace.tsx` + `.css` + `.test.tsx` -- nearest structural sibling: BlueprintPanel wrapper, `aria-live` region, className-only TSX, token-only CSS, static CSS scan test.
- `frontend/src/components/BlueprintPanel/index.ts` -- `<BlueprintPanel as="section" aria-label=… className=…>`; renders 4 `.blueprint-panel__corner` marks.
- `frontend/src/components/AskPortwatch/` -- new: `AskPortwatch.tsx`, `AskPortwatch.css`, `AskPortwatch.test.tsx`, `index.ts`.
- `frontend/src/App.tsx` -- right `<aside>` currently renders `<ExecutionTrace trace=… />`; add `<AskPortwatch>` under it + a `useAskPortwatch()` call.
- `_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md` (225-226) -- `GET /incidents/query?q=&incident_id=` → `{answer: str}` (FR12, AD-2).
- `.../ux-designs/.../DESIGN.md` (146) -- Ask Portwatch panel: input + primary button + `button-ghost` chips; answer in `accent-100` bubble.
- `.../ux-designs/.../EXPERIENCE.md` (55, 80, 91, 107-113) -- always usable standalone; chip or Enter to submit; answer region `aria-live="polite"`; Flow 2 honesty-on-no-match.

## Tasks & Acceptance

**Execution:**
- `frontend/src/api/client.ts` -- add `export async function fetchQuery(q, incidentId?, signal?)`: trim-guard `q` → sync `ApiError`; build URL with `URLSearchParams`; conditional `incident_id`; `fetch` with combined abort/timeout signal; map timeout→`ApiError`, abort→rethrow, other→`ApiError`; non-`ok`→`ApiError(status)`; parse JSON defensively; require `typeof data.answer === 'string'` else `ApiError`; return `{ answer: data.answer }`.
- `frontend/src/hooks/useAskPortwatch.ts` -- `useAskPortwatch()` returning `{ submit, answer, submitting, error, reset }` per the `useApproval` template; `submit(q, incidentId?)` ignores re-entrant calls, aborts on unmount, sets `answer`/`error` mutually.
- `frontend/src/components/AskPortwatch/AskPortwatch.tsx` -- `function AskPortwatch(props)`: `<BlueprintPanel as="section" aria-label="Ask Portwatch">` → `<h3>` + `<form>` (input + submit button) + chip row + answer region. Local `useState` for the input string; `handleSubmit` trims, no-ops on empty/`submitting`, else `props.onSubmit(q, props.selectedIncidentId ?? undefined)`. Chip click sets input then calls the same `handleSubmit` path with the chip text.
- `frontend/src/components/AskPortwatch/AskPortwatch.css` -- `.ask-portwatch*` classes; input/button/chip/bubble; `:focus-visible` outline `2px solid var(--accent-700)` + offset; `.ask-portwatch__answer` background `var(--accent-100)`; colours via `var(--*)`; `border-radius: 0`; px only for structure.
- `frontend/src/components/AskPortwatch/index.ts` -- `export { AskPortwatch } from './AskPortwatch';` + `export type` for props.
- `frontend/src/components/AskPortwatch/AskPortwatch.test.tsx` -- RTL/jsdom: chip click submits once with the chip text; Enter submits trimmed text; empty submit no-ops; `submitting` blocks re-submit and shows "Asking…"; `answer` renders verbatim in `.ask-portwatch__answer` inside an `aria-live="polite"` region; no-match answer string rendered same as any answer; `error` shows the plain failure line; input/button/chips are focusable with a visible outline; static CSS scan: no raw hex, radius only `0`/`var(--radius-*)`, `--accent-100` referenced on the answer bubble, `--accent-700` on `:focus-visible`.
- `frontend/src/api/client.test.ts` -- `describe('fetchQuery')`: URL without `incident_id` when omitted; URL with `incident_id` when given; blank hint omitted; empty `q` throws synchronously (fetch spy not called); non-2xx → `ApiError.status`; missing-`answer` body → `ApiError`; abort passes through.
- `frontend/src/App.tsx` -- call `const ask = useAskPortwatch();` and render `<AskPortwatch onSubmit={ask.submit} answer={ask.answer} submitting={ask.submitting} error={ask.error} selectedIncidentId={selectedId} />` below `<ExecutionTrace>` in the right `<aside>`. Update the shell comment to mention Story 2.6.

**Acceptance Criteria:**
- Given no incident is selected, when a free-text question is submitted, then `GET /incidents/query?q=…` is called with no `incident_id` parameter and the returned `answer` renders verbatim in an `aria-live="polite"` `accent-100` bubble.
- Given an incident is selected, when a question is submitted, then the same call additionally carries `&incident_id=<selectedId>`, and omitting it (no selection) still produces a normal answer.
- Given the backend returns a no-confident-match `answer` string, when it renders, then it is shown verbatim with normal answer styling — never replaced, reworded, or supplemented by a client-fabricated status.
- Given suggestion chips are shown, when one is clicked, then it populates the input and submits exactly as typing that text and pressing Enter would.
- Given the input is empty or a request is already in flight, when submit is attempted, then no request is made.
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, build, and all suites (2.1–2.5 unchanged, 2.6 new) pass, and every I/O matrix row has a passing assertion.

## Spec Change Log

## Review Triage Log

### 2026-08-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 9: (high 0, medium 1, low 8)
- defer: 0
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` `useAskPortwatch` hook had no executing test — added `frontend/src/hooks/useAskPortwatch.test.ts` (renderHook: resolved→answer set/error cleared; rejected→error set/prior answer kept; synchronous double-submit fires fetch once; unmount mid-flight sets no state; AbortError swallowed).
  - `[low]` `[patch]` `fetchQuery` forwarded untrimmed `q` / `incident_id` into the query string — now `params.set('q', q.trim())` and `params.set('incident_id', incidentId.trim())`.
  - `[low]` `[patch]` A 200 body with an empty / whitespace-only `answer` string passed validation and rendered a blank bubble — `fetchQuery` now throws `ApiError` for an empty `answer`.
  - `[low]` `[patch]` Duplicate `suggestions` entries collided on the React `key` — keyed by index+text.
  - `[low]` `[patch]` No in-flight affordance on the controls — added `disabled={submitting}` to input + submit button, `aria-busy={submitting}` on the form, and a `:disabled` style.
  - `[low]` `[patch]` A chip click while `submitting` overwrote the typed input with no submission — `handleChipClick` now early-returns while `submitting`.
  - `[low]` `[patch]` Misleading `AskPortwatch.css` header comment claimed all type routes through tokens — corrected (Story 2.1 defines no body font-size token; body sizes are literal like sibling components).
  - `[low]` `[patch]` `fetchQuery` timeout path + querystring-encoding had no test — added both to `client.test.ts`; removed an unused `const spy` in the new `stubAndCapture` helper.
  - `[low]` `[patch]` Added an `AskPortwatch` test asserting the submit button is `disabled` while `submitting` and a chip click then leaves the input unchanged.
- rejected (noise / spec-mandated / factually wrong): `fetchQuery` sync-throw vs reject (spec-mandated, matrix row); single collapsed error string + no `role="alert"` (spec-mandated plain line inside a `polite` region, UX-DR12); chips render as underlined text not bordered "chips" (that IS `button-ghost`); demo shell can't show a success answer (spec: inert demo shell, no backend); `reset()` doesn't abort in-flight (matches `useApproval` sibling, unwired); in-flight submits silently dropped (documented serialised design); `API_BASE` trailing-slash strip "only here" (factually wrong — `fetchIncidents`/`postApproval` do the same); no input `maxLength` / 414 risk (speculative, backend-dependent); no `:hover`/`:active` states (cosmetic, cross-component); ACs 1–3 load-bearing on the backend endpoint (Epic 2 structure — frontend stories build to Epic 1's API contract; "never introduce a new backend endpoint").

## Design Notes

**Honesty split:** FR12's "grounded, never fabricated" guarantee is enforced by the backend query handler (injects live `Incident` state as context, AD-2). The frontend's obligation is narrower and fully testable: render the `answer` string as-is, and on transport failure show a plain error line rather than any status-like text. Tests assert the component never emits incident-status wording that wasn't in `answer`.

**Optional hint:** build the query string with `URLSearchParams`; only `set('incident_id', id)` when `id?.trim()` is truthy. This keeps the "works without the hint" AC and the "never send empty" rule in one place.

**Chip = free text:** a chip click sets the controlled input value then runs the identical submit path, so there is exactly one submission code path to test and reason about.

## Verification

**Commands:**
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test` -- expected: all suites pass (2.1–2.5 unchanged, 2.6 new: `fetchQuery` client tests + `AskPortwatch` component tests); every I/O matrix row covered by a passing assertion; 0 failures.

## Auto Run Result

Status: done

**Implemented change:** Added the read-only natural-language query surface to the Live Console — a `fetchQuery` API-client function (`GET /incidents/query?q=&incident_id=` → `{answer}`, trimmed params, optional hint, `ApiError` discipline, empty-answer rejected), a render-safe `useAskPortwatch` submit hook (one GET per submit, serialised, aborts on unmount), and the `AskPortwatch` BlueprintPanel component (free-text input + primary "Ask" + ghost suggestion chips; answer rendered verbatim in an `accent-100` `aria-live="polite"` bubble; plain error line on failure; `disabled`/`aria-busy` while in flight). Wired into the `App.tsx` demo shell below `ExecutionTrace`.

**Files changed:**
- `frontend/src/api/client.ts` — new `fetchQuery` / `runQuery` (query read path, FR12/AD-2).
- `frontend/src/api/client.test.ts` — `describe('fetchQuery')`: URL shape, optional/blank hint, sync empty-`q` throw, non-2xx, bad/empty/non-object/unparseable body, timeout branch, querystring encoding, abort pass-through.
- `frontend/src/hooks/useAskPortwatch.ts` — new submit hook (state machine on the `useApproval` template).
- `frontend/src/hooks/useAskPortwatch.test.ts` — new: answer/error wiring, in-flight guard, unmount safety, `AbortError` swallow.
- `frontend/src/components/AskPortwatch/{AskPortwatch.tsx,AskPortwatch.css,AskPortwatch.test.tsx,index.ts}` — new component + token-only CSS + RTL suite + static CSS scan.
- `frontend/src/App.tsx` — mount `AskPortwatch` in the right column, wired to `useAskPortwatch()`; shell comment updated to 2.1–2.6.

**Review findings breakdown:** 9 patches applied (1 medium — missing `useAskPortwatch` test suite; 8 low — untrimmed query params, empty-answer blank bubble, duplicate-chip React key, no in-flight `disabled`/`aria-busy`, chip click overwriting input mid-request, misleading CSS comment, missing timeout/encoding tests + unused test var). 0 deferred. 10 rejected (spec-mandated design, sibling-pattern parity, or factually incorrect — see Review Triage Log).

**Follow-up review recommended:** true. This pass's patched findings: high 0, medium 1, low 8 → score `3×1 + 1×8 = 11` (≥ 5). No high-severity patch. The volume is low-severity polish; a light follow-up pass is advisory, not blocking.

**Verification performed:**
- `cd frontend && npm run build` → `tsc -b` strict + `vite build` succeed (`✓ built in 275ms`).
- `cd frontend && npm test` → `Test Files 9 passed (9)`, `Tests 330 passed (330)`, 0 failures, no `act()` warnings.
- Matrix Test Audit: every I/O & Edge-Case Matrix row has a covering assertion that ran and passed (client rows in `client.test.ts`; interaction/render rows in `AskPortwatch.test.tsx`; hook re-entrancy now also covered directly in `useAskPortwatch.test.ts`).

**Residual risks:**
- ACs 1–3 (backend resolves incident from text; grounded/honest no-match answer) are enforced by the Epic 1 query endpoint, which has no HTTP implementation in this repo yet — the frontend is built and tested against the documented contract only. This matches how Stories 2.1–2.5 were built; the demo shell has no live backend so `AskPortwatch` only ever shows the error line there.
- `useApproval` (the hook template) still has no test of its own — out of scope for this story.
