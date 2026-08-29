# Rubric-Walker Review — 2026-08-30

**File under judgement:** `_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md`
**Altitude:** initiative → features
**Verdict:** PASS WITH CONCERNS

The spine is a strong good-spine on the substance that matters: it names the real divergence points for the build lanes, every AD carries an enforceable Rule tied to a concrete divergence, the Deferred section holds nothing two units could silently diverge on, and the whole-dimension coverage is complete. The concerns are accuracy-drift, not structural: (1) the `## Deferred` "MPA / weather" bullet is stale on both halves post-2026-08-29, and (2) the `## Structural Seed` source tree no longer matches the as-built backend in several places.

---

## Checklist item 1 — Fixes the real divergence points for the level below, misses none

**PASS.**

The spine identifies and pins the points where independently-built lanes (A orchestration, B mock services, C frontend, D integration) would otherwise invent incompatible answers:

- Process boundary — AD-1 (single FastAPI process, four lanes as modules).
- Agent invocation mechanism — AD-2 (direct Messages API, not Agent SDK / Tool Runner / Managed Agents), AD-3 (static per-agent tool manifest at the API-call boundary).
- State ownership & mutation — AD-4 (single-writer orchestrator owns `Incident` + embedded append-only `trace`).
- Correlation — AD-5 (central `IncidentRegistry`, entity key, 15-min window).
- Read path — AD-6 (poll one read-only endpoint, no SSE/WebSocket).
- Kill switch — AD-7 (one flag, one enforcement point), AD-15 (blocked Tier 1/2 marked, not dropped, not reclassified).
- DG gate — AD-8 (fixed pipeline position, re-plan loop capped at 2, third conflict forces Tier 3).
- Approval semantics — AD-11 (`approve` / `reject` / `select_alternative`, never free-form edit).
- Latency / concurrency — AD-13 (`asyncio.gather`, fixed short retry timeout).
- Failure visibility — AD-14 (every transition writes a trace entry, failure is never silent).
- Demo-stability override — AD-16 (`MOCK_AGENTS` per-agent short-circuit + honesty requirement).
- Visibility surfaces — AD-17 (map = bundled read-only projection), AD-18 (orchestra surfaces = zero-backend-change projection of poll + trace), AD-19 (specialist bundle exposed read-only as `Incident.agents`).

The adversarial review (per `.memlog.md`) already drove in the `## Shared data shapes`, `## API seed`, and `## Cross-lane sync conventions` sections — these close the field-name / endpoint-shape divergence that would otherwise bite A↔B↔C. The trace `detail` key names are correctly locked as a Person A → Person C contract.

**Minor gap:** the inbound normalized **Signal** shape is not in `## Shared data shapes`, even though `backend/models/signal.py` (as-built) defines `Signal` (`entity_refs`, `signal_type`, `payload`, `received_at`) and `RejectedSignal`, and FR1 ingestion is an A↔(B/D) boundary. The spine pins the `entity_refs` id *format* in cross-lane sync but not the signal envelope. Low impact — normalization is largely single-lane — but it is the one cross-lane shape the seed omits.

## Checklist item 2 — Every AD's Rule is enforceable and prevents its stated divergence

**PASS.**

Rules are concrete and checkable:

- AD-3 — "only manifest tools are ever passed into that agent's API call" — enforceable at the call site; manifest is the single point of change.
- AD-4 — explicitly states it is enforced by code review + module boundaries, not by the language, and names the accepted tradeoff ("do not pass a mutable `Incident` reference into any non-orchestrator function"). Honest and actionable rather than hand-wavy.
- AD-8 — numeric cap (2 re-plans, third forces Tier 3) makes "cannot spin indefinitely" verifiable.
- AD-16 — the honesty requirement (`mock_forced: true` in the `AGENT_CALL` detail + the same −15pt confidence penalty as a fallback field) is precise enough to test, and it is correctly reconciled against FR6's "confidence is never an LLM self-report."
- AD-19 — "the validated bundle it already passes to the arbiter (the same objects, not recomputed)" plus the explicit list of what stays frozen (`min_length=3, max_length=3`, `AgentName` literal, arbiter `len(...) != 3` guard, frozen tests) makes the additive change bounded and reviewable.

No AD states a divergence it does not actually prevent.

## Checklist item 3 — Nothing under `## Deferred` could let two units diverge

**PASS.**

Every Deferred item is an out-of-scope *capability*, not a shared contract: production infra/HA, approval-bottleneck-at-scale, real PSA integrations, certified DG compliance, persistence/auth beyond the demo, MPA/weather mocks, strait-collision / transshipment MARL. None is something two lanes must agree on to build the golden path. The staleness noted in item 6 is an accuracy problem, not a divergence risk — FR19 is already built consistently and FR18/FR20 are not built at all.

## Checklist item 4 — Named tech is verified-current (note only)

**NOTE — defer to the tech-currency lens.**

All version pins are forward-dated relative to this reviewer's knowledge and cannot be independently confirmed here, but they are internally plausible and the spine already annotates them as verified:

- Python 3.12+ floor, "3.14 is current stable" — plausible for mid/late 2026; the floor rationale (broad-compat for LLM/async libs) is sound, not a stale default.
- FastAPI ~0.141.x "released July 2026" — unverifiable here; sub-1.0 caveat is acknowledged.
- React 19.2.8, TypeScript 5.x, Vite 8.1.3 — plausible mid-2026 versions.
- `claude-sonnet-5` for all agent calls — matches the current model id; the "swap the arbiter alone" note is a reasonable same-day knob.
- Anthropic Python SDK "latest stable", direct Messages API — consistent with AD-2.

## Checklist item 5 — Ratifies rather than contradicts the brownfield codebase

**PASS WITH CONCERNS.** The spine was updated 2026-08-29 *after* the backend froze (Day 3, Epics 3+4 closed), so `## Structural Seed` should mirror as-built. Several places no longer match:

| Spine `## Structural Seed` says | Actual `backend/` (as-built) | Assessment |
|---|---|---|
| `mock_services/` = `tos.py, crane_scheduler.py, yard_manager.py, agv.py, gate.py, notification.py, dg_checker.py` — "every mock exposes one `async def execute(action: dict) -> {ok, result, error}`" | **single `mock_services/services.py`** — `class MockService`, `class MpaClearanceService`, `build_registry(*, failing) -> dict[str, MockService]`, `execute_action(action, registry) -> list[dict]` | **Flag.** Not one-file-per-mock; not the `execute(action)->{ok,result,error}` signature the seed and the inline comment describe (it returns `list[dict]` via a registry). `dg_checker` is not a mock file at all — DG logic lives in `policy/dg_gate.py`. The seed's mock-service section is the biggest as-built mismatch. |
| `policy/` = `policy_engine.py, confidence.py, dg_gate.py` | `policy/engine.py` (`classify_tier`, `sla_breached` — functions, not `policy_engine.py`), `confidence.py`, `dg_gate.py`, **`killswitch.py`** | Naming drift (`policy_engine.py` → `engine.py`); `killswitch.py` (AD-7) not listed in the tree. |
| `agents/` = `berth.py, crane.py, yard.py, arbiter.py + tool manifests` | also **`base.py`** (the frozen `SpecialistBundle` / `AgentName` contract), **`dispatch.py`** (fan-out + tie-break order), **`mock_override.py`** (AD-16 `CANNED_SPECIALIST`), **`yard_load_balancing.py`** (FR17 / AD-12) | `base.py` holds the frozen contract that AD-18, AD-19, and the entire `sprint-change-proposal-2026-08-29` revolve around — its absence from the seed tree is a notable omission. `mock_override.py` and `yard_load_balancing.py` are the concrete homes of AD-16 and AD-12. |
| `api/` = read-only Incident/trace endpoints + approval endpoint | `app.py`, `approval.py`, `query.py` (FR12), `state.py`, **`demo_driver.py`** (the "Three-Way Disruption live-run trigger"), **`demo_seed.py`** | Endpoint *contracts* match the API seed. `demo_driver.py` is an additional demo-only trigger route not reflected anywhere in the seed. `demo_seed.py` is referenced heavily in AD-18/AD-19 prose but not in the tree. |
| `models/` = "Incident, TraceEntry data shapes" | `incident.py` (`Incident`, `TraceEntry`), `recovery.py` (`RecoveryOption`), `signal.py` (`Signal`, `RejectedSignal`) | `recovery.py` / `signal.py` not listed; minor. |

**Ratified correctly:** `Incident.agents` exists as-built (`list[dict[str, Any]]`, shape-compatible with the spine's `list[SpecialistRecommendation]`), the AD-19 commit is in the log, and `Incident` field-for-field matches `## Shared data shapes` (`blocked_by_kill_switch`, `approval_status`, `recommended_option_id`, `entity_refs`, nullable `tier`, etc.). `MpaClearanceService` in `services.py` confirms FR19 shipped. `orchestrator/` = `run.py` / `retry.py` / `trace.py` is consistent with AD-4 / AD-13 / FR5. The core invariants are ratified; it is the *file-layout projection* that has drifted.

## Checklist item 6 — Covers the driving spec's capabilities; Deferred is accurate

**CONCERN — the `## Deferred` "MPA / weather" bullet is stale on both halves.**

Current text (line 331):
> **MPA-style clearance checking, weather/micro-climate events** — same mock-service pattern as DG Checker; structurally cheap to add later, not committed unless Day 5 has spare time after FR17 and the AGV/Gate agent.

Both clauses are now wrong:

1. **"MPA-style clearance checking" (FR19) shipped.** Story 3-4 is done; `sprint-change-proposal-2026-08-29.md` §1 records "3.4 (done) — mocked MPA clearance check … new mock added on the existing `execute(action) -> {ok, result, error}` contract"; and `backend/mock_services/services.py` contains `class MpaClearanceService` with request-ref / status / conditions payloads modelled on digitalPORT@SG. Listing it as Deferred / "not committed" is factually stale. (Note: this is distinct from the "Notification mock already lists MPA" line in AD-18 — that is the FR13 notification *recipient*, not FR19's clearance-check service.)

2. **"weather/micro-climate events" (FR18) and the "AGV/Gate agent" (FR20) were formally descoped, not left uncommitted.** `sprint-change-proposal-2026-08-29.md` (Approved) cuts Stories 3.3 (FR20) and 3.5 (FR18), closes Epic 3, and preserves the conditional-4th-specialist design in `deferred-work.md`. The bullet's framing — "not committed unless Day 5 has spare time after FR17 **and the AGV/Gate agent**" — is pre-descope language that still treats FR20 as a live Day-5 plan.

**Recommended fix:** split the bullet — move FR19 out of Deferred (acknowledge it as shipped, ideally with a Capability→Architecture Map row for `mock_services/services.py:MpaClearanceService`), and recharacterize FR18/FR20 as "formally descoped 2026-08-29 via `sprint-change-proposal-2026-08-29.md`; conditional-4th-specialist design preserved in `deferred-work.md`" rather than "not committed unless Day 5 has spare time."

**Not a defect:** `binds: [FR1..FR17]` legitimately never included FR18/FR19/FR20 (all Day-5 stretch, added after the spine's bind set), and `.memlog.md` (2026-08-29) reasoned that the *frozen 3-specialist contract* needs no spine change. That reasoning is sound for the invariants — but the Deferred *prose* was left carrying the pre-descope wording, and that is the miss.

FR1–FR17 coverage itself is complete and correctly mapped in `## Capability → Architecture Map` (groups A–I), including FR17 as an explicit stretch row.

## Checklist item 7 — Every dimension the initiative altitude owns is decided, deferred, or an open question

**PASS.**

- **Deployment / environments** — decided: `## Deployment & environments` (local dev machines; single localhost/demo-box instance; no multi-env). Production strategy explicitly Deferred.
- **Infrastructure** — decided: AD-1 (single process, no queues/containers/mesh); AD-9 (in-memory, no DB). Production infra Deferred.
- **Operations** — addressed: kill switch (AD-7/AD-15), degrade-not-crash (AD-14, NFR3), and "the trace list *is* the log — no separate log store for incident-level events" in Consistency Conventions. Proportionate to a 6-day demo; no ops dimension left silent.
- **Data model** — decided: `## Shared data shapes` (Incident, SpecialistRecommendation, RecoveryOption, TraceEntry) + `## API seed`. One gap (inbound Signal shape — see item 1), minor.
- **Security** — decided: Design Paradigm ("LLM proposes, deterministic engine disposes"), AD-3 (least-privilege tool scoping), AD-7/AD-15 (kill switch), AD-10 (no auth — explicit, with rationale). Matches PRD §5.

No whole dimension is silent.

---

## Summary of required / recommended changes

| # | Severity | Finding |
|---|---|---|
| 1 | High | `## Deferred` "MPA-style clearance checking, weather/micro-climate events" bullet is stale: FR19 shipped (story 3-4, `MpaClearanceService`); FR18 + FR20 were formally descoped 2026-08-29 via `sprint-change-proposal-2026-08-29.md`, not "not committed". Split and rewrite; ideally add an FR19 row to the Capability map. |
| 2 | Medium | `## Structural Seed` source tree diverges from as-built `backend/`: `mock_services/` is a single `services.py` (class-based registry, `execute_action(...) -> list[dict]`), not 7 files with `execute(action)->{ok,result,error}`; `policy/policy_engine.py` is actually `policy/engine.py`; `agents/` omits `base.py` (frozen contract), `dispatch.py`, `mock_override.py` (AD-16), `yard_load_balancing.py` (AD-12/FR17); `policy/killswitch.py` and `api/demo_driver.py` + `api/demo_seed.py` are unlisted. |
| 3 | Low | Inbound normalized **Signal** shape (`backend/models/signal.py`: `Signal` / `RejectedSignal`) is absent from `## Shared data shapes` despite being an ingestion cross-lane concern. |
| 4 | Low | `api/demo_driver.py` ("Three-Way Disruption live-run trigger") is an additional demo-only route with no mention in the API seed or AD set; note it so it is not mistaken for a second write path. |
| 5 | Note | All stack versions are forward-dated and unverifiable from here; internally plausible. Defer to the tech-currency lens. |

The invariants and their enforcement are sound; nothing here blocks the build. The fixes are documentation-accuracy updates to keep the spine honest against the frozen-and-shipped codebase.
