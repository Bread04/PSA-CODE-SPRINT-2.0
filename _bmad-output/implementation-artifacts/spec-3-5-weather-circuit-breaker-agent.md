---
title: 'Weather Circuit-Breaker Agent'
type: 'feature'
created: '2026-08-29'
status: 'descoped'
baseline_revision: '7b309b76de0a27b3c90bdb496199d7b4da18254c'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** A mocked meteorological-radar feed for severe convective weather has no analysing agent. Epic 3 / FR18 wants a Weather agent that reuses the specialist pattern (Story 1.3) and proposes safety-first options — anti-typhoon crane-pin locks, AGV reroutes to flood-safe staging, and a natural-language schedule-adjustment notice — with physical-safety options gated to Tier 3.

**Approach (intended):** Add a pure-data specialist module `backend/agents/weather.py` (mocked radar `TOOL_MANIFEST`, disjoint tool names), run it as a conditional specialist for `weather_event` signals, and let its recommendation flow through the existing arbiter → confidence → tier → execution path. Physical-safety options (crane-pin lock, AGV reroute) reach Tier 3 through the **existing** `classify_tier` rules by being emitted `reversible=False` and/or `risk="high"` — no weather-specific tier rule.

## Boundaries & Constraints

**Always:** Reuse the `agents.base` call shape exactly. Physical-safety Tier-3 routing must come from the existing deterministic `classify_tier` (`reversible=False` OR `risk in {"high"}` OR `cost=="high"` OR `dg_involved` OR SLA breach → Tier 3, already regardless of confidence/cost — `backend/policy/engine.py`), not a new predicate. A `weather_event` signal is a recognised type today (`backend/ingestion/normalize.py:_handle_weather_event`).

**Block If:** Same frozen-contract decision as Story 3.3. A Weather specialist is a 4th entry in the specialist roster, and the 3-specialist contract is Day-3-frozen: `SpecialistBundle` pinned `min_length=3, max_length=3` (`backend/agents/base.py:97-99`), `AgentName = Literal["berth","crane","yard"]` (`base.py:60`), the arbiter rejects `len(bundle.recommendations) != 3` (`backend/agents/arbiter.py:217`), and `backend/tests/agents/test_specialists.py::test_bundle_requires_exactly_three_recommendations` locks it. Whether to unfreeze that contract (variable 3-or-N bundle) is a human architecture decision — not "strictly additive" per the Epic 3 stretch rule. See `spec-3-3-agv-gate-specialist-agent.md` for the shared decision.

**Never:** No new pipeline stage, endpoint, policy tier, or **weather-specific tier rule** (AC3: "no weather-specific carve-out in the deterministic layers"). No live meteorological calls. No change to berth/crane/yard modules or the policy engine.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| WEATHER_INCIDENT | incident correlated from a `weather_event` signal (severe convective, ≤30-min window) | `run_specialists` returns a bundle including a `weather` recommendation proposing crane-pin lock / AGV reroute / NL schedule notice; arbiter synthesizes it | `weather` failure → `SpecialistError("weather", …)` |
| PHYSICAL_SAFETY_TIER3 | a synthesized option = crane-pin lock, emitted `reversible=False` (or `risk="high"`) | `classify_tier(option, confidence)` returns `3` for any confidence/cost — via the existing rule, no weather branch | n/a |
| NON_WEATHER_INCIDENT | incident from `vessel_eta` etc. | unchanged 3-entry bundle `[berth, crane, yard]`; `weather` never called | n/a |
| SAME_DETERMINISTIC_LAYERS | a weather-sourced option through confidence + policy + execution | identical formula / tier rules / execution path as any option; no new trace stage | n/a |

</intent-contract>

## Code Map

- `backend/agents/base.py` -- `AgentName` Literal (L60), `SpecialistBundle` 3-pin (L97-99), `_resolve` (L121). **FROZEN (Story 1.3).**
- `backend/agents/dispatch.py` -- `_AGENT_ORDER` 3-tuple (L37); conditional-append seam.
- `backend/agents/arbiter.py` -- `len(bundle.recommendations) != 3` guard (L217). **FROZEN.**
- `backend/policy/engine.py` -- `classify_tier` (L36): `reversible=False` / `risk=="high"` / `cost=="high"` / `dg_involved` / SLA-breach → Tier 3 already, independent of confidence/cost. **The physical-safety Tier-3 requirement needs no code here** — it falls out of this function given the right option properties.
- `backend/ingestion/normalize.py` -- `_handle_weather_event` (L98) + `_HANDLERS["weather_event"]` (L130) already exist.
- `backend/agents/berth.py` -- pure-data pattern to mirror for `weather.py`.
- `backend/tests/agents/test_specialists.py` -- `test_bundle_requires_exactly_three_recommendations` (L497), `len(fake.calls) == 3` assertions. **FROZEN test.**

## Tasks & Acceptance

Blocked before task breakdown — see Auto Run Result.

## Auto Run Result

Status: blocked
Blocking condition: **same frozen-contract architecture decision as Story 3.3.** Story 3.5 (FR18) adds a Weather specialist as a 4th entry in the specialist roster, but the 3-specialist roster is a Day-3-frozen Story 1.3 contract (`SpecialistBundle` pinned to exactly 3 in `backend/agents/base.py:97`, `AgentName` a 3-value `Literal` in `base.py:60`, the arbiter guard `len(bundle.recommendations) != 3` in `backend/agents/arbiter.py:217`, and `backend/tests/agents/test_specialists.py::test_bundle_requires_exactly_three_recommendations`). Even a conditional 4th specialist must edit those frozen model constraints, the arbiter guard, and the frozen test — not "strictly additive" per `epic-3-context.md` ("None introduce new endpoints, tiers, or policy rules"). This is the same decision blocking Story 3.3; resolving one resolves both.

Assessed and **not** blocking:
- The "physical-safety weather options route to Tier 3, regardless of confidence or cost" requirement (AC2) is **not** a new tier rule. The existing deterministic `classify_tier` (`backend/policy/engine.py`) already returns Tier 3 for any option that is `reversible=False`, `risk=="high"`, `cost=="high"`, `dg_involved`, or SLA-breaching — before and independent of the confidence/cost checks. A crane-pin lock / AGV reroute emitted `reversible=False` (or `risk="high"`) lands in Tier 3 with no weather-specific carve-out, satisfying AC2 and AC3 together. This part is implementable additively once the specialist-roster decision is made.
- `weather_event` is already a recognised, handled signal type — no ingestion change needed.

Unresolved questions for a human: identical to `spec-3-3-agv-gate-specialist-agent.md` questions 1–3 (approve unfreezing the specialist-bundle contract to 3-or-N; conditional vs always-on 4th/5th specialist; or accept 3.3 + 3.5 as stretch cuts — 3.5 is ranked last of the Day-5 block).

No production or test code was changed. `backend/` is byte-unchanged at `7b309b7`.

---

## Descope Decision — 2026-08-29

**Resolved via `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-29.md` (Correct Course).**
Path chosen: **cut** — same frozen-contract decision as Story 3.3, and FR18 is the last-ranked Day-5 stretch item. The AC2/AC3 finding stands: physical-safety Tier-3 routing needs no new tier rule (existing `classify_tier` already covers it), so only the specialist-roster half is deferred. Design preserved in `_bmad-output/implementation-artifacts/deferred-work.md`. `backend/` byte-unchanged at `7b309b7`.
