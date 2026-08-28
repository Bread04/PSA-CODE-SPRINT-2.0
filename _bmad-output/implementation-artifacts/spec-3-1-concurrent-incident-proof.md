---
title: 'Concurrent Incident Proof'
type: 'feature'
created: '2026-08-28'
status: 'done'
baseline_revision: 'bbadd700b97a30ce90c3b1724d36ac9ce37d1845'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The system claims each incident is stateless and isolated, but nothing proves two or more incidents can run their full pipelines side-by-side in one session without cross-contamination. This is the central Scalability & Responsible-AI deliverable for Epic 3 and the live demo proof.

**Approach:** Add a deterministic concurrency-proof harness that drives N independent incidents through the existing pipeline (correlate → specialists → arbiter → policy/execution) concurrently, using an `asyncio.Barrier` to force simultaneity without wall-clock reliance, then asserts per-incident isolation. Reuse the existing single-writer/in-memory registry and the generic `MockService.execute` contract — no new pipeline stage, endpoint, or live call.

## Boundaries & Constraints

**Always:** Each incident must own one in-memory `Incident` record with an append-only trace; only its own task writes it. The harness must inject `execute_registry=` into `run_policy_and_execution` so no real or network calls occur. Determinism required: use `asyncio.Barrier` (lifted from `tests/agents/test_specialists.py`) rather than sleeps. Reset global mutable state (`reset_kill_switch_for_tests()`, `reset_mock_agents()`) before the run so isolation is not faked by stale globals.

**Block If:** (none — fully automatable; no human decision required.)

**Never:** Do not add new pipeline stages, HTTP endpoints, tiers, or policy rules. Do not modify production code under `backend/` except via reuse. Do not route the harness through `api/state.py` (process-global single registry) — call `run_policy_and_execution` directly on registry-owned incidents. No live external calls, ever.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| HAPPY_PATH | 3 incidents, distinct entities, all mocks ok | 3 independently resolved incidents, each with correct `tier`/`status` | No error expected |
| MIXED_TIERS | 3 incidents incl. one requiring Tier-3 approval | Each resolves to its own tier; Tier-3 incident flagged, not auto-executed | No cross-incident tier bleed |
| KILLSWITCH_ENGAGED | Global kill switch engaged before run | All incidents honor kill switch; none auto-execute | `reset_kill_switch_for_tests()` restores between runs |
| CONCURRENT_ENTITIES | 2 incidents share an entity ref (`berth:BERTH-7`) but signals arrive >15 min apart (outside `CORRELATION_WINDOW`) and run concurrently | Correlation keys each to its own `Incident`; `_by_entity[BERTH-7]` lists both ids; no merged trace; per-incident isolation holds | If refs overlap *within* 15 min the registry merges by design, so spacing apart is required to prove per-incident separation (bad_spec row corrected: original "overlap within window" was inconsistent with `correlate()`) |

</intent-contract>

## Code Map

- `backend/registry/incident_registry.py` -- `IncidentRegistry.correlate()` (L91) is the ONLY incident creator; `_incidents`/`_by_entity` are the isolation boundary. Harness calls `correlate()` N times.
- `backend/orchestrator/run.py` -- `run_policy_and_execution(incident, *, execute_registry=...)` (L239) mutates only the passed `Incident`; `approve_incident()` (L324) for Tier-3. Harness calls this directly, in `asyncio.gather`, with injected `execute_registry`.
- `backend/agents/dispatch.py` -- `run_specialists()` (L55) uses `asyncio.gather` per incident; safe to reuse.
- `backend/mock_services/services.py` -- `MockService.execute(action)` (L25), `build_registry(failing=...)` (L43), `execute_action()` (L49). Inject `build_registry()` result as `execute_registry`.
- `backend/tests/agents/test_specialists.py` -- L222-232 `asyncio.Barrier(3)` + `FakeAsyncAnthropic` counting `max_in_flight==3`: the exact simultaneity pattern to lift.
- `backend/policy/killswitch.py` -- `is_kill_switch_engaged()` global; `reset_kill_switch_for_tests()` must be called pre-run.
- `backend/agents/mock_override.py` -- `is_mock_forced` global set; `reset_mock_agents()` must be called pre-run.
- `backend/models/incident.py` -- `Incident.incident_id` (UUID4), `TraceEntry` (append-only) — used for isolation assertions.

## Tasks & Acceptance

**Execution:**
- `backend/tests/orchestrator/test_concurrent_incidents.py` -- NEW harness: `reset_kill_switch_for_tests()` + `reset_mock_agents()`; build `execute_registry=build_registry()`; create N incidents via `IncidentRegistry.correlate()` with distinct entity refs; wrap each `run_policy_and_execution(inc, execute_registry=reg)` in a task that awaits a shared `asyncio.Barrier(N)` before calling, so all N start simultaneously; `await asyncio.gather(*tasks)`; assert isolation (below).
- `backend/tests/orchestrator/test_concurrent_incidents.py` -- assert each `Incident.trace` contains only entries whose entity refs belong to that incident (no cross-incident `TraceEntry`); all `incident_id`s distinct; each incident's final `status`/`tier` derived solely from its own inputs; kill-switch scenario honors global state without leaking into non-killswitch runs.

**Acceptance Criteria:**
- Given 3 concurrent incidents with distinct entities, when the harness runs them through `asyncio.gather` with a Barrier, then all 3 resolve with per-incident traces containing zero entries from other incidents and distinct `incident_id`s.
- Given a Tier-3-requiring incident among concurrent ones, when resolved, then its `tier` is Tier-3 and `status` is not auto-executed, while sibling incidents resolve independently.
- Given the kill switch engaged before a concurrent run, when the harness asserts, then no incident auto-executes and a subsequent reset+run shows clean isolation (no global-state bleed).
- `pytest backend/tests/orchestrator/test_concurrent_incidents.py` passes deterministically (no flaky timing).

## Spec Change Log

## Review Triage Log

- **2026-08-28 — review-loop iteration 0 (4 layers: blind-hunter, edge-case-hunter, verification-gap, intent-alignment):**
  - *CONCURRENT_ENTITIES spec row inconsistent (bad_spec):* original row said "entities overlap within 15-min window → no merged trace", but `IncidentRegistry.correlate()` (`incident_registry.py` L141-151) **merges** signals with shared refs inside `CORRELATION_WINDOW` (L44, 15 min) by design. Corrected the row to share a ref but space signals >15 min apart so two separate incidents survive, and the harness asserts `_by_entity[BERTH-7]` lists both ids with no merged trace.
  - *Vacuous isolation assertion (patch):* `_assert_isolated` now checks `entity_refs` containment via `(entry.detail or {})` and that any `incident_id` on a trace entry equals the owning incident's id, not just non-equality.
  - *Missing shared-ref coverage (amended test):* `test_concurrent_entities_stay_isolated` rewritten to use a single shared `IncidentRegistry` with a shared ref spaced >15 min; asserts 2 distinct incident ids and `_by_entity[shared].__len__()==2`.
  - *Barrier hang risk (patch):* concurrent `gather` wrapped in `asyncio.wait_for(timeout=30)` so a mis-counted `Barrier` fails fast instead of hanging forever.
  - *Kill-switch bleed (patch):* `test_concurrent_killswitch_blocks_all_without_bleed` adds a follow-up run after `reset_kill_switch_for_tests()` asserting clean concurrent isolation.
  - *Dead import (patch):* removed unused `from backend.agents.canned_arbiter import canned_arbiter`.
  - *Rejected (noise):* process-global registry reset (each test creates a fresh `IncidentRegistry()`, no accumulation); `staleness_seconds=0` non-determinism (validated: fresh path); duplicate trace-entry guards; missing `len(incidents)==len(arbiters)` guard (type system enforces); missing `execution_results` key guard (contract guarantees).
  - *Result:* all 4 tests pass deterministically (`4 passed in 0.22s`). No production code modified; only the new test file added.

## Verification

**Commands:**
- `cd backend && python -m pytest tests/orchestrator/test_concurrent_incidents.py -q` -- expected: all tests pass, deterministic across repeats.

**Manual checks (if no CLI):**
- Inspect that the harness prints per-incident trace-length and entity-ref sets proving no overlap; confirm `max_in_flight` count equals N via an injected fake-client counter (mirroring `test_specialists.py`).
