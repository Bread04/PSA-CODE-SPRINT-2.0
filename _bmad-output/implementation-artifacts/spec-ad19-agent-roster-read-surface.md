---
title: 'AD-19 — expose the specialist bundle read-only for the Harbor Signal agent roster'
type: 'feature'
created: '2026-08-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'eac89305f40e963cb388fd9a0fa3a48d50324877'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Harbor Signal agent roster needs each specialist's `summary` / `actions` / `constraints`, but that data is computed by `run_specialists`, passed to the arbiter, and never persisted on `Incident` or returned by the API. Architecture AD-19 closes the gap with a small read-only addition.

**Approach:** Add an `Incident.agents` field carrying the specialist bundle, populate it (and per-specialist `AGENT_CALL` trace entries) on the demo-seeded incidents the console renders, and mark the integration point where a future live pipeline chain would set it. No new endpoint — it rides `GET /incidents/{id}`.

## Boundaries & Constraints

**Always:**
- `Incident.agents` is read-only to the frontend and, in live code, written only by the orchestrator lane (AD-4).
- Entries carry the `SpecialistRecommendation` shape: `agent` (`"berth"|"crane"|"yard"`), `summary`, `actions[]`, `constraints[]`, `rationale` — berth → crane → yard order.
- `demo-tier3-alts` (the Tier 3 golden-path incident) gets a full 3-agent roster **and** one `AGENT_CALL` trace entry per specialist (berth ok, crane timeout→fallback with the existing error shape, yard ok), consistent with its stage rail.
- Field defaults to `[]`; every existing `Incident(...)` construction stays valid without it.

**Ask First:**
- Any change to `backend/agents/base.py`, `backend/agents/dispatch.py`, `backend/agents/arbiter.py`, or `backend/agents/mock_override.py` — the frozen 3-specialist contract. (The chosen approach does not require one; flag if you find you need it.)
- Typing `Incident.agents` as anything other than `list[dict]` (a stronger `list[SpecialistRecommendation]` type pulls `models.incident` into an import cycle with `agents.base` — see Design Notes).

**Never:**
- No new endpoint, no SSE/push, no second incidents-list route.
- Do not touch `SpecialistBundle` (`min_length=3, max_length=3`), `AgentName`, the arbiter `len(...) != 3` guard, or any frozen specialist/arbiter test.
- Do not build a live ingestion→specialists→arbiter→policy pipeline chain here — it does not exist and is out of scope; only leave the integration-point comment.
- Do not change golden-path control flow, tiers, policy, confidence, DG gate, or execution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Field default | `Incident(...)` built without `agents` | `incident.agents == []`; model validates | N/A |
| Demo roster | `GET /incidents/demo-tier3-alts` | `agents` is a 3-element list, order `["berth","crane","yard"]`, each with non-empty `summary` + `rationale` and list `actions`/`constraints` | N/A |
| Demo stage rail | same incident's `trace` | exactly 3 `AGENT_CALL` entries, one per agent; the `crane` one carries the `{stage,error,retried,fallback_used}` shape with `retried=True, fallback_used=True` | N/A |
| Serialization | `GET /incidents` and `GET /incidents/{id}` | response objects include an `agents` key (array) alongside `trace` / `options` | N/A |
| Other demo incidents | resolved / kill-switch-blocked / load-balancing seeds | `agents` present; may be `[]` where no specialist run is depicted — no crash, no partial entries | N/A |

</frozen-after-approval>

## Code Map

- `backend/models/incident.py` — `Incident` (plain `BaseModel`, no `extra="forbid"` — safe to extend). Add `agents: list[dict[str, Any]]` after `blocked_by_kill_switch`, before `trace`. `Any` already imported.
- `backend/agents/base.py:66` — `SpecialistRecommendation` shape (read-only reference; do not edit). `agent/summary/actions/constraints/rationale`.
- `backend/agents/mock_override.py:42` — `CANNED_SPECIALIST` dicts: ready-made structurally-valid roster entries usable verbatim in the demo seed.
- `backend/api/demo_seed.py` — `_tr()` helper (line 38); `demo-tier3-alts` incident (lines ~46–70) currently has ONE `AGENT_CALL` (`{"agent":"crane","note":...}` + error). Expand to 3; add `agents=[...]`. Other `Incident(...)` blocks: add `agents=` where a roster makes sense.
- `backend/agents/dispatch.py:107` — `run_specialists` returns `SpecialistBundle`; end of function is the documented integration point for the future live chain (comment only).
- `backend/tests/api/test_demo_seed.py` — only asserts `demo-load-balancing`; unaffected. `backend/tests/agents/test_specialists.py` — asserts on `bundle`, never `Incident`; unaffected. `backend/tests/api/test_api.py:85` — `"trace" in body[0] and "options" in body[0]`; additive key is fine.

## Tasks & Acceptance

**Execution:**
- [x] `backend/models/incident.py` — add `agents: list[dict[str, Any]] = Field(default_factory=list, description="Specialist bundle exposed read-only for the agent roster (AD-19); [] until AGENT_CALL runs. Entry shape = SpecialistRecommendation.")` between `blocked_by_kill_switch` and `trace`.
- [x] `backend/api/demo_seed.py` — for `demo-tier3-alts`: replace the single `AGENT_CALL` entry with three (berth complete, crane timeout→fallback keeping the current error shape, yard complete) and add `agents=[...]` (3 entries, berth→crane→yard; reuse `CANNED_SPECIALIST` values or write short realistic ones matching the MSC Anna / Crane #4 incident). Add `agents=[...]` or `agents=[]` to the other `Incident(...)` blocks so the field is explicit everywhere in the seed. _Also applied to `demo-approved` (roster + 3 matching `AGENT_CALL` entries) per review._
- [x] `backend/agents/dispatch.py` — add a comment at the end of `run_specialists` (and/or where a live chain would call it): when a live pipeline chains specialists → arbiter → policy, set `incident.agents = [r.model_dump() for r in bundle.recommendations]` and append one `AGENT_CALL` trace entry per recommendation before `run_policy_and_execution` (AD-19).
- [x] `backend/tests/api/test_ad19_agent_roster.py` (new) — unit-test the I/O & Edge-Case Matrix rows: field default, demo roster shape/order, 3 `AGENT_CALL` entries incl. the crane error shape, `agents` key present in `GET /incidents` and `GET /incidents/{id}` responses. _10 tests; strengthened per review (exact key set, roster↔AGENT_CALL coherence across all seeds, trace ordering, model_dump round-trip, instance isolation, nested-field serialization)._
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — appended entry for the deferred live-orchestrator wiring of `incident.agents` + per-recommendation `AGENT_CALL` (review finding).

**Acceptance Criteria:**
- Given the demo seed is enabled, when the console polls `GET /incidents/demo-tier3-alts`, then the response carries a 3-element `agents` array in berth→crane→yard order and 3 `AGENT_CALL` trace entries.
- Given any pre-existing `Incident(...)` construction in code or tests, when it omits `agents`, then it still validates and `agents == []`.
- Given the full backend test suite, when it runs, then every previously-passing test still passes (no frozen contract or demo-seed regression).

## Design Notes

**Why `list[dict]`, not `list[SpecialistRecommendation]`:** `agents/base.py` does `from models.incident import Incident`; typing the field with `SpecialistRecommendation` makes `models/incident.py` import `agents.base` back — a cycle that's import-order-fragile. A stronger type would mean moving `SpecialistRecommendation` into `models/` and re-exporting from the frozen `agents/base.py` — out of scope. The data written in is always `SpecialistRecommendation.model_dump()` (validated upstream) or hand-authored demo entries, so `list[dict]` loses only a redundant re-validation. The architecture spine documents the conceptual shape as `SpecialistRecommendation`.

**Why no orchestrator write here:** `run_specialists` / `synthesize_options` / `run_policy_and_execution` are only ever called from tests — there is no live ingestion-to-execution chain in `backend/` today, and the API serves demo-seeded incidents. So AD-19's "orchestrator sets `incident.agents`" has no live call site; this spec delivers the field + the demo data the console renders + the integration-point comment. Wiring a live chain is separate, future work.

Example roster entry for `demo-tier3-alts` crane agent:
```python
{"agent": "crane", "summary": "Crane #4 hydraulic fault; #7 telemetry on last-known state",
 "actions": ["Isolate Crane #4", "Shift discharge to adjacent crane coverage"],
 "constraints": ["Crane #7 confidence degraded — verify before committing"],
 "rationale": "Fault plus a telemetry timeout during the handoff window."}
```

## Verification

**Commands:**
- `cd backend && uv run pytest -q` — expected: all tests pass, including the new `test_ad19_agent_roster.py`.
- `cd backend && uv run python -c "from api.demo_seed import demo_incidents; i=[x for x in demo_incidents() if x.incident_id=='demo-tier3-alts'][0]; print([a['agent'] for a in i.agents]); print([e.stage for e in i.trace if e.stage=='AGENT_CALL'])"` — expected: `['berth','crane','yard']` and 3 `AGENT_CALL` stages.

## Suggested Review Order

**Schema change (entry point)**

- The whole feature: one read-only list field on `Incident`, typed `list[dict]` to dodge the `models.incident` ↔ `agents.base` import cycle.
  [`incident.py:81`](../../backend/models/incident.py#L81)

**Demo data the console renders**

- `demo-tier3-alts` — the Tier 3 golden-path incident: 3-agent roster (berth/crane/yard) matched 1:1 with `AGENT_CALL` trace entries; crane keeps its timeout→fallback error shape.
  [`demo_seed.py:59`](../../backend/api/demo_seed.py#L59)
- The 3 `AGENT_CALL` entries for that incident, each `detail={agent, mock_forced: False}`, sitting between `CORRELATE` and `CONFIDENCE`.
  [`demo_seed.py:93`](../../backend/api/demo_seed.py#L93)
- `demo-approved` — same roster↔trace pairing on the resolved crane-fault incident (added in review for coherence).
  [`demo_seed.py:151`](../../backend/api/demo_seed.py#L151)
- The other five seeds carry an explicit `agents=[]` and no `AGENT_CALL` — nothing to render, no partial state.
  [`demo_seed.py:113`](../../backend/api/demo_seed.py#L113)

**Future-work marker (no behavior change)**

- Where a live pipeline would set `incident.agents` + emit per-recommendation `AGENT_CALL` — documented for the future caller, not done here (no live chain exists).
  [`dispatch.py:107`](../../backend/agents/dispatch.py#L107)

**Tests**

- Roster↔`AGENT_CALL` coherence across every demo incident, plus exact key-set and trace ordering.
  [`test_ad19_agent_roster.py:131`](../../backend/tests/api/test_ad19_agent_roster.py#L131)
- Field default, `list[dict]` acceptance, `model_dump` round-trip, and per-instance list isolation.
  [`test_ad19_agent_roster.py:45`](../../backend/tests/api/test_ad19_agent_roster.py#L45)
- `agents` serialized on both `GET /incidents` and `GET /incidents/{id}`, nested fields intact over the wire.
  [`test_ad19_agent_roster.py:161`](../../backend/tests/api/test_ad19_agent_roster.py#L161)
