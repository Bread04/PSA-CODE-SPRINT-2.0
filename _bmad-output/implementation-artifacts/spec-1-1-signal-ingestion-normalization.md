---
title: 'Story 1.1: Signal Ingestion & Normalization'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'fe98a9bf52f06c3cede7899ddd38f13a5a10b1dc'
context: ["{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md"]
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No signal-ingestion code exists yet (this is the first backend code in the project). Every downstream Portwatch stage (correlation, specialist agents, policy) needs incoming signals normalized into one common representation with a fixed `entity_refs` id format, or nothing else in the pipeline has a stable input contract to build against.

**Approach:** Implement a `Signal` data model and a `normalize_signal()` function that converts each of the 7 supported raw signal types (vessel ETA, crane alert, yard metric, gate metric, weather event, DG exception, operator request) into the common representation, producing `entity_refs` in the fixed `type:id` format (e.g. `vessel:MSC-ANNA`, `berth:C7-3`). Unrecognized/malformed input is rejected with a logged reason, never a crash or a silent drop.

## Boundaries & Constraints

**Always:** `entity_refs` values use the fixed `type:id` convention so later stories (correlation, mock services) can match on them exactly; normalization is a pure function with no I/O side effects (no DB, no network, no HTTP call in this story); two signals of different raw types referencing the same real-world entity must normalize to an identical `entity_refs` value.

**Ask First:** none — this story is self-contained normalization logic with no external system decisions.

**Never:** no HTTP/API endpoint in this story (an ingestion trigger endpoint, if needed, is a later story's concern); no correlation logic (Story 1.2); no persistence of normalized signals beyond the function's return value.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid signal, any of the 7 types | Raw dict with a recognized signal-type identifier and its required fields | Returns a normalized `Signal` with `entity_refs` in the fixed `type:id` format | N/A |
| Unrecognized or malformed signal | Raw dict with an unknown type, or missing required fields for its type | Signal is rejected, not normalized | Returns a structured rejection result carrying a logged reason; never raises an unhandled exception to the caller |
| Two different-type signals, same entity | e.g. a crane alert and a yard-congestion metric both referencing berth `C7-3` | Both normalize to the identical `entity_refs` value (`["berth:C7-3"]`) | N/A |

</frozen-after-approval>

## Code Map

- `backend/requirements.txt` -- new: first backend dependency file (nothing exists yet); `pydantic`, `pytest`
- `backend/models/__init__.py` -- new: package init
- `backend/models/signal.py` -- new: `Signal` pydantic model (`entity_refs: list[str]`, `signal_type: str`, `payload: dict`, `received_at: str` ISO 8601 UTC)
- `backend/ingestion/__init__.py` -- new: package init
- `backend/ingestion/normalize.py` -- new: `normalize_signal(raw: dict) -> Signal | RejectedSignal`, plus a shared `make_entity_ref(entity_type: str, entity_id: str) -> str` helper (reused later by mock services per the architecture's cross-lane id-format convention)
- `backend/tests/ingestion/test_normalize.py` -- new: unit tests covering the 3 I/O matrix scenarios across all 7 signal types

## Tasks & Acceptance

**Execution:**
- [x] `backend/requirements.txt` -- add `pydantic`, `pytest` -- nothing else in the backend exists to depend on yet
- [x] `backend/models/signal.py` -- define `Signal` and `RejectedSignal` models -- fixed shape every downstream stage relies on
- [x] `backend/ingestion/normalize.py` -- implement `make_entity_ref()` and `normalize_signal()` for all 7 signal types -- core FR1 logic
- [x] `backend/tests/ingestion/test_normalize.py` -- unit-test all 3 I/O matrix scenarios per signal type -- proves normalization and rejection both work before anything else builds on it
- [x] `backend/pytest.ini` -- added beyond the original code map: `pythonpath = .` so `pytest` run from `backend/` resolves `models`/`ingestion` imports, matching the Verification command's `cd backend` step

**Acceptance Criteria:**
- Given `normalize_signal()`, when called with any of the 7 supported signal-type identifiers, then each produces a correctly-typed `Signal` with no field confusion between types.
- Given the test suite, when run, then it passes with no import-time side effects (pure functions only, no network/DB calls).

## Spec Change Log

## Design Notes

`make_entity_ref()` is factored out as its own function now, not inlined into `normalize_signal()`, because Story 3.2/3.3's mock services (Yard Manager, AGV/Gate) must independently produce the exact same `entity_refs` string format per the architecture's cross-lane sync convention — a shared helper prevents the two sides drifting on string formatting later.

## Verification

**Commands:**
- `cd backend && pip install -r requirements.txt && pytest tests/ingestion/ -v` -- expected: all tests pass, zero failures

## Suggested Review Order

**Core normalization logic**

- Entry point: builds the fixed `type:id` convention every downstream stage relies on.
  [`normalize.py:27`](../../backend/ingestion/normalize.py#L27)

- Main dispatch: exception-safe, never raises to the caller regardless of input shape.
  [`normalize.py:136`](../../backend/ingestion/normalize.py#L136)

- Allowlist guard (review patch): rejects unrecognized `entity_type` instead of silently corrupting the convention.
  [`normalize.py:112`](../../backend/ingestion/normalize.py#L112)

- Only optional-field branch in the module; omits the berth ref when absent.
  [`normalize.py:65`](../../backend/ingestion/normalize.py#L65)

**Data model**

- Fixed shape every downstream stage (correlation, agents, policy) is built against.
  [`signal.py:16`](../../backend/models/signal.py#L16)

**Tests**

- Covers the previously-untested optional-`berth_id`-absent branch (review patch).
  [`test_normalize.py:89`](../../backend/tests/ingestion/test_normalize.py#L89)

- Covers the new entity_type allowlist rejection path (review patch).
  [`test_normalize.py:163`](../../backend/tests/ingestion/test_normalize.py#L163)

- Guards the "7 signal types" claim against silent drift (review patch).
  [`test_normalize.py:207`](../../backend/tests/ingestion/test_normalize.py#L207)

- Proves the cross-type correlation invariant the spec's I/O matrix required.
  [`test_normalize.py:172`](../../backend/tests/ingestion/test_normalize.py#L172)
