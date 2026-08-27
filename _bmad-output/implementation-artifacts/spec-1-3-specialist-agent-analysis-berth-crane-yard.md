---
title: 'Story 1.3: Specialist Agent Analysis (Berth/Crane/Yard)'
type: 'feature'
created: '2026-08-27'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: true
baseline_revision: 'b5a5e51ade0421388c55b17837dcfaffbab38095'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
warnings: []
deferred:
  - summary: >-
      No timeout on the specialist `messages.create` call; a hung request blocks
      run_specialists() indefinitely and silently blows the ~20-30s NFR1 budget.
    evidence: |-
      Blind/Edge Case Hunter. Retry, timeout tuning, and fallback-to-last-known-state
      are explicitly Story 1.5's contract (AD-13 second half); adding a timeout here
      would pre-empt how 1.5 defines the retry/degrade envelope.
    location: >-
      backend/agents/base.py (call_specialist -> client.messages.create)
    severity: medium
  - summary: >-
      Specialist calls write no AGENT_CALL entry to incident.trace and emit no logs;
      there is no record the three calls happened, their latency, or their outcome.
    evidence: |-
      Blind Hunter. Story 1.12 (Execution Trace Recording) is the cross-cutting story
      that owns writing trace entries for every stage including AGENT_CALL; Story 1.3's
      ACs do not mention trace output.
    location: >-
      backend/agents/base.py / dispatch.py
    severity: low
  - summary: >-
      The six invented specialist tool schemas (param names, entity vs free-text keys)
      are not reconciled against the mock-service contract; the Yard tools key off
      'Tuas C7' / 'Pasir Panjang P2' while Berth/Crane key off 'type:id' entity refs.
    evidence: |-
      Blind Hunter. epic-1-context pins only the mock-service execute() signature, not
      concrete tool schemas, so the spec's "Block If" is not triggered; but Story 1.11
      (mock services) must reconcile all six schemas with real executors and a single
      id convention at that point.
    location: >-
      backend/agents/berth.py, crane.py, yard.py (TOOL_MANIFEST)
    severity: low
  - summary: >-
      _incident_summary() puts no bound on the number of CORRELATE trace entries or the
      size of each payload it renders into the model brief.
    evidence: |-
      Blind Hunter. A large incident could overflow the input budget with no truncation.
      Demo incidents are small; a cap is a refinement once real incident volume is known.
    location: >-
      backend/agents/base.py (_incident_summary)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 1.2 produces an `Incident` but nothing analyzes it. The golden path needs three independent expert angles — Berth/Vessel, Crane, Yard — each a bounded LLM call with tools scoped to its own domain, so one disruption gets three structured recommendations the arbiter (Story 1.4) can rank, without any agent reaching outside its role.

**Approach:** Add a `backend/agents/` package: one module per specialist (`berth`, `crane`, `yard`) holding a static system prompt and a static tool manifest, plus a shared `SpecialistRecommendation` output model and a `call_specialist()` helper that makes one direct Anthropic Messages API call (`claude-sonnet-5`, AD-2) with only that agent's manifest as `tools` (AD-3). A `run_specialists()` dispatcher runs all three concurrently with `asyncio.gather` (AD-13) and returns their results in a fixed order.

## Boundaries & Constraints

**Always:** each specialist call passes exactly its own module's `TOOL_MANIFEST` as `tools` and nothing else; the Anthropic client is a constructor/parameter injection point (default `AsyncAnthropic()`), never built inside the call path, so tests never touch the network or need a key; model id is the literal `claude-sonnet-5`; the three calls run concurrently via a single `asyncio.gather`, sharing one injected client; every specialist returns the same `SpecialistRecommendation` shape regardless of agent; `run_specialists()` returns results in the fixed order berth, crane, yard.

**Block If:** the epic pins a specialist's allowed tool set to a concrete named list that conflicts with what the mock-service contract (epic-1-context.md) can support — surface it rather than inventing tool schemas that Story 1.11 cannot then implement.

**Never:** no tool *execution* — manifests are passed to the API but this story does not run tool calls or mock services (Story 1.11); no retry, timeout tuning, or fallback-on-failure (Story 1.5) — a failed call propagates; no arbiter/synthesis or disagreement detection (Story 1.4); no confidence scoring (Story 1.6); no orchestrator task lifecycle beyond the `run_specialists()` dispatch function; no persistent session or multi-turn loop (AD-2: bounded request/response).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Three specialists dispatched | An `Incident`, plus an injected fake async client that returns a valid recommendation JSON per call | `run_specialists()` returns a `SpecialistBundle` with three `SpecialistRecommendation`s in order berth, crane, yard; exactly three `messages.create` calls were made | No error expected |
| Scoped tools per agent | Same | The Berth call's `tools` equals `berth.TOOL_MANIFEST`; it contains no tool whose `name` appears in `crane.TOOL_MANIFEST` or `yard.TOOL_MANIFEST`, and symmetrically for the other two | No error expected |
| Concurrency, not sequential | Fake client sleeps ~50 ms per call | `run_specialists()` wall time is well under the ~150 ms a sequential run would take (three calls overlap) | No error expected |
| Malformed model response | Fake client returns text that is not valid recommendation JSON for one agent | `call_specialist()` raises a `SpecialistError` naming the agent; `run_specialists()` does not swallow it | Exception propagates (retry/fallback is Story 1.5) |

</intent-contract>

## Code Map

- `backend/registry/incident_registry.py` -- existing (Story 1.2). **CHANGE:** the single `CORRELATE` `TraceEntry` built in `correlate()` currently records `detail = {signal_type, matched, entity_refs, incident_id}` and drops `signal.payload`. Add `"payload": signal.payload` to that `detail` dict so the correlated signal's actual content (ETA value, alert body, congestion level, ...) survives on the incident for downstream stages. Backward-compatible: Story 1.2's tests assert specific keys are present, not dict equality — they must still pass. This is the only reason `_incident_summary()` can render real signal content; without it, on the golden path the specialists would see entity refs and trace metadata only.
- `backend/models/incident.py` -- existing (Story 1.2): `Incident` (`incident_id`, `entity_refs`, `created_at`, `last_signal_at`, `trace: list[TraceEntry]`). `TraceEntry.detail` is a free `dict[str, Any]`, so adding `payload` needs no model change. No edit to this file.
- `backend/requirements.txt` -- add `anthropic` (Messages API SDK, AD-2), pinned to the range the verification env resolves (`anthropic>=1,<2` — the env pulls 1.x; do not pin `<1.0`). `pydantic`, `pytest` already present.
- `backend/agents/__init__.py` -- new: package init.
- `backend/agents/base.py` -- new: `SpecialistRecommendation` (with `summary`/`rationale` as `Field(min_length=1)`) and `SpecialistBundle` pydantic models; `SpecialistError(agent, reason)`; `AgentName = Literal["berth","crane","yard"]`; `async def call_specialist(agent: AgentName, incident, *, client) -> SpecialistRecommendation`. It: builds a delimited, untrusted-data-framed incident brief; makes one `client.messages.create(model="claude-sonnet-5", max_tokens=4096, system=<module.SYSTEM_PROMPT>, messages=[...], tools=<module.TOOL_MANIFEST>)`; then converts **every** failure into `SpecialistError(agent, reason)` — a raised SDK exception, `stop_reason == "max_tokens"`, `stop_reason == "tool_use"` / a response with no usable text block, JSON that will not parse, a schema mismatch, and a reply whose `agent` field is not `agent`. No raw SDK/parse/attribute exception escapes.
- `backend/agents/berth.py`, `backend/agents/crane.py`, `backend/agents/yard.py` -- new: each exports `NAME`, `SYSTEM_PROMPT`, `TOOL_MANIFEST: list[dict]`. The system prompt scopes the agent to its domain, tells it the tools are **not callable in this step** (reply with the JSON object only, do not emit tool calls), pins `"agent"` to the module name, and shows the target shape by field description rather than literal `"..."` placeholders. `TOOL_MANIFEST` tool `name`s are pairwise disjoint across the three modules.
- `backend/agents/dispatch.py` -- new: `async def run_specialists(incident, *, client=None) -> SpecialistBundle`. Builds one `AsyncAnthropic()` only when `client is None` (wrapped so a constructor failure is a `SpecialistError`). Runs the three `call_specialist(...)` coroutines with `asyncio.gather(..., return_exceptions=True)`; if any result is an exception, it awaits/cancels the rest cleanly and re-raises the **first failure in berth→crane→yard order** (deterministic, no orphaned coroutines / "task exception never retrieved"). On full success returns `SpecialistBundle(recommendations=[berth, crane, yard])`.
- `backend/tests/agents/test_specialists.py` -- new: `FakeAsyncAnthropic` recording each `messages.create(**kwargs)`; incidents built **through `IncidentRegistry().correlate(make_signal(...))`** (the real Story 1.2 producer), not hand-assembled trace dicts. Covers all four I/O-matrix rows plus the fixes below.

## Tasks & Acceptance

**Execution:**
- `backend/registry/incident_registry.py` -- add `"payload": signal.payload` to the `CORRELATE` `TraceEntry.detail` in `correlate()` -- so the correlated signal's content reaches downstream stages; Story 1.2's suite must stay green.
- `backend/requirements.txt` -- add `anthropic>=1,<2` -- the Messages API SDK (AD-2); match the version the verification env resolves, not `<1.0`.
- `backend/agents/base.py` -- `AgentName` literal; `SpecialistRecommendation` (`agent: AgentName`, `summary: str` min_length 1, `actions: list[str]`, `constraints: list[str]`, `rationale: str` min_length 1); `SpecialistBundle`; `SpecialistError(agent, reason)`; `call_specialist()` that turns **every** failure path into `SpecialistError` (raised SDK exception, `max_tokens` / `tool_use` stop reason, no text block, unparseable JSON, schema mismatch, `agent`-field mismatch) and builds the brief with delimited untrusted-data framing. Use a tolerant JSON extract (scan for the first balanced object via `json.JSONDecoder().raw_decode`, not a first-`{`/last-`}` slice).
- `backend/agents/berth.py`, `crane.py`, `yard.py` -- per-agent `NAME`, `SYSTEM_PROMPT` (domain scope + "do not call tools, reply with the JSON object only" + `agent` pinned + field-description shape, no literal `"..."`), `TOOL_MANIFEST` with pairwise-disjoint tool `name`s -- AD-3.
- `backend/agents/dispatch.py` -- `run_specialists()` via one `asyncio.gather(..., return_exceptions=True)` on a shared client; on any failure, cleanly finish/cancel siblings and re-raise the first failure in berth→crane→yard order; wrap a `client is None` constructor failure as `SpecialistError` -- AD-13, no orphaned coroutines.
- `backend/tests/agents/test_specialists.py` -- build incidents via `IncidentRegistry().correlate(make_signal(..., payload={...}))`; cover the four I/O-matrix rows **and**: (a) the brief handed to `messages.create` contains the correlated signal's `signal_type` and a distinctive payload value; (b) a reply whose `agent` field disagrees with the dispatched agent raises `SpecialistError`; (c) a `tool_use`-only / no-text response raises `SpecialistError(agent)`; (d) a raised SDK-style exception from `messages.create` surfaces as `SpecialistError(agent)`; (e) `max_tokens` stop reason raises `SpecialistError`; (f) two agents failing -> `run_specialists` raises the berth-order-first `SpecialistError` deterministically; (g) `_resolve()` on an unknown agent name raises; (h) concurrency proven by a **deterministic** in-flight counter on the fake (max concurrent == 3), not a wall-clock threshold.

**Acceptance Criteria:**
- Given `run_specialists()` with an injected fake client, when it returns, then `bundle.recommendations` has exactly three entries, one per agent, in order berth/crane/yard, each a `SpecialistRecommendation` whose `agent` matches its slot.
- Given the three specialist modules, when their `TOOL_MANIFEST`s are compared, then the sets of tool `name`s are pairwise disjoint (no agent can see another's tools).
- Given an incident produced by `IncidentRegistry.correlate()`, when `run_specialists()` runs, then each outgoing `messages.create` brief contains the correlated signal's type and payload content, not only its entity refs.
- Given any single specialist call failing for any reason, when `run_specialists()` runs, then it raises `SpecialistError` naming an agent (deterministically the berth→crane→yard-first failure) and leaves no un-awaited coroutine; no raw SDK/parse exception escapes.
- Given the full backend test suite, when run, then it passes (Story 1.1 + 1.2 + new) with no network access and no `ANTHROPIC_API_KEY` set.

## Spec Change Log

### 2026-08-27 — bad_spec loopback (review_loop_iteration 1)

- **Trigger (Verification Gap):** `_incident_summary()` was specified to read raw signal payloads from `trace` `detail`, but Story 1.2's `IncidentRegistry.correlate()` writes a `CORRELATE` `TraceEntry` with only `{signal_type, matched, entity_refs, incident_id}` — no payload. On the real golden path the specialists would reason over a brief with entity refs and trace metadata but zero signal content; the passing test only worked because it hand-built a `payload` key the registry never produces.
- **Amended:** Code Map + Tasks now include a one-line change to `incident_registry.py` (`"payload": signal.payload` on the CORRELATE trace detail), and the test task now builds incidents through the real `IncidentRegistry`. Added an AC that the outgoing brief contains signal type + payload content.
- **Also folded in this pass (patch-class findings, addressed by re-derivation so the code is coherent):** wrap every `call_specialist` failure mode in `SpecialistError` (raised SDK exception, `max_tokens`/`tool_use` stop reason, no text block, unparseable/loosely-fenced JSON, `agent`-field mismatch); `run_specialists` must use `gather(return_exceptions=True)` and re-raise the berth→crane→yard-first failure with no orphaned coroutines; `SpecialistRecommendation.summary`/`rationale` get `min_length=1`; system prompts instruct against emitting tool calls and drop literal `"..."` placeholders; brief framed as untrusted data; `AgentName` literal on `call_specialist`; deterministic in-flight-count concurrency test instead of a wall-clock threshold; `anthropic` pin corrected to `>=1,<2`.
- **KEEP (worked well, must survive re-derivation):** the three-name (`NAME`/`SYSTEM_PROMPT`/`TOOL_MANIFEST`) per-agent module contract; `call_specialist()` owning the shared call shape so agent modules stay pure data; injected client with lazy default; fixed berth→crane→yard bundle order; pairwise-disjoint tool `name` sets; one bounded `messages.create` per agent, no `tool_use` loop, no sampling params/prefill/`thinking`.

## Review Triage Log

### 2026-08-27 — Review pass (review_loop_iteration 1)
- intent_gap: 0
- bad_spec: 1: (high 0, medium 1, low 0)
- patch: 0
- defer: 4: (high 0, medium 1, low 3)
- reject: 3
- addressed_findings:
  - `[medium]` `[bad_spec]` Incident brief carried no signal payloads for real (registry-produced) incidents — amended Code Map/Tasks to persist `signal.payload` on the CORRELATE trace entry and build tests through `IncidentRegistry`; re-derivation triggered, folding in the failure-wrapping / tool_use / gather-cleanup / validation / prompt-injection / concurrency-test findings.

### 2026-08-27 — Review pass 2 (post re-derivation, review_loop_iteration 1)
- intent_gap: 0
- bad_spec: 0
- patch: 15: (high 0, medium 2, low 13)
- defer: 0 (3 prior deferrals unchanged; 1 new — brief size bound — already recorded in frontmatter from pass 1)
- reject: 6
- addressed_findings:
  - `[medium]` `[patch]` `call_specialist`/`run_specialists` took the whole `Incident` (AD-4 letter) — `run_specialists` now renders the brief once and passes the string down.
  - `[medium]` `[patch]` `asyncio.CancelledError` from `gather` was wrapped as `SpecialistError` — now re-raised as-is.
  - `[low]` `[patch]` Added `tool_choice={"type":"none"}`; handle `stop_reason=="refusal"`; wrap `_resolve` `ImportError`; concatenate multi-block text; try each balanced JSON object; deep-copy `signal.payload` into trace.
  - `[low]` `[patch]` `SpecialistBundle` now enforces exactly 3; secondary multi-agent failures attached via `add_note`; `summary`/`rationale` `max_length`, non-empty list items.
  - `[low]` `[patch]` System-prompt untrusted-data reinforcement + `</incident-data>` delimiter-collision neutralisation; `AgentName` typing on `_AGENT_ORDER`; `MAX_TOKENS` comment.
  - `[low]` `[patch]` Tests: deterministic `asyncio.Barrier(3)` concurrency proof; multi-signal brief; "(none recorded)" branch; `SpecialistError` format; stray-`{}`-before-JSON; `refusal`; monkeypatched `AsyncAnthropic` construction failure.
  - Rejected: `claude-sonnet-5` "invalid model id" (valid, pinned by AD-2); `signal_type` "not written" (Story 1.2 already writes it); missing `tests/agents/__init__.py` (matches `tests/ingestion`/`tests/registry`, suite green); no lockfile/hash pins (project-wide, not this story); remove the reply-`agent` cross-check (kept as defensive value); "add any timeout" (Story 1.5 owns the retry/timeout envelope — kept deferred).

## Design Notes

**Model is `claude-sonnet-5`, not the SDK default.** epic-1-context AD-2 pins every specialist/arbiter/status call to `claude-sonnet-5` via the raw Messages API — no Agent SDK, Tool Runner, or Managed Agents, no persistent session. `call_specialist()` makes one `messages.create` and returns; it does not loop on `tool_use`.

**Tools are declared but not callable in this step.** AC "only tools listed in that agent's manifest are passed in" is about call *construction* (AD-3). The manifest is still passed, but the system prompt tells the model the tools are not available this step and to reply with the JSON object only; a `tool_use` stop reason or a text-less response is treated as a `SpecialistError`, not a silent empty analysis. Executing tool calls against mock services is Story 1.11; turning specialist output into ranked recovery options is Story 1.4.

**Every failure is a `SpecialistError`; degradation is still Story 1.5.** `call_specialist()` never lets a raw SDK/parse/attribute exception escape — callers (and Story 1.5's future retry/fallback wrapper) get one exception type carrying the agent name. `run_specialists()` uses `gather(return_exceptions=True)`, cleans up siblings, and re-raises the first failure in berth→crane→yard order so a multi-agent failure is deterministic. Retrying once with a short fixed timeout and degrading confidence remains Story 1.5's contract (AD-13 second half) — not added here.

**NFR1 (~20-30s golden-path budget)** is met by construction — one bounded call per agent, all three concurrent — and asserted only structurally (overlap of fake-client sleeps). A real end-to-end latency check needs a live API key and is a manual/demo check, noted here rather than in an automated test.

## Verification

**Commands:**
- `cd backend && uv run --with pydantic --with pytest --with anthropic --python 3.12 pytest tests/agents/ -v` -- expected: all specialist tests pass, zero failures, no network calls.
- `cd backend && uv run --with pydantic --with pytest --with anthropic --python 3.12 pytest -q` -- expected: full suite green (Story 1.1 + 1.2 + new), proving no regression.

## Auto Run Result

Status: done

**Implemented change.** `backend/agents/` package: three pure-data specialist modules (`berth`, `crane`, `yard` — each `NAME` / `SYSTEM_PROMPT` / disjoint `TOOL_MANIFEST`), a shared `call_specialist()` that makes one bounded `claude-sonnet-5` Messages API call (`tool_choice:"none"`, only that agent's manifest as `tools`) and collapses every failure mode to `SpecialistError(agent, reason)`, and `run_specialists()` which fans the three out with one `asyncio.gather(return_exceptions=True)` on a shared injected client and re-raises the first failure in berth→crane→yard order with no orphaned coroutines. One line added to `IncidentRegistry.correlate()` persists `copy.deepcopy(signal.payload)` on the CORRELATE trace entry so the specialist brief carries real signal content. `anthropic>=1,<2` added to `requirements.txt`.

**Files changed.**
- `backend/registry/incident_registry.py` — CORRELATE `TraceEntry.detail` now carries `payload` (deep-copied). Story 1.2 suite unaffected.
- `backend/requirements.txt` — `anthropic>=1,<2`.
- `backend/agents/__init__.py`, `base.py`, `berth.py`, `crane.py`, `yard.py`, `dispatch.py` — new.
- `backend/tests/agents/test_specialists.py` — new, 32 tests; incidents built through the real `IncidentRegistry`; deterministic `asyncio.Barrier(3)` concurrency proof.

**Review findings breakdown.** Pass 1: 1 bad_spec (payloads absent from real briefs) → spec amended + full re-derivation; 4 deferred; 3 rejected. Pass 2 (post re-derivation): 15 patches applied (0 high / 2 medium / 13 low) — AD-4 brief-string handoff, `CancelledError` passthrough, `tool_choice:"none"`, `refusal` handling, `ImportError` wrap, multi-block text join, multi-candidate JSON validation, deep-copied payload, `SpecialistBundle` length-3, secondary-failure notes, string bounds, prompt-injection hardening, deterministic concurrency test, +6 tests; 6 rejected; deferrals unchanged.

**Follow-up review recommendation:** `true`. Pass-2 patched findings: 0 high, 2 medium, 13 low → score `3×2 + 1×13 = 19` ≥ 5.

**Verification performed.**
- `pytest tests/agents/ -v` → `32 passed`.
- `pytest -q` (full suite) → `85 passed` (Story 1.1: 31, Story 1.2: 22, Story 1.3: 32), no regression, no network, no `ANTHROPIC_API_KEY`.
Re-run independently after the patch pass: `85 passed`.

**Residual risks.** No live Anthropic call is exercised anywhere — the real `AsyncAnthropic()` path, `claude-sonnet-5` id, `tool_choice:"none"` acceptance, and the `~20-30s` NFR1 budget are unverified until an integration/demo run with a real key (deferred by design). Retry/timeout/fallback is Story 1.5; `AGENT_CALL` trace entry is Story 1.12; the six tool schemas are placeholders for Story 1.11 to back with real mock executors; `_incident_summary` has no cap on brief size.
