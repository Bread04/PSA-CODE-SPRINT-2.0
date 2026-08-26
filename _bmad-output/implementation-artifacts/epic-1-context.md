# Epic 1 Context: Autonomous Incident Resolution

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Portwatch detects a cross-system disruption, analyzes it from three specialist angles (Berth/Vessel, Crane, Yard), computes an honest deterministic confidence score, and safely resolves it — auto-executing what's low-risk, blocking and escalating what isn't. This is the core golden path (ingest → correlate → analyze → synthesize → confidence → policy decision → DG gate → execute/escalate) and stands alone as a complete backend capability, independent of the operator-facing dashboard (Epic 2) and multi-incident/stretch scope (Epic 3). It also includes a per-agent demo-safety mock override (AD-16) so any specialist or arbiter call can be pinned to a canned response for demo resilience, without ever letting that substitution masquerade as real output.

## Stories

- Story 1.1: Signal Ingestion & Normalization
- Story 1.2: Incident Correlation via 15-Minute Window
- Story 1.3: Specialist Agent Analysis (Berth/Crane/Yard)
- Story 1.4: Arbiter Synthesis of Recovery Options
- Story 1.5: Tool Retry & Fallback on Failure
- Story 1.6: Deterministic Confidence Scoring
- Story 1.7: Policy Tier Classification
- Story 1.8: Tier-Based Execution Behavior
- Story 1.9: DG/IMDG Hard Gate & Re-plan Loop
- Story 1.10: Global Kill Switch
- Story 1.11: Mock Service Execution & Verification
- Story 1.12: Execution Trace Recording
- Story 1.13: Per-Agent Demo-Safety Mock Override

## Requirements & Constraints

- Normalize all signal types (vessel ETA changes, crane/equipment alerts, yard congestion, gate queue metrics, weather events, DG exceptions, operator/user requests) into one common incident representation; unrecognized/malformed signals are rejected with a logged reason, never silently dropped or crash-inducing.
- Correlate signals sharing an entity (vessel/berth/crane/yard block) into a single incident when within a 15-minute rolling window; outside that window, or for a new entity, spawn a new incident.
- Three specialist agents (Berth/Vessel, Crane, Yard) run as independent, parallel, scoped-tool LLM calls, each returning a structured recommendation + constraints.
- A separate arbiter agent synthesizes specialist outputs into 2-3 ranked recovery options with predicted impact (delay, cost, yard impact, risk); fewer than 2 viable options is valid, not an error.
- On tool timeout/failure: retry exactly once with a short fixed timeout, then fall back to last-known state, reduce confidence, and log the reason — the incident degrades rather than crashes or blocks (NFR3).
- Confidence is a deterministic, unit-testable computed score (never an LLM self-report): starts at 100; -1pt/10s telemetry staleness beyond fresh (cap -20); -15pt per required field using fallback/cached data; -10pt flat for specialist disagreement; -10pt flat if predicted-outcome spread across options exceeds 30%.
- A deterministic policy engine (no LLM in its decision path) classifies the selected recovery option into Tier 1 (reversible, no SLA breach, LOW safety risk, confidence ≥85, LOW cost, no DG involvement), Tier 2 (reversible, no SLA breach, safety risk ≤MEDIUM, confidence ≥70, cost ≤MEDIUM, no DG involvement), or Tier 3 (everything else). Same inputs must always yield the same tier.
- Tier 1 auto-executes silently; Tier 2 auto-executes and notifies (non-blocking); Tier 3 blocks execution and produces a structured decision card (situation, recommendation, predicted impact, confidence, alternatives) — no execution until an operator approval flow (Epic 2) resolves it.
- DG/IMDG segregation is a hard gate that runs after tier classification and before execution, independent of tier; a violation forces re-planning (new arbiter option, re-classified) capped at 2 re-plan attempts, after which the incident is forced to Tier 3 regardless of its own tier. Rejected options are recorded with their DG-gate reason, never silently discarded.
- A single global kill switch immediately disables all autonomous execution, checked at exactly one point (immediately before mock-service execution) — never at ingestion, correlation, or analysis. A Tier 1/2 decision blocked by the kill switch sets `blocked_by_kill_switch: true` (tier is NOT reclassified) plus a trace entry; re-resolution happens via the existing approval action re-checking the flag, no new endpoint.
- Approved/auto actions execute against mock services (TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager, Notification incl. MPA, DG Checker); each call is verified individually; a failure (return `ok:false` or raised exception) is recorded with its error, never treated as silent success, and multi-call actions record each call's outcome independently.
- Every incident produces a structured, timestamped, append-only execution trace spanning INGEST → CORRELATE → AGENT_CALL → SYNTHESIZE → CONFIDENCE → POLICY_DECISION → DG_CHECK → APPROVAL → EXECUTE → VERIFY, written regardless of stage outcome, with failures/retries/fallbacks captured in a standard error shape (never omitted).
- Golden-path incident (ingest → policy decision) must resolve in ~20-30s under demo conditions (NFR1); this budget requires specialist calls to run concurrently, not sequentially.
- 100% of automated and human-approved actions must produce a trace entry — no silent failures (NFR2).
- Per-agent demo-safety override (AD-16): a static config map (`MOCK_AGENTS: {berth, crane, yard, arbiter}`) lets any specialist or the arbiter be short-circuited to a canned, structurally-identical response instead of a live call — opt-in only, behavior is unchanged when unset. Every downstream stage consumes the mocked output exactly as a real one. A mock-forced `AGENT_CALL` trace entry always sets `detail.mock_forced: true`, and the same -15pt missing-data confidence penalty applies as for fallback/cached data — a mocked response must never present as full-confidence real output.

## Technical Decisions

- **Paradigm:** single-writer orchestrated pipeline, actor-per-incident — each incident is an isolated async task owning one mutable `Incident` record; only that orchestrator task writes to it or its trace. Specialist agents, arbiter, policy engine, and mock services are pure call/return with no shared-state access.
- **AD-1:** single-process modular monolith (one FastAPI process; no microservices/queues/containers).
- **AD-2:** specialist agents, arbiter, and status-query handler call the raw Anthropic Messages API (`claude-sonnet-5`) directly — not the Agent SDK, Tool Runner, or Managed Agents. Bounded, single-purpose request/response, no persistent session.
- **AD-3:** each agent's allowed tools come from a static per-agent manifest, enforced at the API-call boundary; adding capability means editing the manifest, never the prompt.
- **AD-4:** one `Incident` record per `incident_id` with embedded append-only `trace`; only the orchestrator writes; never pass a mutable `Incident` reference into any non-orchestrator function.
- **AD-5:** in-memory `IncidentRegistry` keyed by entity, checked before dispatch to correlate within the 15-minute window.
- **AD-7:** kill switch is a single global in-memory flag checked at exactly one point (immediately before mock-service execution calls).
- **AD-8:** DG/IMDG gate runs after `POLICY_DECISION`, before `EXECUTE`, for every tier; loop-back to arbiter on conflict, capped at 2 re-plan attempts before forced Tier 3.
- **AD-9 / AD-10 [ADOPTED]:** in-memory persistence only (no DB); no authentication (single-user demo).
- **AD-12 [ADOPTED]:** Yard Manager mock models two terminal blocks (Tuas C7, Pasir Panjang P2) from day 1, even though the Day-5-stretch routing logic (FR17, Epic 3) isn't in scope here.
- **AD-13:** specialist agent calls must run concurrently (`asyncio.gather`); the single retry uses a short fixed timeout, not a client default, to fit the ~20-30s budget.
- **AD-14:** every stage transition writes a trace entry regardless of outcome; failures degrade confidence rather than being swallowed or crashing the task.
- **AD-15:** kill-switch-blocked Tier 1/2 decisions set `Incident.blocked_by_kill_switch: true` (tier untouched) plus a trace entry; resolved via the existing approval endpoint's `approve` action re-checking the flag — no new endpoint.
- **AD-16:** per-agent `MOCK_AGENTS` override, settable via env var/startup config (no new UI control in this epic); short-circuits the Messages API call per agent; canned response must be structurally identical to a real one; trace and confidence must always reflect the substitution (see Requirements above).
- **Naming/data conventions:** `incident_id` is a UUID4 string; agent module names are lowercase (`berth`, `crane`, `yard`, `arbiter`); trace `stage` values are SCREAMING_SNAKE per the sequence above; timestamps are ISO 8601 UTC; confidence is an int 0-100; tier is literal `1|2|3`; error/failure shape is `{stage, error, retried: bool, fallback_used: bool}`. Tier thresholds and confidence weights live in one static config module, not scattered constants.
- **Shared data shapes** (fields only; code owns the rest):
  - `Incident`: `incident_id`, `status` (`open`|`resolved`), `entity_refs: list[str]`, `tier: 1|2|3|null`, `confidence: int`, `recommended_option_id: str|null`, `options: list[RecoveryOption]`, `approval_status` (`n/a`|`pending`|`approved`|`rejected`), `blocked_by_kill_switch: bool`, `trace: list[TraceEntry]`.
  - `RecoveryOption`: `option_id`, `description`, `predicted_impact: {delay_min, cost: low|medium|high, yard_impact, risk: low|medium|high}`, `reversible: bool`, `dg_involved: bool`.
  - `TraceEntry`: `stage`, `timestamp`, `detail: dict`, `error: {stage, error, retried, fallback_used}|null`.
- **Entity id format:** fixed convention, e.g. `vessel:MSC-ANNA`, `berth:C7-3` — ingestion normalizes to this and mock services must emit/accept the same format so registry correlation and mock calls agree on entity identity.
- **Mock service contract:** every mock service exposes one `async def execute(action: dict) -> {ok: bool, result: dict, error: str|null}`, with an injectable timeout/failure mode for FR5 testing. Services: TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager, Notification (incl. MPA), DG Checker.
- **Source tree (this epic's lanes):** `backend/ingestion/` (FR1), `backend/registry/` (AD-5), `backend/orchestrator/` (AD-4, sole state writer), `backend/agents/` (`berth.py`, `crane.py`, `yard.py`, `arbiter.py` + tool manifests, AD-2/AD-3), `backend/policy/` (`policy_engine.py`, `confidence.py`, `dg_gate.py` — pure functions), `backend/mock_services/`, `backend/models/` (`Incident`, `TraceEntry`). The read-only API/approval endpoints these stages feed are Epic 2 concerns, but Epic 1 must produce data conforming to the API seed (`GET /incidents`, `GET /incidents/{incident_id}`, `POST /incidents/{incident_id}/approval`, `POST /kill-switch`) so Epic 2 can consume it unchanged.
- **Stack:** Python 3.12+, FastAPI ~0.141.x, Anthropic Python SDK (Messages API, direct), `claude-sonnet-5` for all agent calls.

## Cross-Story Dependencies

- Story 1.1 (ingestion) must produce the fixed `entity_refs` id format before Story 1.2 (correlation) can match on it.
- Story 1.2 (correlation/registry) must route a signal to an existing or new orchestrator task before Story 1.3 (specialist agents) has an incident to analyze.
- Story 1.3 (specialist outputs) feeds Story 1.4 (arbiter synthesis); specialist disagreement detected in 1.4 is a required input to Story 1.6's confidence disagreement penalty.
- Story 1.5 (retry/fallback) determines the `fallback_used` state that Story 1.6 (confidence) penalizes and that Story 1.12 (trace) must record.
- Story 1.6 (confidence) and Story 1.4's option set are required inputs to Story 1.7 (policy tier classification).
- Story 1.7 (tier) feeds Story 1.8 (tier-based execution behavior), which in turn feeds Story 1.9 (DG gate, runs after policy decision, before execution) — a DG conflict loops back to Story 1.4 (arbiter) for re-planning.
- Story 1.10 (kill switch) gates Story 1.11 (mock execution) at the single AD-7 enforcement point immediately before any execution call.
- Story 1.11 (execution/verification) results and every prior stage's transitions are all recorded by Story 1.12 (trace recording), which is cross-cutting across every other story in this epic.
- Story 1.13 (mock override) intercepts the same call points as Story 1.3/1.4 (specialist and arbiter calls) and must integrate with Story 1.6 (confidence penalty) and Story 1.12 (trace `mock_forced` flag) — it is additive and must not change behavior when unset.
- Epic 2 (approval flow, dashboard, trace viewing) depends on this epic's `Incident`/`TraceEntry`/`RecoveryOption` shapes and the Tier 3 decision-card/approval-pending state produced by Story 1.8, but no Epic 1 story depends on Epic 2.
- Epic 3 (concurrency proof, Pasir Panjang routing, additional agents) depends on this epic's orchestrator, policy engine, and specialist-agent pattern being stable and reused unchanged.
