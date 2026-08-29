---
title: 'AGV/Gate Specialist Agent'
type: 'feature'
created: '2026-08-29'
status: 'descoped'
baseline_revision: '2a269d4c505b8a724e7cd5268e564aa665dc5e81'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Gate-queue and AGV-congestion signals (`gate_metric`) are ingested and correlated but no specialist analyses them — only berth, crane, and yard do. Epic 3 / FR20 wants an AGV/Gate specialist that reuses the established specialist pattern so gate/AGV congestion is handled by the same trusted pipeline.

**Approach (intended):** Add a pure-data specialist module `backend/agents/agv_gate.py` (`NAME` / `SYSTEM_PROMPT` / `TOOL_MANIFEST`, tool names disjoint from the other three), run it as a **conditional 4th specialist** only when an incident's correlated signals include `gate_metric`, and let its recommendation flow through the existing arbiter → confidence → tier → execution path with no new pipeline stage, tier, endpoint, or mock service.

## Boundaries & Constraints

**Always:** Reuse the `agents.base` call shape exactly (one bounded `claude-sonnet-5` Messages API call, `tool_choice="none"`). `agv_gate` runs only for incidents whose `trace` carries a `CORRELATE` entry with `detail.signal_type == "gate_metric"`; a `vessel_eta` / `crane_alert` / `yard_metric` / etc. incident is byte-for-byte unchanged (still exactly berth/crane/yard). Reuse the existing `agv_manager` / `gate_manager` mock names — no new mock-service contract. The AGV/Gate recovery option passes through Stories 1.6/1.7/1.8/1.11 with no agent-specific carve-out.

**Block If:** Extending the specialist roster past three requires changing the **Day-3-frozen Story 1.3 contract** — `SpecialistBundle` is pinned `min_length=3, max_length=3` (`backend/agents/base.py:97-99`), `AgentName` is `Literal["berth","crane","yard"]` (`base.py:60`), the arbiter hard-guards `len(bundle.recommendations) != 3` (`backend/agents/arbiter.py:217`), and `backend/tests/agents/test_specialists.py::test_bundle_requires_exactly_three_recommendations` (and several `len(fake.calls) == 3` assertions) explicitly lock "exactly three". Epic 3's own context says the 3.2–3.5 stretch items are *"strictly additive after the Day-3 golden-path freeze … none introduce new endpoints, tiers, or policy rules"*. Whether to **unfreeze the specialist-bundle contract** (allow a variable 3-or-4 bundle, relax the arbiter guard, edit the frozen `test_specialists.py` expectations) is an architecture decision a human must make — it is not "strictly additive" and cannot be taken unattended.

**Never:** No new pipeline stage, HTTP endpoint, policy tier, tier rule, or `MockService`. No change to the berth/crane/yard modules. No always-on 4th specialist (that would add an LLM call to every incident and change the NFR1 latency budget for the frozen golden path).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| GATE_INCIDENT | incident correlated from a `gate_metric` signal | `run_specialists` returns a 4-entry bundle `[berth, crane, yard, agv_gate]`; arbiter synthesizes it; option flows to tier + execution with no new trace stage | `agv_gate` failure surfaces as `SpecialistError("agv_gate", …)` like any specialist |
| NON_GATE_INCIDENT | incident correlated from `vessel_eta` (or any non-`gate_metric`) | `run_specialists` returns the unchanged 3-entry bundle `[berth, crane, yard]`; `agv_gate` is never called | n/a |
| TOOL_DISJOINTNESS | `agv_gate.TOOL_MANIFEST` vs berth/crane/yard | AGV/Gate tool names are pairwise disjoint from all three | n/a |
| MOCK_FORCED | `agv_gate` pinned via `mock_override` | canned, schema-valid `SpecialistRecommendation` returned without an API call | n/a |

</intent-contract>

## Code Map

- `backend/agents/base.py` -- `AgentName` Literal (L60), `SpecialistBundle` `min_length=3, max_length=3` (L97-99), `_resolve()` imports only `berth, crane, yard` (L121). Any 4th specialist touches all three. **FROZEN (Story 1.3).**
- `backend/agents/dispatch.py` -- `_AGENT_ORDER: tuple[AgentName, AgentName, AgentName] = ("berth","crane","yard")` (L37); `run_specialists` gathers that fixed tuple (L77-78) and `zip`s it for failure ordering (L86). The conditional-append seam would live here, reading `incident.trace` CORRELATE `signal_type`.
- `backend/agents/arbiter.py` -- guard `len(bundle.recommendations) != 3` (L217). **FROZEN.**
- `backend/agents/mock_override.py` -- `CANNED_SPECIALIST` has only `berth`/`crane`/`yard` keys (L42-64).
- `backend/tests/agents/test_specialists.py` -- `test_bundle_requires_exactly_three_recommendations` (L497) and `len(fake.calls) == 3` (L170, L469, …) lock the 3-count. **FROZEN test.**
- `backend/ingestion/normalize.py` -- `_handle_gate_metric` (L91) already maps `gate_metric` → `gate:<id>` refs; `_HANDLERS["gate_metric"]` registered (L129). The signal type exists today.
- `backend/mock_services/services.py` -- `SERVICE_NAMES` already includes `agv_manager`, `gate_manager` — no new mock needed.
- `backend/agents/berth.py` -- the exact pure-data pattern to mirror for `agv_gate.py`.

## Tasks & Acceptance

Blocked before task breakdown — see Auto Run Result. The intended shape is recorded under Approach and the I/O matrix above so a human can confirm the reading and either (a) approve unfreezing the specialist-bundle contract to a variable 3-or-4 shape, or (b) redirect Story 3.3 to a design that does not extend the roster, or (c) accept it as a stretch cut.

## Auto Run Result

Status: blocked
Blocking condition: **frozen-contract architecture decision required.** Epic 3 Story 3.3 (FR20) adds a 4th specialist ("AGV/Gate") "through the same pipeline unchanged", but the 3-specialist roster is a Day-3-frozen Story 1.3 contract: `SpecialistBundle` is pinned to exactly 3 (`backend/agents/base.py:97`), `AgentName` is a 3-value `Literal` (`base.py:60`), the arbiter rejects any bundle whose length `!= 3` (`backend/agents/arbiter.py:217`), and `backend/tests/agents/test_specialists.py::test_bundle_requires_exactly_three_recommendations` plus multiple `len(fake.calls) == 3` assertions explicitly lock it. Every reading of Story 3.3 — even the most conservative (a *conditional* 4th specialist that runs only for `gate_metric` incidents) — must edit those frozen model constraints, the arbiter guard, and the frozen test expectations. Epic 3's own context states the 3.2–3.5 stretch items are "strictly additive after the Day-3 golden-path freeze … none introduce new endpoints, tiers, or policy rules"; unfreezing the specialist-bundle contract is not strictly additive and is a decision a human owns.

Unresolved questions for a human:
1. Approve changing `SpecialistBundle` / `AgentName` / the arbiter guard / the frozen `test_specialists.py` expectations from "exactly 3" to "3 or 4"? (Required for any implementation of FR20.)
2. Conditional 4th specialist (runs only when a correlated signal is `gate_metric`) — confirmed as the intended scope? Or an always-on 4th specialist for every incident (which also shifts the NFR1 latency budget of the frozen golden path)?
3. If neither is acceptable before the demo, is Story 3.3 a stretch cut (it is ranked 3rd of the Day-5 block, "cut from the bottom if time runs short")?

No production or test code was changed. `backend/` is byte-unchanged at `2a269d4`.

---

## Descope Decision — 2026-08-29

**Resolved via `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-29.md` (Correct Course).**
Path chosen: **cut**. Unresolved question 1 (unfreeze the `SpecialistBundle`/`AgentName`/arbiter-guard/frozen-test "exactly 3" contract) was answered **no** — not for the #3-ranked Day-5 stretch item, with the golden path frozen and the demo imminent. Question 3 (stretch cut) answered **yes**.

The intended conditional-4th-specialist design (Approach + I/O matrix above) is preserved verbatim in `_bmad-output/implementation-artifacts/deferred-work.md` as post-sprint work. `backend/` remains byte-unchanged at `2a269d4`.
