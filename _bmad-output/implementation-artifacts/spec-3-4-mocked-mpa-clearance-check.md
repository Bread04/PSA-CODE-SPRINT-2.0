---
title: 'Mocked MPA Clearance Check'
type: 'feature'
created: '2026-08-29'
status: 'done'
baseline_revision: '25586d894d769e99e723a67b9c4f810f1a719acd'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The pitch wants a compliance-interoperability angle — an MPA-style clearance check modelled on digitalPORT@SG's workflow shape — with no live external dependency. Today "MPA" is only a note folded into the generic `notification` mock; there is no clearance-check service with the request → status → conditions shape.

**Approach:** Add one deterministic mock service `mpa_clearance` to the existing roster, honouring the shared `execute(action) -> {ok, result, error}` contract exactly, with the same injectable `fail` mode as every other mock. Its success `result` models the digitalPORT@SG shape (plus the `service` key every mock result carries): `{service, clearance_status, conditions, request_ref}`. Prove — in the style of `spec-3-1` / `spec-3-2` — that it plugs into `execute_action` and flows through `run_policy_and_execution` with no new pipeline stage, tier, endpoint, or `run.py` change. No live calls, ever.

## Boundaries & Constraints

**Always:** `mpa_clearance` is registered via `mock_services.services.SERVICE_NAMES` and returned by `build_registry()`. Its `execute(action)` returns the exact `{ok, result, error}` shape; on the injectable failure path it returns `{ok: False, result: None, error: "<name>: …"}` like `MockService`. `result` (on success) is `{"service": "mpa_clearance", "clearance_status": "granted"|"conditional"|"refused", "conditions": [<str>...], "request_ref": <str>}`, derived deterministically from the call payload (no randomness, no wall-clock, no I/O). The proof drives the real `orchestrator.run.run_policy_and_execution` with an injected `execute_registry` and asserts `{e.stage for e in incident.trace} <= set(orchestrator.trace.STAGES)`.

**Block If:** (none — purely additive to the mock roster; no frozen-contract edit required.)

**Never:** No change to `backend/orchestrator/run.py`, `backend/models/*`, `backend/agents/*`, `backend/api/*`, `backend/policy/*`, or `execute_action`'s signature/behaviour. No new HTTP endpoint, policy tier, tier rule, or pipeline stage. No live call to digitalPORT@SG or any real MPA system. Do not wire `mpa_clearance` into `_option_to_action` (that is frozen `run.py` — the running pipeline calling MPA automatically is explicitly out of scope; this story delivers the mock + proof, not the trigger rule).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| HAPPY_PATH | `execute({"clearance_ref": "REQ-1"})` on a non-failing `mpa_clearance` service | `{ok: True, result: {service, clearance_status, conditions, request_ref}, error: None}`; `clearance_status` one of the three allowed strings; `request_ref` echoes the input ref | n/a |
| CONDITIONAL | payload flags a condition trigger (e.g. `{"hazmat": true}`) | `clearance_status == "conditional"` with a non-empty `conditions` list | n/a |
| FAIL_MODE | `mpa_clearance` built with `fail=True` (injected) | `{ok: False, result: None, error: "mpa_clearance: …"}` | failure surfaced, not swallowed |
| IN_ACTION | `execute_action({"calls": [{"service": "tos", ...}, {"service": "mpa_clearance", "payload": {...}}]}, build_registry())` | two per-call result rows, each `{service, ok, result, error}`, the `mpa_clearance` row recorded individually | an unknown service still recorded as a failure (unchanged) |
| THROUGH_PIPELINE | an option whose action includes an `mpa_clearance` call, driven via `run_policy_and_execution(execute_registry=build_registry())` | incident reaches EXECUTE + VERIFY; `execution_results` includes the `mpa_clearance` row; no trace stage outside `STAGES`; tier unchanged by the MPA call | a failing `mpa_clearance` call leaves the incident `open` (existing execution-failure behaviour), no new handling |

</intent-contract>

## Code Map

- `backend/mock_services/services.py` -- `MockService` (L18) `execute` contract; `SERVICE_NAMES` tuple (L32); `build_registry()` (L43) dict-comprehension over `SERVICE_NAMES`; `execute_action()` (L49) iterates `action["calls"]`, duck-types `service.execute`. Add `mpa_clearance` here.
- `backend/orchestrator/run.py` -- `_option_to_action` (L108) builds `calls` (`tos` always, `dg_checker` if `dg_involved`); `run_policy_and_execution` (L239) accepts `execute_registry=`. READ-ONLY — the proof injects a registry and hand-builds the action; `run.py` is not edited.
- `backend/orchestrator/trace.py` -- `STAGES` tuple — the proof asserts `<= set(STAGES)`.
- `backend/tests/orchestrator/test_epic1.py` -- `TestMockExecution` (L418) and `TestOrchestrator` (L297): the `build_registry` / `execute_action` / `run_policy_and_execution` drive pattern to mirror.
- `backend/tests/orchestrator/test_concurrent_incidents.py` -- registry-injection + `_assert` structural template.
- `backend/models/recovery.py` -- `RecoveryOption` (`extra="forbid"`, no MPA field). READ-ONLY — confirms why the trigger rule is out of scope.

## Tasks & Acceptance

**Execution:**
- `backend/mock_services/services.py` -- add `"mpa_clearance"` to `SERVICE_NAMES`. Add `class MpaClearanceService(MockService)` overriding `execute(self, action)`: honour `self._fail` exactly as `MockService` does; otherwise return `{"ok": True, "result": {"service": "mpa_clearance", "clearance_status": _status_for(action), "conditions": _conditions_for(action), "request_ref": str(action.get("clearance_ref") or action.get("request_ref") or "MPA-REQ")}, "error": None}` where `_status_for` is a pure function of the payload (`"conditional"` when a hazmat/DG-ish flag is present, `"refused"` when an explicit `deny` flag is present, else `"granted"`) and `_conditions_for` returns a fixed non-empty list for `"conditional"`/`"refused"`, `[]` for `"granted"`. In `build_registry`, instantiate `MpaClearanceService` for the `"mpa_clearance"` name (plain `MockService` for the rest). Update the module docstring: the roster is now eight services and MPA clearance is its own service, no longer only a `notification` note.
- `backend/tests/mock_services/test_mpa_clearance.py` -- NEW. Cover every I/O matrix row: HAPPY_PATH shape + allowed `clearance_status` values + `request_ref` echo; CONDITIONAL (`{"hazmat": True}` → `conditional` + non-empty `conditions`); explicit `deny` → `refused`; FAIL_MODE (`MpaClearanceService("mpa_clearance", fail=True)` → `{ok: False, result: None}`); IN_ACTION (`execute_action` with a `tos` + `mpa_clearance` call records both rows individually, `mpa_clearance` row has the clearance `result`); THROUGH_PIPELINE (build a `RecoveryOption`, hand-build an action `{"calls": [{"service": "tos", ...}, {"service": "mpa_clearance", "payload": {...}}]}` — or reuse `_option_to_action` output and append the mpa call in the test — drive `run_policy_and_execution(incident, arbiter_result, execute_registry=build_registry(), staleness_seconds=0)`; assert incident reaches EXECUTE + VERIFY, `execution_results` contains the `mpa_clearance` row, `{e.stage for e in incident.trace} <= set(STAGES)`, and `incident.tier` is unchanged from the no-MPA baseline). Deterministic; `asyncio.run`; reset globals (`reset_kill_switch_for_tests`, `reset_mock_agents`) first.
- `backend/tests/orchestrator/test_epic1.py` -- do **not** edit; run it in verification to confirm the existing `SERVICE_NAMES`-length-agnostic assertions still pass (`build_registry()` gains a key; `test_execute_action_records_each_call` and friends must stay green).

**Acceptance Criteria:**
- Given `build_registry()`, when inspected, then it contains an `mpa_clearance` entry whose `execute` returns the `{ok, result, error}` contract with `result` carrying `clearance_status` + `conditions` + `request_ref`.
- Given an action whose `calls` include an `mpa_clearance` call, when `execute_action` runs it, then the MPA result is recorded as its own per-call row, never rolled into another call's pass/fail.
- Given that same action driven through `run_policy_and_execution` with an injected registry, when it executes, then the incident reaches EXECUTE and VERIFY with no trace stage outside `STAGES`, no new tier rule, and `run.py` byte-unchanged.
- Given `mpa_clearance` built in its injected failure mode, when called, then it returns `{ok: False, result: None, error: …}` and the failure is recorded, not swallowed.
- `pytest backend/tests/mock_services/test_mpa_clearance.py` passes deterministically and `pytest backend/tests/orchestrator/test_epic1.py` stays green.

## Spec Change Log

- **2026-08-29 — review clarification (implementation patches, no re-derive):**
  - The `conditional` trigger set is broader than the `hazmat`-only example in the I/O matrix: any of `hazmat` / `dg` / `dg_involved` / `imdg` / `dangerous_goods` truthy → `conditional`. This is a DG-adjacency convenience for a caller (there is no caller yet — the trigger rule is out of scope); recorded here so it is not re-narrowed on a re-derive. All five keys are now unit-tested.
  - Result shape is 4 keys (`service` + the three digitalPORT@SG keys); Intent text corrected to match.

## Review Triage Log

### 2026-08-29 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 11: (high 0, medium 0, low 11)
- defer: 0
- reject: 4: (high 0, medium 0, low 4)
- addressed_findings:
  - `[low]` `[patch]` `execute` / `_mpa_*` helpers raised `AttributeError` on a non-dict/`None` payload instead of returning the contract — guard `action` to `{}` when not a dict; test added.
  - `[low]` `[patch]` Flag truthiness was inconsistent — `{"hazmat": False}` / `{"deny": ""}` now correctly read as `granted`; falsy-flag tests added.
  - `[low]` `[patch]` `request_ref` derivation masked a falsy-but-present `clearance_ref` (`""`, `0`) via an `or` chain and blind-`str()`-coerced — now presence-checked; non-string and empty-ref tests added.
  - `[low]` `[patch]` `MpaClearanceService.execute` failure branch copy-pasted `MockService`'s dict — now delegates to `super().execute(action)`.
  - `[low]` `[patch]` Tests asserted only non-empty/`str` for `conditions` — now pin the exact fixed strings.
  - `[low]` `[patch]` The broadened `conditional` trigger set (`dg`, `imdg`, `dangerous_goods`) was untested and unrecorded — Spec Change Log note added; all five keys unit-tested.
  - `[low]` `[patch]` `test_through_pipeline_failing_mpa` only half-checked — now also asserts the sibling `tos` row is `ok` and the MPA row's `error` is non-None.
  - `[low]` `[patch]` No coverage that two `mpa_clearance` calls in one action record as separate rows — test added.
  - `[low]` `[patch]` No coverage that `conditions` is a fresh list per call — isolation test added (mutating one result's list does not affect the next).
  - `[low]` `[patch]` `"mpa_clearance"` literal was repeated across `SERVICE_NAMES` / `build_registry` / the result payload — extracted a module constant; `build_registry` now uses a `{name: cls}` special-service map instead of a hard-coded name check.
  - `[low]` `[patch]` The module docstring's "no longer folded into the `notification` mock" claim was not backed by an actual edit — the `notification` roster line no longer says "(incl. MPA)".

## Design Notes

Why mock-and-prove, not a trigger rule: making the *running* pipeline call MPA "for an action that would benefit" needs either a new `RecoveryOption` field (`models/recovery.py` is `extra="forbid"` and frozen) or a branch in `_option_to_action` (`run.py`, frozen Epic 1 golden path). Both are outside the "strictly additive" Day-5 stretch rule. This story ships the service + a proof it integrates; the automatic trigger is a separate, human-owned change (same proof-not-enforcement shape as `spec-3-2`'s helper).

digitalPORT@SG shape reference (the `result` payload only): a clearance request carries a reference and cargo/vessel context; the response is a status (`granted` / `conditional` / `refused`) plus, when not cleanly granted, a list of conditions to satisfy. Modelled as fixed deterministic strings — no schema beyond what the proof asserts.

## Verification

**Commands:**
- `cd backend && python -m pytest tests/mock_services/test_mpa_clearance.py -q` -- expected: all pass, deterministic across repeats.
- `cd backend && python -m pytest -q` -- expected: full suite green (new `mpa_clearance` key does not break any `build_registry` / `execute_action` test).

**Manual checks:**
- `git diff --stat` shows changes only in `backend/mock_services/services.py` and the new test file (plus this spec doc) — nothing under `backend/orchestrator/`, `backend/models/`, `backend/agents/`, `backend/api/`, `backend/policy/`.

## Auto Run Result

Status: done

### Implemented change

Epic 3 / FR19 Story 3.4, scoped (per the verbatim task intent and the Epic 1 freeze) as **additive mock + deterministic proof**, not a wired-in trigger. `backend/mock_services/services.py` gains an eighth service, `mpa_clearance`, as `MpaClearanceService(MockService)` honouring the shared `execute(action) -> {ok, result, error}` contract with the same injectable `fail` mode as every other mock. Its success `result` models the digitalPORT@SG shape: `{service, clearance_status ∈ {granted, conditional, refused}, conditions, request_ref}`, derived by pure payload functions (no randomness, wall-clock, or I/O). A new proof test drives the real `run_policy_and_execution` (via a test-only `_option_to_action` monkeypatch — `run.py` byte-unchanged) and asserts EXECUTE + VERIFY are reached, the MPA row is recorded individually, no trace stage falls outside `STAGES`, and tier/resolution are identical to the no-MPA baseline.

### Files changed

- `backend/mock_services/services.py` — `+"mpa_clearance"` in `SERVICE_NAMES`; `MPA_CLEARANCE` constant; `_mpa_payload` / `_mpa_status_for` / `_mpa_conditions_for` / `_mpa_request_ref` pure helpers; `MpaClearanceService` (fail branch delegates to `super().execute`); `build_registry` uses a `_SPECIAL_SERVICES` `{name: cls}` map; module docstring reconciled (MPA is its own service, no longer a `notification` note).
- `backend/tests/mock_services/test_mpa_clearance.py` — NEW, 23 tests: every I/O matrix row + all five conditional trigger keys, non-dict payload, falsy-flag / falsy-and-non-string `clearance_ref`, exact pinned condition strings, fresh-`conditions`-list isolation, two-MPA-calls-stay-separate-rows, failing-MPA pipeline (sibling `tos` still ok, MPA `error` non-None), deterministic across repeats.

### Review findings breakdown

- Patches applied: 11 (0 high, 0 medium, 11 low) — non-dict-payload guard; consistent flag truthiness (`{"hazmat": False}` → granted); presence-checked `request_ref` (falsy-but-present ref preserved); fail branch delegates to `super()`; pinned exact condition strings; tested the broadened conditional trigger set (`dg`/`imdg`/`dangerous_goods`/`dg_involved`); strengthened the failing-MPA pipeline assertions; multi-call and list-isolation coverage; extracted the `MPA_CLEARANCE` constant + `_SPECIAL_SERVICES` map; docstring accuracy.
- Deferred: 0.
- Rejected: 4 — no timeout-mode simulation (no mock in the roster has one; `MockService` only has `fail`); denial reason living in `conditions` (reads as an actionable "resubmit corrected manifest" condition); a socket/transport "no live call" proof (the code is self-evidently pure dict arithmetic with no network imports); the epics.md "wired-in" reading (Reading A) — deliberately out of scope, see Residual risks.

### Follow-up review recommendation

`true`. This pass's patch findings: high 0, medium 0, low 11. Score `3 × 0 + 1 × 11 = 11` (≥ 5) → `followup_review_recommended: true`. All findings were low-severity hardening; the recommendation is purely patch-volume.

### Verification performed

- `cd backend && python -m pytest tests/mock_services/test_mpa_clearance.py -q` → **23 passed**, deterministic across repeats.
- `cd backend && python -m pytest -q` → **257 passed** (baseline 249; +8 net; `test_epic1.py` / `test_concurrent_incidents.py` green with the extra `build_registry` key).
- `git diff --stat` since baseline: only `backend/mock_services/services.py` and the new test file — nothing under `backend/orchestrator/`, `backend/models/`, `backend/agents/`, `backend/api/`, `backend/policy/`.

### Residual risks

- **Proof, not enforcement (epics.md AC divergence).** Story 3.4's epics.md ACs are phrased as running-pipeline behaviour ("is called", "affects a recovery option"). No production code calls `mpa_clearance`; the check is invoked only by the proof test's monkeypatch. Wiring an automatic trigger needs a new `RecoveryOption` field (`models/recovery.py` is `extra="forbid"`, frozen) or a branch in `_option_to_action` (`run.py`, frozen Epic 1 golden path) — a human-owned change, same shape as `spec-3-2`'s helper. A `refused` clearance status never changes a pipeline outcome in this delivery.
- **Broadened conditional triggers** (`dg`/`imdg`/`dangerous_goods` beyond the `hazmat` example) are a caller convenience with no caller yet; recorded in the Spec Change Log so a re-derive keeps them.
- **Scope** — this run delivered Story 3.4. Story 3.3 is `blocked` (frozen-contract decision). Story 3.5 remains (handled by the surrounding `/loop`; it adds another new specialist and is expected to hit the same 3-specialist-contract block as 3.3).
