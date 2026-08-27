---
title: 'Story 2.8: KillSwitchControl'
type: 'feature'
created: '2026-08-28'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '6efe0152897877a1758ace2da52bbb2dd1cf5fcd'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-7-mappanel.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The operator has no way to halt all autonomous execution from the console, and no such control can be allowed to fire by accident. Per-incident `blocked_by_kill_switch` tags already exist (Stories 2.3/2.4) but there is no switch to engage and no global signal that it is engaged (UX-DR8, AD-7, AD-15).

**Approach:** Add `postKillSwitch` to the API client (`POST /kill-switch` body `{enabled: bool}`, AD-7), a render-safe `useKillSwitch` hook holding the engaged flag, and two components: `KillSwitchControl` — a persistent `role="switch"` dot control that lives directly in the Live Console header (never in a menu), where engaging is a deliberate two-step action (activate → inline "Confirm" → POST `{enabled:true}`) and disengaging is one step (activate → POST `{enabled:false}`); and `KillSwitchBanner` — a persistent global banner reading "Autonomous execution disabled" shown whenever the switch is engaged. Both are driven by one `useKillSwitch()` instance in `App.tsx`. The engaged flag is client-session state (AD-7 is a single in-memory flag with no read endpoint); a failed POST does not flip it.

## Boundaries & Constraints

**Always:**
- `postKillSwitch(enabled: boolean, signal?: AbortSignal): Promise<{ enabled: boolean }>` in `frontend/src/api/client.ts`. `POST ${API_BASE}/kill-switch`, `Content-Type: application/json`, body EXACTLY `{"enabled": <bool>}` — no other keys. Throws `ApiError` synchronously (before `fetch`) if `enabled` is not a boolean. Same failure discipline as `postApproval`: network reject → `ApiError`; non-2xx → `ApiError` carrying `.status`; a 2xx empty body is tolerated (resolves `{ enabled }` echoing the request); a 2xx non-empty body that is not JSON, or is JSON without a boolean `enabled`, → `ApiError`; the shared `REQUEST_TIMEOUT_MS` timeout → `ApiError`; a caller abort re-throws as-is.
- `useKillSwitch()` hook in `frontend/src/hooks/`: returns `{ engaged: boolean, pending: boolean, error: ApiError | null, setEngaged: (next: boolean) => void, reset: () => void }`. `engaged` starts `false`. `setEngaged(next)` no-ops if `pending` or if `next === engaged`; otherwise sets `pending`, POSTs `postKillSwitch(next)`, and on success sets `engaged = next` and clears `error`; on failure sets `error` and LEAVES `engaged` unchanged. Re-entrant calls ignored while `pending`. In-flight request aborted on unmount; no state set after unmount. Modelled on `useApproval`.
- `KillSwitchControl` component (`frontend/src/components/KillSwitchControl/` — `KillSwitchControl.tsx`, `KillSwitchControl.css`, `KillSwitchControl.test.tsx`, `index.ts`). Props: `{ engaged: boolean; pending: boolean; error: ApiError | null; onChange: (next: boolean) => void }`.
  - Root is a single element with `role="switch"` and `aria-checked={engaged}`, an accessible name of "Kill switch" (via `aria-label` or a visually-adjacent label wired with `aria-labelledby`), keyboard-operable (Tab to focus; Enter and Space activate), with a visible `:focus-visible` outline `2px solid var(--accent-700)` + offset.
  - Rendered as a circular dot control (`border-radius: var(--radius-full)` is the ONLY permitted non-zero radius here); the dot fill is `var(--accent-900)` when `engaged`, a neutral token otherwise. State is never conveyed by the dot colour alone — a visible text label ("Autonomous execution: ON" / "Autonomous execution: DISABLED", or equivalent plain wording) always accompanies it.
  - **Engage (currently `engaged === false`):** first activation does NOT call `onChange`; it reveals an inline confirm affordance — a `button` reading "Confirm" (or "Confirm disable") adjacent to the switch, plus a plain prompt line. Activating that confirm button calls `onChange(true)`. Activating the switch again while unconfirmed, pressing `Escape`, or moving focus away cancels the pending confirm (no `onChange`).
  - **Disengage (currently `engaged === true`):** a single activation calls `onChange(false)` immediately — no confirm step.
  - While `pending`, the control and the confirm button are `disabled` / `aria-disabled` and show a plain "Working…" affordance; activations are no-ops.
  - If `error != null`, a plain inline line is shown ("Couldn't reach the kill switch — try again.") and the control reflects the UNCHANGED `engaged` state (the attempted toggle did not take effect).
- `KillSwitchBanner` component (same folder or `frontend/src/components/KillSwitchControl/KillSwitchBanner.tsx` + exported from the folder `index.ts`). Props: `{ engaged: boolean }`. Renders nothing when `!engaged`. When `engaged`, renders a persistent banner element with `role="status"`, text exactly "Autonomous execution disabled", full-bleed, `var(--accent-900)` background with a light-token text colour, no dismiss control, no timeout.
- Accessibility floor (UX-DR11): switch + confirm button reachable and operable via keyboard; focus rings at AA contrast; on/off distinguished by label text (not colour alone).
- Voice & tone (UX-DR12): all copy plain and factual — "Autonomous execution disabled", "Confirm", "Working…", "Couldn't reach the kill switch — try again." No exclamation, no emoji, no "CRITICAL"/"WARNING".
- CSS files use `var(--*)` for every colour; `border-radius` is `0` / `var(--radius-*)` (the dot may use `var(--radius-full)`); px only for structural sizes. Static CSS scan in each test (same technique as Stories 2.1–2.7).
- `App.tsx`: one `const kill = useKillSwitch();`. Render `<KillSwitchControl engaged={kill.engaged} pending={kill.pending} error={kill.error} onChange={kill.setEngaged} />` inside the existing `<header>` (right-aligned). Render `<KillSwitchBanner engaged={kill.engaged} />` as the first child of the app root, above the `<header>` (so it is unmissable on the one demo screen). Update the shell comment to mention Story 2.8.

**Block If:**
- The kill-switch endpoint contract is not `POST /kill-switch {enabled: bool}` (ARCHITECTURE-SPINE.md line 231, AD-7).

**Never:**
- Never place the control inside a menu, dropdown, or overflow — it is always visible in the header.
- Never auto-dismiss the banner, add a timeout, or a sound.
- Never engage on a single activation; never require a confirm step to DISENGAGE.
- Never flip `engaged` when the POST failed.
- Never reclassify a `blocked_by_kill_switch` incident's `tier` — that logic already lives in `lib/incident.ts` / `IncidentFeed` and is out of scope here.
- Never add a GET/read endpoint for the flag; do not introduce any new backend endpoint; do not touch `backend/`.
- No archive route — that is Story 2.9.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| POST shape | `postKillSwitch(true)` | `POST ${API_BASE}/kill-switch`, body `{"enabled":true}` and no other keys | n/a |
| Non-boolean | `postKillSwitch('yes' as any)` | throws `ApiError` synchronously, no `fetch` | ApiError |
| Empty 2xx body | POST resolves 204 / empty | resolves `{ enabled: true }` (echoes request) | n/a |
| Non-2xx | endpoint 500 | rejects `ApiError`, `.status === 500` | ApiError |
| Bad body | 200 body `{"ok":1}` | rejects `ApiError` (no boolean `enabled`) | ApiError |
| Caller abort | signal aborted mid-flight | rejects with original `AbortError` | pass-through |
| Engage step 1 | `engaged=false`, activate switch | `onChange` NOT called; inline "Confirm" affordance + prompt appear | n/a |
| Engage step 2 | confirm affordance visible, activate "Confirm" | `onChange(true)` called once | n/a |
| Engage cancel | confirm visible, press `Escape` (or activate switch again) | confirm affordance disappears; `onChange` NOT called | n/a |
| Disengage | `engaged=true`, activate switch | `onChange(false)` called once immediately; no confirm shown | n/a |
| Pending | `pending=true` | switch + confirm `disabled`/`aria-disabled`; activations no-op; "Working…" shown | n/a |
| Error | `error != null` | plain "Couldn't reach the kill switch — try again." line; `aria-checked` still reflects the unchanged `engaged` | n/a |
| Banner hidden | `<KillSwitchBanner engaged={false} />` | renders nothing (null) | n/a |
| Banner shown | `<KillSwitchBanner engaged={true} />` | `role="status"` element, text "Autonomous execution disabled", no dismiss control | n/a |
| Hook success | `setEngaged(true)` resolves | `engaged` becomes `true`, `error` null, `pending` false | n/a |
| Hook failure | `setEngaged(true)` rejects | `error` set, `engaged` stays `false`, `pending` false | n/a |
| Hook re-entrancy | `setEngaged(true)` twice while pending | second call fires no second POST | n/a |
| Hook no-op | `setEngaged(false)` when already `false` | no POST, no state change | n/a |

</intent-contract>

## Code Map

- `frontend/src/api/client.ts` -- add `postKillSwitch`; reuse `API_BASE`, `REQUEST_TIMEOUT_MS`, `ApiError`, `isAbortError`, `isTimeoutError`, and the `postApproval` body/POST/empty-body pattern verbatim.
- `frontend/src/api/client.test.ts` -- `vi.stubGlobal('fetch', …)` harness + top-level `afterEach(vi.unstubAllGlobals)`; add a `describe('postKillSwitch')` block for the matrix's client rows.
- `frontend/src/hooks/useApproval.ts` -- exact state-machine template (refs for re-entrancy + `mountedRef` + `AbortController`, `void (async () => …)()`); `useKillSwitch` mirrors it, adding the `engaged` state and the `next === engaged` no-op.
- `frontend/src/hooks/useAskPortwatch.ts` + `useAskPortwatch.test.ts` -- the just-added sibling hook + its `renderHook` test style to copy for `useKillSwitch.test.ts`.
- `frontend/src/components/AskPortwatch/AskPortwatch.tsx` + `.css` + `.test.tsx` -- nearest interactive-component pattern: BlueprintPanel-free plain section, `:focus-visible` outline token, plain error line, `disabled` while in flight, static CSS scan test.
- `frontend/src/lib/incident.ts` (17-18, 53) + `frontend/src/components/IncidentFeed/incidentFeed.helpers.ts` (89-115) -- EXISTING per-incident `blocked_by_kill_switch` tag logic (`KILL_SWITCH_TAG`, `showKillSwitchTag`); DO NOT duplicate or modify.
- `frontend/src/App.tsx` -- `<header>` currently holds only `<h1>Portwatch Console</h1>`; add the control right-aligned. Add the banner as the first root child.
- `_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md` (231, AD-7, AD-15) -- `POST /kill-switch {enabled: bool}`; single global in-memory flag; re-enable does not auto-resume.
- `.../ux-designs/.../DESIGN.md` (147) -- `role="switch"` toggle styled as a circular dot; `accent-900` when engaged.
- `.../ux-designs/.../EXPERIENCE.md` (57, 69, 81) -- persistent header position, never nested; two-step engage / one-step disengage; engaged → persistent "Autonomous execution disabled" banner.

## Tasks & Acceptance

**Execution:**
- `frontend/src/api/client.ts` -- add `postKillSwitch(enabled, signal?)`: `typeof enabled !== 'boolean'` → sync `ApiError`; POST JSON `{ enabled }`; timeout→`ApiError`, abort→rethrow, other→`ApiError`; non-`ok`→`ApiError(status)`; read text, empty→`return { enabled }`, else `JSON.parse` guarded, require `typeof parsed.enabled === 'boolean'` else `ApiError`, return `{ enabled: parsed.enabled }`.
- `frontend/src/hooks/useKillSwitch.ts` -- `useKillSwitch()` per the template; `setEngaged(next)` guards `pending` and `next === engagedRef.current`; success sets `engaged`; failure leaves it; abort on unmount.
- `frontend/src/hooks/useKillSwitch.test.ts` -- `renderHook` with `fetch` stubbed: success flips `engaged`; failure keeps `engaged` + sets `error`; double `setEngaged(true)` fires `fetch` once; `setEngaged(current)` fires nothing; unmount mid-flight sets no state; `AbortError` swallowed.
- `frontend/src/components/KillSwitchControl/KillSwitchControl.tsx` -- `function KillSwitchControl({ engaged, pending, error, onChange })`: local `useState` `confirming`; root `[role="switch"][aria-checked]` + label text + dot; `onActivate` = if `pending` return; if `engaged` → `onChange(false)`; else if `confirming` → (noop, confirm button owns it) ; else `setConfirming(true)`. Confirm `<button>` (only when `!engaged && confirming && !pending`) → `onChange(true)` ; `Escape` key handler + `onBlur` of the group → `setConfirming(false)`. "Working…" when `pending`; plain error line when `error`.
- `frontend/src/components/KillSwitchControl/KillSwitchBanner.tsx` -- `function KillSwitchBanner({ engaged })`: `engaged ? <div role="status" className="kill-switch-banner">Autonomous execution disabled</div> : null`.
- `frontend/src/components/KillSwitchControl/KillSwitchControl.css` -- `.kill-switch*`, `.kill-switch__dot` (`var(--radius-full)`, `var(--accent-900)` when `--engaged`), `.kill-switch__label`, `.kill-switch__confirm`, `.kill-switch__status`, `.kill-switch__error`, `.kill-switch-banner` (`var(--accent-900)` bg, light text, full-bleed); `:focus-visible` outline `2px solid var(--accent-700)` + offset; colours via `var(--*)`; only `--radius-full` non-zero radius.
- `frontend/src/components/KillSwitchControl/index.ts` -- export `KillSwitchControl`, `KillSwitchBanner`, `default`, and the prop types.
- `frontend/src/components/KillSwitchControl/KillSwitchControl.test.tsx` -- RTL/jsdom + CSS scan: covers every component/banner matrix row (engage two-step, cancel via Escape + via re-activate, disengage one-step, pending disables, error line + `aria-checked` unchanged, banner null vs `role="status"` text, keyboard Enter/Space on the switch, `:focus-visible` + dot `--accent-900` + radius scan).
- `frontend/src/api/client.test.ts` -- `describe('postKillSwitch')` for the six client matrix rows.
- `frontend/src/App.tsx` -- `useKillSwitch()`; control in `<header>` (right side, e.g. `<div style={{ marginLeft: 'auto' }}>`); `<KillSwitchBanner>` as first root child; shell comment → "Stories 2.1–2.8".

**Acceptance Criteria:**
- Given the dashboard renders, when the header is shown, then the kill-switch `role="switch"` control is visible in the header and not nested inside any menu or overflow.
- Given the switch is off, when the operator activates it once, then nothing is sent and an inline confirm step appears; only activating the confirm sends `POST /kill-switch {enabled:true}` (via `onChange(true)`).
- Given the switch is on, when the operator activates it once, then `POST /kill-switch {enabled:false}` is sent immediately (via `onChange(false)`) with no confirm step.
- Given the switch is engaged, when any screen is viewed, then a persistent `role="status"` banner reading "Autonomous execution disabled" is shown, with no dismiss control and no timeout, alongside the existing per-incident tags (unchanged).
- Given a kill-switch POST fails, when the hook settles, then `engaged` is left unchanged and a plain retry line is shown — the switch never shows a state the backend did not accept.
- Given a clean checkout, when `npm run build && npm test` runs in `frontend/`, then typecheck, build, and all suites (2.1–2.7 unchanged, 2.8 new) pass, and every I/O matrix row has a passing assertion.

## Spec Change Log

## Review Triage Log

### 2026-08-28 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 8: (high 0, medium 1, low 7)
- defer: 0
- reject: 14
- addressed_findings:
  - `[medium]` `[patch]` `confirming` was never cleared after the Confirm click or on an `engaged` prop change — after engage→disengage the confirm prompt re-appeared unprompted and the next switch activation toggled `confirming` off instead of starting a fresh engage. Confirm `onClick` now clears `confirming`; a `useEffect(…, [engaged])` clears it on any external state change; the engage-path activation now sets `confirming` true (not a toggle) and Escape/blackout still cancel. New tests: engage→disengage leaves no stale prompt; a failed engage POST does not leave a bare armed Confirm.
  - `[low]` `[patch]` `useKillSwitch` stored the requested `next` and discarded the `{ enabled }` the client parsed from the server response — now stores the server-confirmed value (`postKillSwitch`'s empty-body path still echoes the request, so behaviour is unchanged when the backend agrees).
  - `[low]` `[patch]` `handleBlur` cancelled `confirming` whenever `relatedTarget` was `null` (common on mousedown in Firefox/Safari), which could unmount Confirm before its click landed — now only cancels when focus demonstrably moved to an element outside the group.
  - `[low]` `[patch]` Accessible-name / Label-in-Name (WCAG 2.5.3): the switch's accessible name was "Kill switch" while the visible text said "Autonomous execution: ON/DISABLED", and `id="kill-switch-label"` was referenced by nothing — wired the switch's `aria-labelledby` to the visible label span, added `role="group"` + `aria-labelledby` on the wrapper, dropped the dead standalone `aria-label`, and removed the redundant `aria-disabled` on the natively-`disabled` buttons.
  - `[low]` `[patch]` `.kill-switch__confirm` hard-coded `letter-spacing: 0.08em` / `font-size: 12px` though the sibling `.kill-switch__label` routes through `--font-size-micro-label` / `--letter-spacing-micro-label` — routed the confirm label through the same tokens; added the missing CSS-scan assertion for the confirm button's colours that the test comment already claimed.
  - `[low]` `[patch]` `postKillSwitch` client tests missed the timeout branch, a real caller-`signal` abort through `AbortSignal.any`, and a well-formed 2xx body whose `enabled` is returned to the caller — added all three.
  - `[low]` `[patch]` `index.ts` re-exported `default` for `KillSwitchControl` but not `KillSwitchBanner` (which also has a default export) — made the barrel symmetric.
  - `[low]` `[patch]` `.kill-switch-banner` used `width: 100%` + horizontal padding with no `box-sizing` guarantee — added `box-sizing: border-box` so it cannot overflow the viewport.
  - note: `useKillSwitch.test.ts` (8 passing `renderHook` tests — in-flight guard, failure-leaves-`engaged`, no-op, unmount-abort, `AbortError` swallow) and `spec-2-8-killswitchcontrol.md` existed on disk but were untracked, so they were absent from the reviewed diff — a diff-construction slip on my side, not a coverage gap (verification-gap confirmed the file's contents). Both are included in the story commit.
- rejected (spec-mandated / sibling-pattern parity / factually wrong / no-op in the current token system): one-step disengage has no confirm (SPEC-MANDATED and intentional — UX-DR8 / EXPERIENCE.md line 57: the operator must always be able to halt autonomy fast); single generic error string with no `.status`/`.message` surfaced and unused `reset()` (spec: plain non-alarmist line, UX-DR12; `reset` mirrors `useApproval`/`useAskPortwatch` — wired by integrators later); `AbortSignal.timeout`/`any` unguarded (every sibling client fn does the same; Node ≥20.11 + modern Vite target guaranteed); abort/timeout during `res.text()` body read (verbatim `postApproval` pattern; changing it in isolation is worse); `mountedRef` re-set to `true` in the effect body / StrictMode remount (matches `useApproval` + `useAskPortwatch`; app does not enable StrictMode; ends in correct ref state); `role="status"` banner mounts already-populated so some SRs may not announce (spec mandates render-nothing-when-off + the banner's job is visual prominence); auto-move focus to Confirm on reveal (not required; adjacent + Tab-reachable; auto-focus-move can disorient); `API_BASE` trailing-slash strip "inconsistent with siblings" (factually wrong — `fetchIncidents`/`postApproval`/`fetchQuery` all strip it); no i18n indirection for copy (no i18n framework in the project; every component inlines strings); banner dark-mode contrast (`tokens.css` is a single fixed light palette, no `prefers-color-scheme`, nothing inverts); AC1 header placement + AC4 cross-screen persistence + coexistence with the Story 2.4 per-incident tag are integration-surface expectations untestable in the throwaway `App.tsx` shell (Epic 2 pattern — components built + demo-mounted, real router/layout deferred; `App.tsx`'s own comment says so; per-incident tag logic already lives independently in `lib/incident.ts`); redundant `disabled`+`aria-disabled` folded into the a11y patch above.

## Design Notes

**Client-session engaged flag:** AD-7 is a single in-memory backend flag with no read endpoint, so the console cannot rehydrate switch state on load. `engaged` therefore starts `false` each session and only moves on a POST this session confirmed. This is acceptable for the single-operator demo context (EXPERIENCE.md line 18) and keeps the hook's contract simple; a real deployment would poll a status field.

**Two-step engage, one-step disengage — where the logic lives:** the hook is symmetric (`setEngaged(next)` either way). The asymmetry is purely in `KillSwitchControl`: the confirm gate is local component state that only exists on the `engaged === false → true` path. Disengage must stay one step so an operator can always kill autonomy fast; adding friction there would be an anti-feature.

**Banner placement:** rendered above the header as the first root child so it can be full-bleed and unmissable. It is `role="status"` (not `alert`) — persistent, not an interruption, matching UX-DR12's non-alarmist register.

**`aria-checked` honesty:** the control's `aria-checked` is driven by the `engaged` prop only, never by an optimistic local guess. A failed POST leaves `engaged` false, so the switch and screen readers both keep saying "off".

## Verification

**Commands:**
- `cd frontend && npm run build` -- expected: `tsc -b` strict + `vite build` succeed.
- `cd frontend && npm test` -- expected: all suites pass (2.1–2.7 unchanged, 2.8 new: `postKillSwitch` client tests + `useKillSwitch` hook tests + `KillSwitchControl`/`KillSwitchBanner` component tests); every I/O matrix row covered by a passing assertion; 0 failures.

## Auto Run Result

Status: done

**Implemented change:** Added the operator kill switch — `postKillSwitch` API client (`POST /kill-switch {enabled}`, AD-7, `ApiError` discipline, non-boolean guard, empty-body echo), a render-safe `useKillSwitch` hook (session-held `engaged` flag, serialised, aborts on unmount, stores the server-confirmed value, leaves `engaged` unchanged on failure), a `role="switch"` `KillSwitchControl` in the header (deliberate two-step engage via an inline Confirm; one-step disengage; label text never colour-only; keyboard-operable), and a persistent `role="status"` `KillSwitchBanner` reading "Autonomous execution disabled" while engaged. Wired into `App.tsx`.

**Files changed:**
- `frontend/src/api/client.ts` — new `postKillSwitch`.
- `frontend/src/api/client.test.ts` — `describe('postKillSwitch')`: POST shape/body keys, sync non-boolean, empty 2xx echo, well-formed body as source of truth, non-2xx `.status`, bad body, timeout, real signal abort.
- `frontend/src/hooks/useKillSwitch.ts` + `useKillSwitch.test.ts` — new hook + 9 `renderHook` tests (flip, failure-keeps-`engaged`, server-confirmed value, in-flight guard, no-op, unmount-abort, `AbortError`).
- `frontend/src/components/KillSwitchControl/{KillSwitchControl.tsx,KillSwitchBanner.tsx,KillSwitchControl.css,KillSwitchControl.test.tsx,index.ts}` — new; two-step engage / one-step disengage, confirm lifecycle fixed, WCAG-2.5.3 accessible name, `role="group"` wrapper, token-only CSS.
- `frontend/src/App.tsx` — `useKillSwitch()`; control right-aligned in `<header>`; banner as first root child; shell comment → 2.1–2.8.

**Review findings breakdown:** 8 patches applied (1 medium — `confirming` state lifecycle: stale confirm prompt reappeared after an engage→disengage cycle and a failed engage left a bare armed Confirm; 7 low — hook discarded the server-confirmed value, `handleBlur` null-relatedTarget tore down Confirm early, WCAG label-in-name mismatch + dead id, confirm-label hard-coded type values, missing client tests, asymmetric barrel export, banner `box-sizing`). 0 deferred. 14 rejected (spec-mandated one-step disengage & plain error line, sibling-pattern parity, factually incorrect claims, or no-ops under the current single-theme token system — see Review Triage Log). One diff-construction slip on my side: `useKillSwitch.test.ts` and this spec were untracked and absent from the reviewed diff; both are in this commit and the hook's coverage was confirmed present by the verification-gap reviewer.

**Follow-up review recommended:** true. This pass's patched findings: high 0, medium 1, low 7 → score `3×1 + 1×7 = 10` (≥ 5). No high-severity patch. The medium (confirm lifecycle) is now fixed and covered; the rest is a11y/test polish.

**Verification performed:**
- `cd frontend && npm run build` → `tsc -b` strict + `vite build` succeed (`✓ built in 219ms`).
- `cd frontend && npm test` → `Test Files 12 passed (12)`, `Tests 428 passed (428)`, 0 failures.
- Matrix Test Audit: every I/O & Edge-Case Matrix row has a covering assertion that ran and passed (client rows in `client.test.ts`; hook rows in `useKillSwitch.test.ts`; component/banner rows in `KillSwitchControl.test.tsx`).

**Residual risks:**
- `engaged` is client-session state (AD-7 exposes no read endpoint) — resets to `false` on reload; per Design Notes, acceptable for the single-operator demo, a real deployment would poll a status field.
- Header placement / cross-screen banner persistence / coexistence with the Story 2.4 per-incident tag are only demonstrated in the throwaway `App.tsx` shell — the real layout/router is a deferred Epic 2 concern (same as Stories 2.6/2.7). The per-incident tag logic itself is independent and unchanged in `lib/incident.ts`.
