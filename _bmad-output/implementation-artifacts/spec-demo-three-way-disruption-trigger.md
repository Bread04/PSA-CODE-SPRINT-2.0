---
title: 'Demo trigger: Three-Way Disruption live run'
type: 'feature'
created: '2026-08-30'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'ca9a113d6cb228a08136294a9e8711e87483c92e'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The demo relies on `api/demo_seed.py`, which inserts *static* pre-baked incidents. Nothing drives a genuine incident through the pipeline live, so a viewer never sees the stage rail advance, the agent roster fill, or confidence drop in real time. The pitch needs a ~20–30s clip of a real incident progressing, with a DG re-plan and a second concurrent incident.

**Approach:** Add `POST /demo/three-way-disruption` plus a dev-only "Run demo" button in the topbar. The endpoint clears incident state and launches a background async driver that creates a real `Incident` via `IncidentRegistry.correlate()`, then runs the **real** `run_specialists` → `synthesize_options` → `run_policy_and_execution` chain with an injected offline scripted LLM client, pacing phases with `asyncio.sleep` so the 2.5s poll catches each transition. Primary incident ("Three-Way Disruption": berth+crane+yard, specialists disagree, crane call falls back) → DG-involved top option → real DG re-plan loop → non-DG re-planned option that is Tier 3 (high risk, confidence ~65) → held for operator approval. ~6s in, a second incident runs concurrently through the same chain and auto-resolves to VERIFY.

## Boundaries & Constraints

**Always:**
- Strictly additive. New `/demo/*` route only. `backend/agents/*`, `backend/orchestrator/run.py`, `backend/policy/*` keep current logic and signatures byte-for-byte.
- The driver is the **sole writer** (AD-4) of incidents it creates; register them via `api.state.get_registry().correlate(...)` so `GET /incidents` serves them.
- Reuse the real `run_specialists(incident, client=)`, `synthesize_options(incident, bundle, client=)`, `run_policy_and_execution(..., replan=, execute_registry=, fallback_field_count=)`, `approve_incident`, `IncidentRegistry.correlate`.
- Scripted client returns SDK-shaped objects: `.stop_reason == "end_turn"`, `.content` = list of `type="text"` blocks whose `.text` is one JSON object matching `SpecialistRecommendation` / the arbiter schema. Dispatch on `system` prefix (`"You are the Berth/Vessel specialist"` / `"...Crane specialist"` / `"...Yard specialist"` / `"You are the Arbiter"`).
- Offline + deterministic: no network, no `ANTHROPIC_API_KEY`, no randomness/wall-clock branching. Driver takes `step_delay` so tests run at zero delay.
- Emitted `stage` names match `orchestrator/trace.py` `STAGES` / `RAIL_STAGES` producers: `INGEST, CORRELATE, AGENT_CALL×3, SYNTHESIZE, CONFIDENCE, POLICY_START/POLICY_DECISION, DG_CHECK, APPROVAL, EXECUTE, VERIFY`. Each `AGENT_CALL` `detail={agent, mock_forced: False}`; the crane one also `error=error_shape("AGENT_CALL", "telemetry timeout", retried=True, fallback_used=True)` so the roster shows a `fallback` chip and the rail a `FALLBACK` flag.
- After the bundle returns, driver sets `incident.agents = [r.model_dump() for r in bundle.recommendations]` and appends the per-agent `AGENT_CALL` entries (AD-19 recipe, `dispatch.py:107-116`).
- One run at a time: module-level guard; a second `POST` while running → HTTP 409, no reset.
- New CSS: Story 2.1 tokens, zero border-radius, no raw hex, no red/amber/green.
- `cd frontend && npm run verify` and `cd backend && python -m pytest` stay green.

**Ask First:**
- Any signature/logic change to `backend/agents/*`, `backend/orchestrator/run.py`, `backend/policy/*`, or the frozen `SpecialistBundle` / `ArbiterResult` / `AgentName` contracts.
- Adding a runtime dependency.
- Exposing the trigger in a production build rather than dev-only (`import.meta.env.DEV`).
- Persisting demo state / adding a second incident store.

**Never:**
- A real Anthropic call on the demo path.
- Editing existing `demo_seed.py` incident shapes (pinned by `test_demo_seed.py`, spec 3.2).
- A second write path / second source of incident truth.
- Copy or markers implying live AIS / vessel tracking (Epic 4 Responsible-AI).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| TRIGGER_OK | `POST /demo/three-way-disruption`, no run in progress | `reset_state()`; primary incident + `CORRELATE` created synchronously; `asyncio.create_task(driver)`; `200 {"started": true, "primary_incident_id": "<uuid>"}` | N/A |
| TRIGGER_BUSY | `POST` while a driver task is running | `409 {"detail": "a demo run is already in progress"}`; no reset, no second task | guard cleared in driver `finally` |
| PRIMARY_RUN | driver runs incident A to completion (`step_delay=0`) | trace: `INGEST, CORRELATE, AGENT_CALL×3, SYNTHESIZE, CONFIDENCE, POLICY_START, POLICY_DECISION, DG_CHECK×≥2, APPROVAL`; `tier == 3`; `approval_status == "pending"`; `agents` = berth/crane/yard; crane `AGENT_CALL` `error.fallback_used is True`; `confidence < 70` | driver exception caught + logged, guard cleared, partial trace left intact |
| DG_REPLAN | A arbiter top option `dg_involved=True`; `replan` returns a DG option once, then a non-DG `risk="high"` option | one `DG_CHECK` violation per attempt (`error_shape`, `detail.violation True`); final `selected` option `dg_involved is False`; `APPROVAL` detail `dg_forced is True`; recommended = the non-DG option | `MAX_DG_REPLAN_ATTEMPTS` unchanged (2) |
| CONCURRENT_B | second incident starts ~6s after A (0s under test), runs the real chain | distinct `incident_id`; `tier in (1, 2)`; `status == "resolved"`; trace ends `EXECUTE, VERIFY`; aligned specialists → `confidence == 100`; no trace entry references A's id | mirror `_assert_isolated` from `test_concurrent_incidents.py` |
| OPERATOR_APPROVE | after run, `POST /incidents/<A>/approval {"action":"approve"}` | `approve_incident` executes the non-DG option → `EXECUTE` + `VERIFY` appended, `status == "resolved"`, `approval_status == "approved"` | unchanged approval path |
| FE_TRIGGER | user clicks "Run demo" (dev build) | `postDemoTrigger()` POSTs once; button disabled while pending + for a ~30s `running` window; on success `onTriggered(primary_incident_id)` selects it and `refetch()` fires | `ApiError` shown inline; `running` unchanged on failure |
| FE_PROD_BUILD | `import.meta.env.DEV` is false | `DemoTrigger` renders nothing | N/A |

</frozen-after-approval>

## Code Map

- `backend/api/app.py:51-59` — lifespan + `app`; register the route here. `:104-110` `post_kill_switch` = the POST-route pattern.
- `backend/api/state.py` — `get_registry()`, `list_incidents()`, `get_incident()`, `reset_state():39` (rebinds the module global — fetch the registry *after* reset).
- `backend/registry/incident_registry.py:91` `correlate(signal)` — only legal `Incident` creator; appends `CORRELATE` with `detail.payload`.
- `backend/models/signal.py` — `Signal(entity_refs, signal_type, payload, received_at)`; build directly like `test_concurrent_incidents.py:_correlate`.
- `backend/agents/dispatch.py:55` `run_specialists(incident, *, client)`, `:119` `synthesize_options(incident, bundle, *, client)` (both take an injected client). `:107-116` = the AD-19 recipe for `incident.agents` + per-agent `AGENT_CALL` trace.
- `backend/agents/base.py:235-303` `bounded_json_call` (reads `response.stop_reason` + `response.content[].{type,text}`), `:306` `call_specialist`. Specialist `SYSTEM_PROMPT`s start `"You are the {Berth/Vessel|Crane|Yard} specialist"`.
- `backend/agents/arbiter.py:68` arbiter prompt starts `"You are the Arbiter"`. `:105-129` `ArbiterResult` (`disagreement_summary` required when `specialist_disagreement` true). `:159-183` option JSON shape (`description`, `predicted_impact{delay_min,cost,yard_impact,risk}`, `reversible`, `dg_involved`).
- `backend/orchestrator/run.py:239` `run_policy_and_execution(...)`; `:266-292` DG re-plan loop; `:294-321` Tier-3 hold; `:324` `approve_incident`.
- `backend/policy/engine.py:34` `classify_tier` — Tier 3 when `dg_involved or delay>120 or risk=="high" or cost=="high" or confidence<70`. Use `risk="high"` on the re-planned option.
- `backend/policy/confidence.py:60` `compute_confidence` — disagreement −10, each fallback field −15, variance −10. Pass `fallback_field_count=1` → ~65.
- `backend/orchestrator/trace.py:21` `STAGES`, `:42` `error_shape`, `:52` `append_trace`.
- `backend/tests/orchestrator/test_concurrent_incidents.py` — `_assert_isolated` + scripted-client style to mirror.
- `frontend/src/api/client.ts:214-277` `postKillSwitch` — copy for `postDemoTrigger`.
- `frontend/src/hooks/useKillSwitch.ts` — copy for `useDemoTrigger` (in-flight guard, abort on unmount, state unchanged on failure).
- `frontend/src/components/KillSwitchControl/` — component + `.css` + `.test.tsx` pattern for `DemoTrigger/`.
- `frontend/src/App.tsx:244-256` `.topbar__actions` (mount before `<KillSwitchControl>`); `:125-129` `selectedId`/`setSelectedId`; `:120` `refetch`.
- `frontend/src/lib/stageRail.ts`, `frontend/src/lib/agentRoster.ts` — unchanged; consume the emitted trace/`agents`; driver stage names + `AGENT_CALL` `detail.agent` / `error.fallback_used` must match what these read.
- `frontend/src/App.test.tsx` — composed-console test to extend.

## Tasks & Acceptance

**Execution:**
- [x] `backend/api/demo_driver.py` — NEW. `ScriptedLLMClient` (async `messages.create(**kw)` → `SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=json)])`; dispatch on `system` prefix; per-call `await asyncio.sleep(step_delay)`). Scripted berth/crane/yard recs for A (crane vs yard genuinely disagree) and for B (aligned). Export `create_primary_incident() -> Incident` (build A's `Signal` — `entity_refs=["vessel:MSC-ANNA","berth:B3","crane:QC-04","yard:C7-03"]` — emit `INGEST` with a timestamp just before `CORRELATE`, then `get_registry().correlate(signal)`; return the incident) so the endpoint can create it synchronously and return its id. `async def run_three_way_disruption_demo(primary: Incident, *, step_delay: float = 2.0) -> None`: sleep; `run_specialists(primary, client=scripted)`; set `A.agents` + 3 `AGENT_CALL` entries (crane with the `fallback_used` error), spaced by short sleeps; `SYNTHESIZE`; `synthesize_options(A, bundle, client=scripted)` (top option `dg_involved=True`, `specialist_disagreement=True`); sleep; `run_policy_and_execution(A, arbiter_result, replan=<DG once then non-DG risk="high">, fallback_field_count=1, staleness_seconds=0)` → Tier-3 hold. Run B concurrently starting after ~`3*step_delay` (yard/gate incident, aligned specialists, one low-risk/low-cost/reversible/non-DG option) through the same chain → auto-resolves. `asyncio.gather(_run_a(), _run_b_after_delay())`. Outer `try/finally` clears the run guard.
- [x] `backend/api/app.py` — add `POST /demo/three-way-disruption`: guard set → `HTTPException(409)`; else set guard, `reset_state()`, `primary = create_primary_incident()`, `_demo_task = asyncio.create_task(run_three_way_disruption_demo(primary))` (module global, prevents GC), return `{"started": true, "primary_incident_id": primary.incident_id}`. Keep the route thin.
- [x] `backend/tests/api/test_demo_trigger.py` — NEW. Cover every I/O row: `TRIGGER_OK`, `TRIGGER_BUSY` (409), `PRIMARY_RUN`, `DG_REPLAN`, `CONCURRENT_B` (+ `_assert_isolated`-style check), `OPERATOR_APPROVE`. Drive the logic units directly — `create_primary_incident()` then `await run_three_way_disruption_demo(primary, step_delay=0)` — and hit the 409 via a `TestClient` with the guard pre-set. Reset globals (`reset_state`, `reset_kill_switch_for_tests`, `reset_mock_agents`) around each test.
- [x] `frontend/src/api/client.ts` — add `postDemoTrigger(signal?)` → `POST ${API_BASE}/demo/three-way-disruption`, failure discipline of `postKillSwitch`, returns `{ started: boolean; primary_incident_id: string | null }` (tolerate empty 2xx body).
- [x] `frontend/src/hooks/useDemoTrigger.ts` — NEW, modelled on `useKillSwitch`: `{ running, pending, error, trigger, reset }`. `trigger()` no-ops while `pending || running`; on success sets a ~30s `running` window (`setTimeout`, cleared on unmount) and passes `primary_incident_id` to the caller. Abort in-flight POST on unmount; `error` on `ApiError`; `running` unchanged on failure.
- [x] `frontend/src/hooks/useDemoTrigger.test.ts` — NEW. Single POST, re-entrancy no-op, `running` window, `ApiError` surfaced, no state after unmount.
- [x] `frontend/src/components/DemoTrigger/{DemoTrigger.tsx,DemoTrigger.css,index.ts}` — NEW. Renders `null` unless `import.meta.env.DEV`. One `<button type="button">` ("Run demo" → "Demo running…" while `running`), disabled while `pending || running`, inline error text on `error`. Props `{ running, pending, error, onTrigger }`. CSS: Story 2.1 tokens, zero-radius, no hex, no r/a/g.
- [x] `frontend/src/components/DemoTrigger/DemoTrigger.test.tsx` — NEW. Renders under DEV, `onTrigger` on click, disabled states, error text; renders nothing when DEV stubbed false.
- [x] `frontend/src/App.tsx` — `const demo = useDemoTrigger();` mount `<DemoTrigger .../>` in `.topbar__actions` before `<KillSwitchControl>`; on trigger success `setSelectedId(primary_incident_id)` + `refetch()`.
- [x] `frontend/src/App.test.tsx` — extend the composed-console test: "Run demo" button present in the topbar (DEV); a click invokes the mocked client.

**Acceptance Criteria:**
- Given a clean backend, when `POST /demo/three-way-disruption` is called, then it returns `200 {"started": true, ...}`, prior incidents are gone, and within one poll a new incident shows `CORRELATE` done on the stage rail.
- Given a run in progress, when the endpoint is POSTed again, then it returns `409` and no state is reset.
- Given the driver completed, when incident A is inspected, then its trace runs `INGEST → CORRELATE → AGENT_CALL×3 → SYNTHESIZE → CONFIDENCE → POLICY_DECISION → DG_CHECK(violation) → APPROVAL(dg_forced)`, `tier == 3`, `approval_status == "pending"`, `agents` has berth/crane/yard, the crane `AGENT_CALL` carries `error.fallback_used == true`, `confidence < 70`, and the recommended option has `dg_involved == false`.
- Given the driver completed, when incident B is inspected, then it is a distinct incident that reached `VERIFY`, `status == "resolved"`, `tier in (1, 2)`, and no trace entry references incident A's id.
- Given incident A is held, when the operator POSTs `{"action":"approve"}`, then `EXECUTE` and `VERIFY` are appended and `status == "resolved"`.
- Given a dev build, when the console loads, then a "Run demo" button is in the topbar; clicking it starts the run, auto-selects the primary incident, and rail / roster / confidence visibly advance over ~20–30s while a second incident resolves concurrently. Given a production build, the button is absent.
- Given the full suites, `cd backend && python -m pytest` and `cd frontend && npm run verify` both pass.

## Design Notes

Scripted client — dispatch + SDK-shaped response:

```python
class ScriptedLLMClient:
    def __init__(self, script: dict[str, dict], step_delay: float) -> None:
        self._script, self._delay = script, step_delay
    @property
    def messages(self):  # client.messages.create(...)
        return self
    async def create(self, *, system: str, **_) -> SimpleNamespace:
        await asyncio.sleep(self._delay)
        if system.startswith("You are the Arbiter"):  key = "arbiter"
        elif "Berth/Vessel specialist" in system:     key = "berth"
        elif "Crane specialist" in system:            key = "crane"
        else:                                         key = "yard"
        return SimpleNamespace(stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text=json.dumps(self._script[key]))])
```

DG re-plan closure — DG option once, then a non-DG `risk="high"` option, so the loop logs one violation, re-plans, and lands on a held Tier-3 non-DG recommendation (no DG bypass on operator approve):

```python
attempts = {"n": 0}
async def replan() -> ArbiterResult:
    attempts["n"] += 1
    top = DG_OPTION if attempts["n"] < 2 else NON_DG_HIGH_RISK_OPTION
    return ArbiterResult(options=[top], specialist_disagreement=True,
                         disagreement_summary="crane assumes discharge absorbed; yard says C7 at 93% needs a reshuffle")
```

Pacing (`step_delay=2.0`): INGEST/CORRELATE ~t0–2, AGENT_CALL fan-out ~t2–6, SYNTHESIZE ~t6–8, CONFIDENCE/POLICY/DG/APPROVAL ~t8–12; incident B starts ~t6, resolves ~t14–18; incident A sits held for the operator. Unattended ≈ 20s, then the operator approves on camera.

## Verification

**Commands:**
- `cd backend && python -m pytest tests/api/test_demo_trigger.py -q` — expected: new tests pass.
- `cd backend && python -m pytest -q` — expected: full suite green (no regression in `test_demo_seed.py`, `test_concurrent_incidents.py`, `test_api.py`).
- `cd frontend && npm run verify` — expected: lint + build + test green, incl. the CSS token/hex/radius guardrail on `DemoTrigger.css`.

**Manual checks:**
- `python backend/run_api.py` + `cd frontend && npm run dev`; click "Run demo". Watch the rail advance `INGEST → … → APPROVAL` over ~20s; roster fills berth/crane/yard with a `FALLBACK` marker on crane; confidence drops to ~65; a second incident appears and reaches `VERIFY` while the first is held; then Approve the held incident → reaches `VERIFY` / resolved.
- `cd frontend && npm run build && npm run preview` — the "Run demo" button is absent.

## Suggested Review Order

**The scripted live-run driver (start here)**

- Entry point: what the demo run does end to end — two incidents through the real chain, DG re-plan, held Tier 3.
  [`demo_driver.py:409`](../../backend/api/demo_driver.py#L409)
- The offline LLM stand-in — SDK-shaped response, dispatch on the `system` prompt prefix, hard `ValueError` on no match.
  [`demo_driver.py:70`](../../backend/api/demo_driver.py#L70)
- Primary incident: specialists → AD-19 agent bundle + `AGENT_CALL` trace (crane carries the fallback) → arbiter → policy.
  [`demo_driver.py:343`](../../backend/api/demo_driver.py#L343)
- The DG re-plan closure — a DG option once, then a non-DG `risk="high"` result so it holds Tier 3 without a DG bypass on approve.
  [`demo_driver.py:361`](../../backend/api/demo_driver.py#L361)
- Only-legal-creator path: `IncidentRegistry.correlate()` + an `INGEST` entry stamped just before `CORRELATE`.
  [`demo_driver.py:272`](../../backend/api/demo_driver.py#L272)
- One-run-at-a-time guard + fail-safe: broad `except` appends an `ERROR` trace, `finally` always clears the guard.
  [`demo_driver.py:409`](../../backend/api/demo_driver.py#L409)

**The endpoint**

- The only `/demo/*` route: `PORTWATCH_DEMO_TRIGGER` gate → guard → `reset_state()` → sync primary → `create_task`, all inside one `try`.
  [`app.py:117`](../../backend/api/app.py#L117)
- Typed response, matching the sibling routes' convention.
  [`app.py:54`](../../backend/api/app.py#L54)

**Frontend trigger**

- The client call — `postDemoTrigger`, `postKillSwitch` failure discipline, empty-string id coerced to `null`.
  [`client.ts:300`](../../frontend/src/api/client.ts#L300)
- The hook — in-flight + `running`-window re-entrancy guard; `onStarted` fires only after settle, isolated from the error path.
  [`useDemoTrigger.ts:59`](../../frontend/src/hooks/useDemoTrigger.ts#L59)
- The button — renders `null` outside a dev build; `role="alert"` on the error line.
  [`DemoTrigger.tsx:25`](../../frontend/src/components/DemoTrigger/DemoTrigger.tsx#L25)
- Wiring — mounted in the topbar; on success auto-selects the primary incident and refetches.
  [`App.tsx:150`](../../frontend/src/App.tsx#L150)

**Tests**

- Route-level: 404-when-disabled, and `create_task` made load-bearing (drives A to Tier 3 + B to `VERIFY`).
  [`test_demo_trigger.py:100`](../../backend/tests/api/test_demo_trigger.py#L100)
- Driver units: PRIMARY_RUN, DG_REPLAN, CONCURRENT_B isolation, OPERATOR_APPROVE.
  [`test_demo_trigger.py:145`](../../backend/tests/api/test_demo_trigger.py#L145)
