---
title: 'Story 1.2: Incident Correlation via 15-Minute Window'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_revision: '5bb508ce736a6ae3fd77f8fef03ea627552d8a06'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
warnings: []
deferred:
  - summary: >-
      correlate() takes no lock; two concurrent callers can both pass _find_match and
      both create an incident for the same entity/window, defeating the single-incident guarantee.
    evidence: |-
      Blind Hunter review. The registry mutates self._incidents / self._by_entity with no
      synchronization. AD-4's actor-per-incident model is assumed but the dispatch concurrency
      model is not established until Story 1.3's orchestrator, so the right lock scope is unknown now.
    location: >-
      backend/registry/incident_registry.py (correlate / _find_match / _create_incident)
    severity: medium
  - summary: >-
      No registry eviction or lifecycle: resolved incidents are never removed, _incidents and
      _by_entity grow unbounded, and _find_match re-scans resolved ids on every call.
    evidence: |-
      Blind Hunter review. Story 1.2 never resolves incidents and no story in this epic defines
      an eviction policy; a long-running process leaks memory and degrades over time.
    location: >-
      backend/registry/incident_registry.py
    severity: low
  - summary: >-
      Malformed or missing Signal.received_at raises a raw ValueError/AttributeError out of
      correlate() with no defined error-surfacing contract.
    evidence: |-
      Edge Case Hunter + Blind Hunter. normalize_signal() always emits a valid aware ISO string,
      so this cannot arise from the real pipeline today, but the registry has no rejection channel;
      the contract for how registry errors surface belongs with the orchestrator that wraps it.
    location: >-
      backend/registry/incident_registry.py:_parse_iso
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1.1 normalizes each raw signal into a `Signal` with fixed-format `entity_refs`, but nothing groups those signals: one real-world disruption (a delayed vessel cascading into berth, crane, and yard effects) currently has no way to become one incident instead of a scatter of unrelated ones. Every downstream stage (specialist agents, arbiter, policy) operates per-incident and has nothing to attach to until correlation exists.

**Approach:** Add an `Incident` record and an in-memory `IncidentRegistry` (AD-5) that, given a normalized `Signal`, either returns the open incident it correlates into or creates a new one. Correlation matches on shared `entity_refs` within a 15-minute rolling window measured from the incident's most recent signal; a signal that could match two open incidents resolves to exactly one via a documented deterministic tie-break, never fanning out.

## Boundaries & Constraints

**Always:** correlation is a pure in-memory decision with no I/O, network, or DB; the registry is the only writer of the `Incident` objects it owns; the 15-minute window is measured from the incident's last correlated signal time (`last_signal_at`), not its creation time; a signal correlates into at most one incident (single-writer, actor-per-incident paradigm — AD-4); the deterministic tie-break rule is expressed in code with an explaining comment, never left implicit; `incident_id` is a UUID4 string; trace `stage` values are SCREAMING_SNAKE and timestamps are ISO 8601 UTC.

**Block If:** the epic's `Incident` / `TraceEntry` field shapes (epic-1-context.md) turn out to conflict with a shape another already-built story wrote — surface the contradiction rather than picking one.

**Never:** no orchestrator async-task machinery, no specialist/agent dispatch, no incident resolution or status transitions beyond creating incidents as `open` (Story 1.3+); no HTTP endpoint; no persistence beyond the registry's in-memory dicts; no re-normalization of `entity_refs` (canonical-form guarantees are Story 1.1's; see Design Notes re: deferred-work item).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Correlate into open incident | `Signal` whose `entity_refs` intersects an `open` incident whose `last_signal_at` is within 15 min of the signal's time | Returns that incident with `created=False`; signal's new `entity_refs` are unioned into `incident.entity_refs`; `last_signal_at` advances to the later of the two times | No error expected |
| No match → new incident | `Signal` whose `entity_refs` intersects no open incident | Returns a new `open` incident with `created=True`, a fresh UUID4 `incident_id`, `entity_refs` = signal's refs, `created_at == last_signal_at == signal time` | No error expected |
| Match only outside window | `Signal` intersects an open incident but its `last_signal_at` is >15 min before the signal's time | Treated as no match: new incident, `created=True`; the stale incident is left unmodified | No error expected |
| Ambiguous multi-incident match | `Signal` (e.g. vessel_eta with `["vessel:V1","berth:B1"]`) where `vessel:V1` belongs to incident A and `berth:B1` to a separate incident B, both open and in-window | Routes to the incident matching the signal's **primary** entity ref (`entity_refs[0]`, the entity the signal type was ingested against); if the primary ref still matches multiple, pick the earliest `created_at` then lowest `incident_id`. Incident B is untouched. `created=False` | No error expected |
| Stale incident reactivated by later signal | Incident with `last_signal_at` 16+ min before a new signal on the same entity | New incident, `created=True`; stale incident unchanged | No error expected |

</intent-contract>

## Code Map

- `backend/models/signal.py` -- existing (Story 1.1): `Signal` (`entity_refs: list[str]`, `signal_type`, `payload`, `received_at` ISO 8601 UTC). Correlation reads `entity_refs` and `received_at`; `entity_refs[0]` is the signal type's own entity (handlers in `normalize.py` always list it first).
- `backend/ingestion/normalize.py` -- existing (Story 1.1): per-type handlers build `entity_refs` primary-first (`_handle_vessel_eta` → `vessel:` then optional `berth:`, etc.). No change; referenced for the "primary ref" contract.
- `backend/models/incident.py` -- new: `Incident` and `TraceEntry` pydantic models. `Incident` carries the full epic-1-context shared shape (`incident_id`, `status`, `entity_refs`, `tier`, `confidence`, `recommended_option_id`, `options`, `approval_status`, `blocked_by_kill_switch`, `trace`) plus correlation bookkeeping `created_at` and `last_signal_at`. Fields not yet produced default to null/empty/`100` (confidence) — later stories populate them.
- `backend/models/__init__.py` -- existing empty package init; no change required.
- `backend/registry/__init__.py` -- new: package init.
- `backend/registry/incident_registry.py` -- new: `CORRELATION_WINDOW = timedelta(minutes=15)`, `CorrelationResult` (`incident: Incident`, `created: bool`), `IncidentRegistry` with `_incidents: dict[str, Incident]` and `_by_entity: dict[str, list[str]]` (entity ref → incident ids, insertion order) and `correlate(signal: Signal) -> CorrelationResult`.
- `backend/tests/registry/test_incident_registry.py` -- new: covers all 5 I/O matrix rows plus tie-break determinism under dict-order permutation and the CORRELATE trace entry.
- `backend/pytest.ini` -- existing (`pythonpath = .`); no change.

## Tasks & Acceptance

**Execution:**
- `backend/models/incident.py` -- define `TraceEntry` (`stage: str`, `timestamp: str`, `detail: dict = {}`, `error: dict | None = None`) and `Incident` per the shared shape + `created_at` / `last_signal_at` -- fixed record every downstream stage attaches to.
- `backend/registry/__init__.py` -- new empty package init -- makes `registry` importable under `pythonpath = .`.
- `backend/registry/incident_registry.py` -- implement `IncidentRegistry.correlate()`: parse `signal.received_at`; find a match (primary ref first, then remaining refs in order; candidate = `open` incident with `signal_time - last_signal_at <= CORRELATION_WINDOW`; tie-break earliest `created_at` then lowest `incident_id`); on no match spawn a new `open` incident with a UUID4 id; on match union new `entity_refs` and advance `last_signal_at = max(current, signal_time)`; append one `CORRELATE` `TraceEntry` (`detail={"signal_type", "matched": not created, "entity_refs", "incident_id"}`) either way; keep `_by_entity` in sync -- core FR2 / AD-5 logic.
- `backend/tests/registry/test_incident_registry.py` -- unit-test every I/O matrix row, tie-break determinism (build the two candidate incidents, permute registry insertion order, assert same choice), `last_signal_at` advancement extending the window, and that a `CORRELATE` trace entry is appended on both the new and matched paths -- proves the correlation contract before Story 1.3 builds on it.

**Acceptance Criteria:**
- Given a signal correlates into an existing incident, when `correlate()` returns, then no second incident exists for that entity and the returned incident's `trace` ends with a `CORRELATE` entry whose `detail.matched is True`.
- Given two signals on the same entity 20 minutes apart, when both are correlated, then two distinct `incident_id`s are returned (`created=True` both times).
- Given the full existing test suite, when run, then it still passes (no regression to Story 1.1) with no import-time side effects.

## Spec Change Log

## Review Triage Log

### 2026-08-27 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10: (high 0, medium 2, low 8)
- defer: 3: (high 0, medium 1, low 2)
- reject: 5
- addressed_findings:
  - `[medium]` `[patch]` No public accessor on `IncidentRegistry` — added `get(incident_id)` and `open_incidents()`; tests no longer reach into private dicts for lookups.
  - `[medium]` `[patch]` Straggler window had no lower bound (a signal hours older than `last_signal_at` correlated) — changed to symmetric `abs(delta) <= 15 min`; added a far-past test; Design Notes updated.
  - `[low]` `[patch]` Empty `signal.entity_refs` produced an unindexed orphan incident — `correlate()` now fails fast with `ValueError`; test added.
  - `[low]` `[patch]` Enum/range fields were plain `str`/`int` — `status`, `approval_status`, `tier`, `confidence` now use `Literal`/bounded `Field`.
  - `[low]` `[patch]` Bare `list` / `dict` on `options` and `TraceEntry.detail` — typed as `list[Any]` / `dict[str, Any]`.
  - `[low]` `[patch]` CORRELATE trace `timestamp` used wall-clock — now uses `signal.received_at` for deterministic, replayable traces.
  - `[low]` `[patch]` `_parse_iso` `Z`-suffix and naive-timestamp branches were dead-untested — added coverage.
  - `[low]` `[patch]` `_create_incident` did not de-duplicate repeated refs (unlike `_merge_signal`) — now dedupes; test added.
  - `[low]` `[patch]` Unused `signal_time` parameter on `_create_incident` — removed.
  - `[low]` `[patch]` `status == "open"` guard in `_find_match` was untested — added a test that pre-registers a `resolved` incident.

## Design Notes

**Primary entity ref = `entity_refs[0]`.** Story 1.1's handlers always place the signal type's own entity first (`_handle_vessel_eta` → `vessel:` before optional `berth:`; berth-correlated types emit a single `berth:` ref). AC row 4 ("routes to the incident matching the entity type it was ingested against") is therefore implemented as "try `entity_refs[0]` before any other ref." This keeps the rule deterministic and located in one place rather than reinvented per call.

**Window is relative to `last_signal_at`, evaluated as a symmetric bound `abs(signal_time - last_signal_at) <= 15 min`.** An out-of-order straggler within 15 minutes still correlates; `last_signal_at` only ever moves forward (`max`). The bound is symmetric so a signal *far* in the past (hours older than the incident's last activity) does not correlate into a recent incident — only genuine near-in-time skew is tolerated. A gap of more than 15 minutes in either direction spawns a new incident (AC rows 3 and 5).

**No `entity_refs` re-normalization here.** `deferred-work.md` notes Story 1.1 does not case/whitespace-normalize entity ids; correlation matches on exact string equality by design and assumes canonical refs from `make_entity_ref()`. Hardening the id format is a Story 1.1 concern and is intentionally left out of scope to avoid two divergent normalization points.

## Verification

**Commands:**
- `cd backend && uv run --with pydantic --with pytest --python 3.12 pytest tests/registry/ -v` -- expected: all new correlation tests pass, zero failures.
- `cd backend && uv run --with pydantic --with pytest --python 3.12 pytest -q` -- expected: full suite green (Story 1.1's 31 tests + new ones), proving no regression.

## Auto Run Result

Status: done

**Implemented change.** Added the `Incident` / `TraceEntry` records and an in-memory `IncidentRegistry` that correlates each normalized `Signal` into an existing open incident or spawns a new one. Matching is on shared `entity_refs` (exact string equality) within a symmetric 15-minute window measured from `last_signal_at`; a signal that could match two open incidents routes to the one carrying its primary ref (`entity_refs[0]`), with an `(created_at, incident_id)` tie-break, and never fans out. A single `CORRELATE` trace entry (stamped with the signal's own time) is appended on both the created and matched paths.

**Files changed.**
- `backend/models/incident.py` — new: `TraceEntry` and `Incident` pydantic models (full epic-1 shared shape + `created_at` / `last_signal_at`; `Literal`/bounded types on `status`, `approval_status`, `tier`, `confidence`).
- `backend/registry/__init__.py` — new: package init.
- `backend/registry/incident_registry.py` — new: `CORRELATION_WINDOW`, `CorrelationResult`, `IncidentRegistry` with `correlate()`, `get()`, `open_incidents()`, and private `_find_match` / `_create_incident` / `_merge_signal` / `_parse_iso` helpers.
- `backend/tests/registry/test_incident_registry.py` — new: 22 tests covering all 5 I/O-matrix rows, symmetric-window boundaries, tie-break determinism, ref de-dup, empty-refs guard, resolved-incident guard, `_parse_iso` tolerance, and the CORRELATE trace entry.

**Review findings breakdown.** 10 patches applied (0 high / 2 medium / 8 low) — see Review Triage Log. 3 items deferred (concurrency/locking in `correlate()`, no registry eviction, malformed-`received_at` error contract) — see frontmatter `deferred`. 5 items rejected as noise (speculative new-required-field breakage, `.get` defensiveness, missing `tests/registry/__init__.py` which matches the existing `tests/ingestion/` layout, unasserted import-purity AC already covered by the full-suite run, no logging which Story 1.12 owns).

**Follow-up review recommendation:** `true`. Patched findings this pass: 0 high, 2 medium, 8 low → score `3×2 + 1×8 = 14` ≥ 5.

**Verification performed.**
- `pytest tests/registry/ -q` → `22 passed`.
- `pytest -q` (full suite) → `53 passed` (31 Story 1.1 + 22 new), no regression, no import-time side effects.
Re-run independently after the patch pass with identical results.

**Residual risks.** `correlate()` is not concurrency-safe (deferred — depends on Story 1.3's orchestrator dispatch model). The registry never evicts resolved incidents (deferred). Correlation trusts `Signal.received_at` to be well-formed ISO (deferred — true today because `normalize_signal()` guarantees it).
