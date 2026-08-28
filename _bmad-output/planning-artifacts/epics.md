---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-PSA-CODE-SPRINT-2026-08-24/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/DESIGN.md"
  - "_bmad-output/planning-artifacts/ux-designs/ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/research/competitive-psa-code-sprint-past-finalists-2026-08-26/research.md"
---

# Portwatch - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Portwatch, decomposing the requirements from the PRD, Architecture Spine (incl. the AD-16 demo-resilience addition informed by the competitive research below), and UX Design Contract (DESIGN.md + EXPERIENCE.md, finalized 2026-08-26 — matches the team's existing Portwatch Console design canvas exactly) into implementable stories. The competitive research report (past PSA Code Sprint finalists, 2026-08-26) is included for context — it produced no FRs/NFRs of its own, but informed AD-16 (per-agent demo-safety mock override) and should inform presentation/demo-narrative framing during Build and Checkpoint reviews.

## Requirements Inventory

### Functional Requirements

FR1: Normalize inputs (vessel ETA changes, crane/equipment alerts, yard congestion metrics, gate queue metrics, weather events, DG exceptions, operator/user requests) into a common incident representation.
FR2: Correlate related signals into a single incident when they share an entity (same vessel/berth/crane/yard block) and occur within a 15-minute rolling window of each other.
FR3: Berth/Vessel, Crane, and Yard specialist agents run as independent, parallel LLM calls, each with scoped tool access, each returning a structured recommendation + constraints.
FR4: A separate Portwatch arbiter agent synthesizes specialist outputs into 2-3 ranked recovery options with predicted impact (delay, cost, yard impact, risk).
FR5: On tool timeout\failure: retry once, then fall back to last-known state and reduce confidence, logging the reason.
FR6: Confidence is a computed, deterministic score, starting at 100 and reduced by: staleness (-1pt per 10s of telemetry age beyond fresh, capped at -20), missing-data (-15pt per required field using fallback/cached state), disagreement (-10pt flat if specialist agents' recommendations conflict), variance (-10pt if predicted-outcome spread across recovery options exceeds 30%). Never an LLM self-report.
FR7: A deterministic policy engine, outside LLM authority, evaluates the selected recovery option against tiered rules and classifies it Tier 1/2/3 (Tier 1: reversible AND no SLA breach AND safety risk = LOW AND confidence >= 85 AND cost = LOW AND no DG involvement. Tier 2: reversible AND no SLA breach AND safety risk <= MEDIUM AND confidence >= 70 AND cost <= MEDIUM AND no DG involvement. Tier 3: everything else).
FR8: Tier 1 auto-executes silently; Tier 2 auto-executes and notifies; Tier 3 blocks execution and requests human approval via a structured decision card (situation, recommendation, predicted impact, confidence, alternatives).
FR9: DG/IMDG segregation is a hard gate independent of tier — a violation forces re-planning even after a tier-approved recommendation.
FR10: A global kill switch immediately disables all autonomous execution.
FR11: Operator can approve, reject, or modify (select a different ranked option) a Tier-3 recommendation.
FR12: Any user can query live incident status in natural language; answered from grounded incident state.
FR13: Approved/auto actions execute against mock services (TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager, Notification incl. MPA, DG Checker); each action is verified individually; failures are recorded, never silently treated as success.
FR14: Every incident produces a structured, timestamped execution trace: input -> correlation -> tool calls (incl. retries/failures) -> agent recommendations -> synthesis -> confidence -> policy decision -> human approval (if any) -> execution results/errors.
FR15: The trace is viewable per-incident in the dashboard.
FR16: Incident processing is stateless per incident (no shared mutable state), so >=2 incidents can be triggered and resolved concurrently without blocking each other.
FR17 (Day-5 stretch): The Yard Manager mock service models a second terminal cluster (Pasir Panjang Block P2) alongside Tuas Block C7. When Tuas yard utilization is high, the arbiter's synthesized recovery options include routing a portion of container flow to Pasir Panjang, reusing the existing Yard Agent, arbiter, and policy engine unchanged. Dashboard shows both blocks' utilization.
FR20 (Day-5 stretch, ranked third): An AGV/Gate specialist agent, reusing the existing specialist-agent pattern (FR3), analyzes gate-queue and AGV-congestion signals and proposes recovery options (e.g. adjusting gate appointment slots, rerouting AGV traffic) using the existing AGV Manager and Gate Manager mocks (FR13). Recommendations pass through the same confidence formula, policy engine, and execution/verification path unchanged — no new pipeline stage. Minted 2026-08-27 during epic/story decomposition: the PRD named "AGV/Gate agent" in its Day-5 ranking and Out-of-Scope section but had no FR number until this pass.
FR18 (Day-5 stretch, ranked last): A mocked meteorological-radar feed signals severe convective weather within a 30-minute detection window. A Weather agent (reusing the specialist-agent pattern) proposes locking anti-typhoon crane pins, rerouting AGVs to flood-safe zones, and a natural-language schedule-adjustment notice. Tiered like any recovery option — high safety-risk actions route to Tier 3, never silent auto-execute.
FR19 (Day-5 stretch, ranked last): A mocked MPA-clearance-check service, modeled on the real digitalPORT@SG workflow's shape, added alongside the DG Checker mock. No live API calls — mocked only.

### NonFunctional Requirements

NFR1: Golden-path incident (ingest -> policy decision) resolves in ~20-30s under demo conditions.
NFR2: 100% of automated and human-approved actions produce a trace entry — no silent failures.
NFR3: The system degrades (reduced confidence) rather than crashes when a mock tool times out.

### Additional Requirements

(from Architecture Spine — no starter template specified; greenfield build, single-process FastAPI backend + React/TS/Vite frontend)

- AD-1: Single-process modular monolith — all build lanes live in one FastAPI process, no microservices/queues/containers.
- AD-2: Specialist agents, arbiter, and the FR12 status-query handler call the raw Anthropic Messages API (claude-sonnet-5) directly — not the Claude Agent SDK, Tool Runner, or Managed Agents.
- AD-3: Each agent's allowed tools come from a static per-agent manifest, enforced at the API-call boundary (least-privilege).
- AD-4: Single-writer orchestrator pattern — one `Incident` record per `incident_id` with an embedded append-only `trace` list; only the orchestrator task writes; all other components are pure call/return; frontend only reads.
- AD-5: A central in-memory `IncidentRegistry` (keyed by entity) is checked before dispatch to correlate signals into existing incidents within the 15-minute window (FR2).
- AD-6: Frontend polls a single read-only Incident API endpoint every 2-3s — no SSE/WebSocket.
- AD-7: Kill switch is a single global flag checked at exactly one point — immediately before any mock-service execution call.
- AD-8: DG/IMDG gate runs after policy-tier classification, before execution, independent of tier; conflict loops back to the arbiter, capped at 2 re-plan attempts before forcing Tier 3.
- AD-9 [ADOPTED]: In-memory persistence only — no database.
- AD-10 [ADOPTED]: No authentication — single-user demo.
- AD-11: Tier-3 "modify" is scoped to `select_alternative(option_id)` against the arbiter's existing 2-3 options — not free-form editing.
- AD-12 [ADOPTED]: Yard Manager mock models two terminal blocks (Tuas C7, Pasir Panjang P2) from day 1, even though FR17's routing logic is Day-5 stretch.
- AD-13: Specialist agent calls must run concurrently (`asyncio.gather`), and FR5's single retry uses a short fixed timeout, to fit the ~20-30s golden-path budget (NFR1).
- AD-14: Every stage transition writes a trace entry regardless of outcome; a failure degrades confidence rather than being swallowed or crashing the task.
- AD-15 (new — closes a gap found during UX-DR elicitation): kill-switch-blocked Tier 1/2 decisions set `Incident.blocked_by_kill_switch: true` (tier is NOT reclassified to 3) and a matching trace entry; operator resolves via the existing Approve action, which re-checks the flag and executes if now clear. No new endpoint.
- AD-16 (new — from competitive research on demo resilience, 2026-08-27): each specialist agent and the arbiter reads a static config override (`MOCK_AGENTS: {berth, crane, yard, arbiter}`) that, when set, short-circuits that agent's live Messages API call for a structurally-identical canned response. Manual, pre-emptive defense-in-depth beyond FR5's automatic retry — lets the operator pull a misbehaving agent out of the live-LLM path entirely between demo runs without touching any other stage. Closed same-day (party-mode review): a mock-forced call must never be silently indistinguishable from a real one — its `AGENT_CALL` trace entry sets `detail.mock_forced: true`, and FR6's confidence formula applies its existing -15pt missing-data penalty to it, so a demo-stability override can never quietly present as full-confidence real output.
- Shared data shapes fixed in the spine: `Incident`, `RecoveryOption`, `TraceEntry` (see Structural Seed section of ARCHITECTURE-SPINE.md) — stories must conform to these field names.
- API seed fixed in the spine: `GET /incidents`, `GET /incidents/{incident_id}`, `POST /incidents/{incident_id}/approval`, `GET /incidents/query`, `POST /kill-switch`.
- Mock-service call contract: every mock exposes one `async def execute(action: dict) -> {ok, result, error}`, with an injectable timeout/failure mode (FR5 demo requirement).
- Stack: Python 3.12+ / FastAPI ~0.141.x backend; React 19.2.8 / TypeScript / Vite 8.1.3 frontend.
- Build plan constraint (PRD Section 10): Day 3 = golden path hard-freeze; Day 5 = stretch only (FR17, AGV/Gate agent, 2-concurrent-incidents demo), strictly additive.
- Frontend component set (per UX spine, supersedes earlier placeholder list): `IncidentFeed`, `IncidentDetail`, `ApprovalBanner`, `ExecutionTrace`, `AskPortwatch`, `MapPanel`, `KillSwitchControl`, `IncidentArchiveList`, plus a shared `routes/` split (`LiveConsole` default, `IncidentArchive`).
- `GET /incidents/query` extended with an optional `incident_id` hint param (frontend convenience when an incident is selected) — backend still resolves entirely from free text when omitted (AD-2 unchanged).
- Incident Archive route requires no new endpoint — reuses `GET /incidents`, filtered client-side to resolved incidents.
- Context from competitive research (not a build requirement, informs Build/Checkpoint framing): the verified PSA Code Sprint judging rubric weights Innovation & Creativity, UI/UX, Technology, and Presentation equally, with no disclosed weighting — presentation/demo-narrative prep deserves time proportional to that, not treated as an afterthought after code is done.

### UX Design Requirements

UX-DR1: Design tokens — implement DESIGN.md's exact token set as the shared frontend theme: Barlow Condensed (600) for all headings/labels/data/buttons, Barlow (400) for body; steel-blue accent ramp (`#5980a6` family, 100-900) + `accent-2` (`#728fab`); neutral ramp; zero-radius shapes everywhere except the 3px tag radius; 3.4px base spacing scale (10-18px panel padding).
UX-DR2: Blueprint panel component — reusable card primitive (1px divider border, zero radius, four 11px crosshair corner marks at each corner) used by every incident card, the approval card, the trace log, and both map panels.
UX-DR3: IncidentFeed component — reverse-chronological incident list; 7x7px accent status dot (light accent = Tier 1/2, `accent-900` = Tier 3 pending); 2px progress bar (neutral-300 track, accent-600 fill) for in-progress resolution; Tier-3-pending rows always sort to the top of the feed, above recency.
UX-DR4: IncidentDetail + ApprovalBanner component — pinned Tier-3 approval card (`aria-live="assertive"` on first appearance only, pulsing status dot) showing situation, recommendation, any rejected option struck through with its DG-gate reason, predicted impact, and confidence with its degradation reason when applicable; Approve/Modify/Reject wired to `POST /incidents/{incident_id}/approval` (`approve` / `reject` / `select_alternative(option_id)`, AD-11); persistent, no auto-dismiss, no timeout-driven default action.
UX-DR5: ExecutionTrace component — `role="log" aria-live="polite"`, reverse-chronological rows keyed to the SCREAMING_SNAKE stage vocabulary (INGEST/CORRELATE/AGENT_CALL/SYNTHESIZE/CONFIDENCE/POLICY_DECISION/DG_CHECK/APPROVAL/EXECUTE/VERIFY), `accent-900` dot marker + bolder text on error rows.
UX-DR6: AskPortwatch component — free-text input + suggestion chips; calls `GET /incidents/query?q=...` with an optional `incident_id` hint from the current selection; never requires an incident to be selected first (matches UJ-2 and the architecture's free-text resolution).
UX-DR7: MapPanel component — a geographic strait/terminal view rendered inside a blueprint panel from mock incident state. Real Singapore Strait / Tuas basemap (bundled vector geometry; no runtime network call). Renders the selected incident's affected entities (berth / crane / yard block / vessel) as token-coloured primitive markers, and updates as the incident's trace progresses. Read-only for decisions — it is NOT the decision surface (that stays the approval banner + incident detail, UX-DR4). Pan/zoom optional and lockable. Caption still states the view is illustrative and NOT live AIS, and carries no wording implying real-time / tracked vessel positions; adds that positions are mock incident state, not a vessel-tracking feed. Single `role="img"` node with a full-sentence text equivalent (UX-DR11). Story 2.7's caption-wording test assertions are carried forward unchanged. (Revised 2026-08-28 by sprint-change-proposal-2026-08-28.md; real geometry was always in the design canvas `pw-map.js` — Story 2.7 down-scoped it for time.)
UX-DR8: KillSwitchControl component — persistent header control (never nested in a menu); engaging is two-step (toggle + inline confirm) since it disables all autonomous execution; disengaging is one-step; wired to `POST /kill-switch`.
UX-DR9: IncidentArchive route — new session-scoped screen listing resolved incidents (reuses IncidentFeed row + blueprint-panel styling, adds a resolution-outcome tag: Auto-resolved/Approved/Rejected), filtered client-side from `GET /incidents`; opening an archived incident shows its trace read-only, no approval actions possible.
UX-DR10: State-pattern coverage — Tier 1 auto-resolves with no interruption (quiet tag only); Tier 2 adds a small non-sound notification badge; degraded-confidence shows an inline plain-language reason (FR5/FR6); DG re-plan shows the rejected option struck through with its reason (FR9); kill-switch-engaged shows a persistent global banner AND, per-incident, a "needs manual action — kill switch engaged" tag on any Tier 1/2 incident with `blocked_by_kill_switch: true` (AD-15), resolved via the existing Approve action; stale/unreachable API shows a small "last updated Xs ago" indicator, never a blocking error screen; empty archive shows a plain one-line message; concurrent incidents remain independently selectable (FR16 proof at the UI level).
UX-DR11: Accessibility floor — every interactive element (incl. Approve/Reject/Modify) operable via Tab/Enter/Space, not click-only; visible focus rings at AA contrast against `DESIGN.md` surface tokens; severity is never conveyed by color alone (label text + shape + `accent-900` together).
UX-DR12: Voice & tone — all microcopy plain, factual, non-alarmist per EXPERIENCE.md's Do/Don't table (e.g. "MSC Anna — ETA slipped 90 min" not "CRITICAL DISRUPTION"); no escalating exclamation/emoji as severity increases; same register for a Tier 1 footnote and a Tier 3 banner.
UX-DR13: Agent-action visualisation (added 2026-08-28, sprint-change-proposal-2026-08-28.md) — the console makes the pipeline the agents run legible as it happens, not only as a text log. A stage rail keyed to the SCREAMING_SNAKE stage vocabulary (INGEST / CORRELATE / AGENT_CALL ×3 / SYNTHESIZE / CONFIDENCE / POLICY_DECISION / DG_CHECK / APPROVAL / EXECUTE / VERIFY) reflects the selected incident's trace progress; the map's entity markers change state in step (e.g. a crane marker enters "analysing" then "action applied"). ExecutionTrace (UX-DR5) remains the authoritative detailed log; this is a complementary at-a-glance layer. Derived entirely from the existing polled trace data (AD-6) — no new endpoint, no new backend state. Colour is never the sole signal (UX-DR11): stage state also carries a label and a shape change.

### FR Coverage Map

FR1: Epic 1 - signal normalization
FR2: Epic 1 - 15-min correlation
FR3: Epic 1 - specialist agents
FR4: Epic 1 - arbiter synthesis
FR5: Epic 1 - retry/fallback on tool failure
FR6: Epic 1 - deterministic confidence score
FR7: Epic 1 - policy tier classification
FR8: Epic 1 - tier-based execution behavior
FR9: Epic 1 - DG/IMDG hard gate
FR10: Epic 1 - kill switch (incl. AD-15 blocked_by_kill_switch marking for Tier 1/2)
FR11: Epic 2 - approve/reject/select-alternative
FR12: Epic 2 - natural-language status query
FR13: Epic 1 - mock-service execution + verification
FR14: Epic 1 - execution trace
FR15: Epic 2 - trace viewable in dashboard
FR16: Epic 3 - concurrent incident proof
FR17: Epic 3 - Pasir Panjang load-balancing (stretch, ranked 2nd)
FR20: Epic 3 - AGV/Gate specialist agent (stretch, ranked 3rd)
FR19: Epic 3 - mocked MPA/digitalPORT@SG-style clearance check (stretch, ranked 5th)
FR18: Epic 3 - Weather Circuit-Breaker agent (stretch, ranked last/6th)

## Epic List

### Epic 1: Autonomous Incident Resolution
Portwatch detects a cross-system disruption, analyzes it from three specialist angles, computes an honest confidence score, and safely resolves it — auto-executing what's low-risk, blocking and escalating what isn't. Core golden path (UJ-1, UJ-3); stands alone.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR13, FR14, NFR1, NFR2, NFR3
**Also includes (AD-16):** a per-agent `MOCK_AGENTS` override so any specialist/arbiter call can be pinned to a canned response before/during the demo — defense-in-depth beyond FR5's automatic retry. A mock-forced call is always marked `mock_forced: true` in its trace entry and confidence-penalized like missing data (FR6), never presented as indistinguishable from a real call.

### Epic 2: Operator Visibility & Control
Operators watch incidents unfold on a dashboard, ask about any incident's status in plain language, and act on a Tier-3 approval card — approve, reject, or pick a different option — all built to the finalized UX spine (DESIGN.md/EXPERIENCE.md, canvas-exact visual identity). Also delivers a new Incident Archive screen for browsing resolved incidents. Builds on Epic 1's data but is a complete, standalone user-facing capability. **Minimum Day-4-demoable slice, if time runs short:** IncidentFeed + ApprovalBanner + ExecutionTrace (the primary operator workflow, UJ-1/UJ-3) — AskPortwatch, MapPanel, KillSwitchControl, and IncidentArchive are additive on top of that slice, not prerequisites for it.
**FRs covered:** FR11, FR12, FR15
**UX-DRs covered:** UX-DR1–UX-DR12

**Implementation note (from Problem Decomposition elicitation, confirmed as one epic, not split):** the 12 UX-DRs decompose into 4 dependency-ordered groups that set the intra-epic story sequence:
1. **Foundation** (UX-DR1, UX-DR2) — design tokens + blueprint panel primitive; no user value alone, must land first as every later story depends on it.
2. **Live Console core** (UX-DR3, UX-DR4, UX-DR5) — IncidentFeed, IncidentDetail/ApprovalBanner, ExecutionTrace; the primary operator workflow (UJ-1, UJ-3) — this is the Day-4 minimum demoable slice named above.
3. **Supporting panels** (UX-DR6, UX-DR7, UX-DR8) — AskPortwatch, MapPanel, KillSwitchControl; same screen, secondary surfaces.
4. **Archive** (UX-DR9) — new surface, reuses group 2's IncidentFeed/blueprint-panel components directly rather than duplicating them (kept in this epic, not split out, to avoid the same-files-across-epics anti-pattern).

UX-DR10 (state patterns), UX-DR11 (accessibility floor), and UX-DR12 (voice & tone) are cross-cutting — each is distributed into groups 2–4's stories as acceptance criteria, not written as standalone stories (a story like "be accessible" isn't independently testable).

### Epic 3: Proven at Scale
Portwatch resolves multiple simultaneous incidents without interference, and extends to a second terminal cluster (Pasir Panjang) using the same agents and policy engine, unchanged — direct evidence for the Scalability & Responsible AI judging criterion. **Stretch block (Day-5, strictly additive, ranked by the PRD's value/hour order — build only after FR16/FR17 and time permits):** disruption types beyond cargo/crane/yard, through the same trusted pipeline, proving the architecture generalizes rather than being purpose-built for one incident shape — an AGV/Gate specialist agent for gate-congestion signals (FR20, ranked third), a mocked meteorological-radar Weather agent (FR18, ranked last), and a mocked MPA-style clearance check (FR19, ranked last). Folded into this epic rather than kept as a separate peer epic (party-mode review, 2026-08-27): none of the three stretch items stand alone the way Epic 1-3's core FRs do — all three assume Epic 1-3's pipeline is already fully built and are ranked at or near the bottom of the PRD's Day-5 value/hour order, so treating them as a fourth co-equal epic overstated their independence. FR20 was minted during this same pass — the PRD named "AGV/Gate agent" in its Day-5 ranking without ever giving it an FR number; closed as an orphaned-requirement finding.
**FRs covered:** FR16, FR17, FR20, FR19, FR18

### Epic 4: Operator Visibility (demo-critical)
Added 2026-08-28 via `sprint-change-proposal-2026-08-28.md`. The console makes an in-flight incident legible at a glance — spatially (a real Singapore Strait / Tuas terminal map driven by mock incident state) and procedurally (a stage rail showing where in the agent pipeline the incident is). Additive, frontend-contained, reads only the existing polled trace data (AD-6 / AD-17). **Priority: P0 / demo-blocking — sequenced BEFORE Epic 3's Day-5 stretch items.** Does NOT touch the golden-path backend.
**FRs covered:** none new — realises UX-DR7 (revised), UX-DR13 (new), FR15.

---

## Epic 1: Autonomous Incident Resolution

Portwatch detects a cross-system disruption, analyzes it from three specialist angles, computes an honest confidence score, and safely resolves it — auto-executing what's low-risk, blocking and escalating what isn't.

### Story 1.1: Signal Ingestion & Normalization

As a Portwatch orchestrator,
I want incoming signals (vessel ETA changes, crane/equipment alerts, yard congestion metrics, gate queue metrics, weather events, DG exceptions, operator/user requests) normalized into a common incident representation,
So that every downstream stage (correlation, agents, policy) works against one consistent shape regardless of signal source.

**Acceptance Criteria:**

**Given** a raw signal of any supported type (vessel ETA, crane alert, yard metric, gate metric, weather event, DG exception, operator request)
**When** it is ingested
**Then** it is normalized into the common signal representation with `entity_refs` in the fixed id format (e.g. `vessel:MSC-ANNA`, `berth:C7-3`) per the Architecture Spine's cross-lane sync convention

**Given** a signal of an unrecognized or malformed type
**When** it is ingested
**Then** it is rejected with a logged reason rather than silently dropped or crashing ingestion

**Given** two signals of different types referencing the same entity (e.g. a crane alert and a yard congestion metric both for `berth:C7-3`)
**When** both are ingested
**Then** both normalize to the same `entity_refs` value, so correlation (Story 1.2) can match them

### Story 1.2: Incident Correlation via 15-Minute Window

As a Portwatch orchestrator,
I want related signals correlated into a single incident when they share an entity and occur within a 15-minute rolling window,
So that one real-world disruption produces one incident, not a scatter of unrelated ones (FR2, AD-5).

**Acceptance Criteria:**

**Given** a normalized signal whose `entity_refs` matches an open incident's `entity_refs` within the last 15 minutes
**When** the `IncidentRegistry` checks it before dispatch
**Then** the signal routes into that existing incident's orchestrator task, not a new one

**Given** a normalized signal whose `entity_refs` matches no open incident, or only matches one outside the 15-minute window
**When** the `IncidentRegistry` checks it
**Then** a new incident and orchestrator task are spawned for it

**Given** a signal that matches entities belonging to two different currently-open incidents (e.g. a vessel signal that references both a berth and a crane already tracked separately)
**When** correlation runs
**Then** the signal routes to the incident matching on the entity type it was ingested against (deterministic single-match rule — no signal fans out to multiple incidents), and this tie-break rule is documented in code, not left to be invented per-call

**Given** an incident with no new signals for over 15 minutes
**When** a new signal arrives referencing that incident's entity
**Then** it is treated as a new incident, not appended to the stale one

### Story 1.3: Specialist Agent Analysis (Berth/Crane/Yard)

As a Portwatch orchestrator,
I want the Berth/Vessel, Crane, and Yard specialist agents to run as independent, parallel LLM calls with scoped tool access,
So that each incident gets three expert-angle recommendations without any agent overstepping its role (FR3, AD-2, AD-3, AD-13).

**Acceptance Criteria:**

**Given** an incident ready for analysis
**When** the orchestrator dispatches to the specialist agents
**Then** Berth, Crane, and Yard agents are called concurrently via `asyncio.gather` (AD-13), each as a direct Anthropic Messages API call (AD-2, `claude-sonnet-5`), not sequential awaits

**Given** any specialist agent's API call
**When** the call is constructed
**Then** only tools listed in that agent's static manifest (AD-3) are passed in — e.g. the Berth agent's call never includes Yard Manager's tool schema

**Given** all three specialist agents complete
**When** the orchestrator collects results
**Then** each returns a structured recommendation + constraints in a consistent shape the arbiter (Story 1.4) can consume

**Given** the combined specialist-agent stage
**When** measured end-to-end under demo conditions
**Then** it fits within the shared ~20-30s golden-path budget (NFR1) alongside the other pipeline stages

### Story 1.4: Arbiter Synthesis of Recovery Options

As an operator,
I want the specialist agents' outputs synthesized into 2-3 ranked recovery options with predicted impact,
So that I see a small, prioritized set of real choices instead of three disconnected opinions (FR4).

**Acceptance Criteria:**

**Given** three specialist-agent recommendations for one incident
**When** the arbiter agent (a separate Messages API call, AD-2) synthesizes them
**Then** it returns 2-3 ranked `RecoveryOption` entries, each with `option_id`, `description`, `predicted_impact` (delay_min, cost, yard_impact, risk), `reversible`, and `dg_involved` — matching the Architecture Spine's shared data shape exactly

**Given** the specialist agents' recommendations conflict with each other (e.g. Berth suggests a delay, Yard suggests an immediate reroute that assumes no delay)
**When** the arbiter synthesizes
**Then** the resulting options still cover the disagreement in `description`/`predicted_impact` rather than silently picking one side, and the conflict is flagged for Story 1.6's confidence formula to penalize

**Given** fewer than 2 distinct viable options can be constructed (e.g. specialist agents agree there's exactly one sane action)
**When** the arbiter synthesizes
**Then** it returns 1 option rather than fabricating a second to hit a count, and this is not treated as an error

### Story 1.5: Tool Retry & Fallback on Failure

As a Portwatch orchestrator,
I want a single retry then a fallback to last-known state on tool timeout/failure,
So that one flaky mock-service call degrades the incident gracefully instead of blocking or crashing it (FR5, AD-13, NFR3).

**Acceptance Criteria:**

**Given** a tool call (specialist agent's tool use, or a mock-service call) that times out or fails
**When** the orchestrator handles the failure
**Then** exactly one retry is attempted, using a short fixed timeout (AD-13), not the client's default timeout

**Given** the retry also times out or fails
**When** the orchestrator continues
**Then** it falls back to the entity's last-known cached state, reduces confidence (Story 1.6), and logs the reason in the trace (Story 1.12) — the incident continues, it does not crash

**Given** a tool call fails on an entity with no prior last-known state (first-ever call for that entity)
**When** fallback is attempted
**Then** the orchestrator uses a defined empty/neutral state (not a crash or an unhandled exception) and confidence reflects the missing-data case at maximum penalty

**Given** a successful retry (failed once, succeeded on the second attempt)
**When** the orchestrator records the outcome
**Then** the trace entry sets `retried: true`, `fallback_used: false` — success-after-retry is distinguished from fallback-after-exhausted-retry

### Story 1.6: Deterministic Confidence Scoring

As an operator,
I want confidence to be a computed, deterministic score rather than an LLM's self-assessment,
So that I can trust the number reflects actual data quality and agreement, not a model's guess (FR6).

**Acceptance Criteria:**

**Given** an incident with fresh telemetry and no fallbacks or disagreement
**When** confidence is computed
**Then** it starts at 100 and no penalties apply

**Given** telemetry older than the freshness threshold
**When** confidence is computed
**Then** it is reduced 1pt per 10s of staleness beyond fresh, capped at -20

**Given** a required field using fallback/cached state (from Story 1.5)
**When** confidence is computed
**Then** it is reduced 15pt per such field

**Given** specialist agents' recommendations conflict (per Story 1.4)
**When** confidence is computed
**Then** a flat -10pt disagreement penalty applies once, not per conflicting pair

**Given** the arbiter's recovery options have a predicted-outcome spread exceeding 30%
**When** confidence is computed
**Then** a flat -10pt variance penalty applies

**Given** any combination of the above penalties
**When** confidence is computed
**Then** the score is the deterministic sum of applicable penalties subtracted from 100, never an LLM-reported or LLM-adjusted number, and the computation is unit-testable independent of any live API call

### Story 1.7: Policy Tier Classification

As an operator,
I want the selected recovery option classified into Tier 1/2/3 by a deterministic policy engine outside LLM authority,
So that autonomy is granted based on fixed, auditable rules, never a model's judgment call (FR7).

**Acceptance Criteria:**

**Given** a recovery option that is reversible, has no SLA breach, LOW safety risk, confidence >= 85, LOW cost, and no DG involvement
**When** the policy engine classifies it
**Then** it is Tier 1

**Given** a recovery option that is reversible, has no SLA breach, safety risk <= MEDIUM, confidence >= 70, cost <= MEDIUM, and no DG involvement, but does not meet Tier 1's stricter thresholds
**When** the policy engine classifies it
**Then** it is Tier 2

**Given** a recovery option that fails any Tier 1 or Tier 2 condition (irreversible, SLA breach, HIGH safety risk, confidence below Tier 2's floor, HIGH cost, or DG involvement)
**When** the policy engine classifies it
**Then** it is Tier 3

**Given** the same recovery option and inputs evaluated twice
**When** the policy engine runs
**Then** it returns the same tier both times — classification is pure/deterministic, with no model call in its decision path

### Story 1.8: Tier-Based Execution Behavior

As an operator,
I want Tier 1 to auto-execute silently, Tier 2 to auto-execute and notify, and Tier 3 to block for my approval,
So that autonomy scales with how safe and reversible the action is (FR8).

**Acceptance Criteria:**

**Given** a Tier 1 classified recovery option
**When** the policy decision completes
**Then** it auto-executes against the relevant mock service(s) with no notification interruption

**Given** a Tier 2 classified recovery option
**When** the policy decision completes
**Then** it auto-executes and a notification is generated (non-blocking)

**Given** a Tier 3 classified recovery option
**When** the policy decision completes
**Then** execution is blocked and a structured decision card is produced containing situation, recommendation, predicted impact, confidence, and alternatives — no execution occurs until Epic 2's approval flow resolves it

### Story 1.9: DG/IMDG Hard Gate & Re-plan Loop

As an operator,
I want DG/IMDG segregation enforced as a hard gate independent of tier, even after a tier-approved recommendation,
So that a dangerous-goods violation can never slip through because a tier was already decided (FR9, AD-8).

**Acceptance Criteria:**

**Given** a recovery option that has passed `POLICY_DECISION` at any tier
**When** the DG/IMDG check runs before execution
**Then** a violation forces the incident back to the arbiter for a new recovery option, re-classified through `POLICY_DECISION` and `DG_CHECK` again

**Given** a DG conflict has already looped back once
**When** a second DG conflict occurs on the re-planned option
**Then** it loops back a second time (2 total re-plan attempts, per AD-8)

**Given** a third DG conflict occurs after 2 re-plan attempts
**When** the DG gate evaluates it
**Then** the incident is forced to Tier 3 for human escalation regardless of the option's own computed tier, and the loop does not continue indefinitely

**Given** a rejected option due to a DG conflict
**When** it is shown anywhere downstream (trace, and later Epic 2's UI)
**Then** it is recorded with its DG-gate rejection reason, not silently discarded

### Story 1.10: Global Kill Switch

As an operator,
I want a single global kill switch that immediately disables all autonomous execution,
So that I have one reliable control to halt Portwatch regardless of what's in flight (FR10, AD-7, AD-15).

**Acceptance Criteria:**

**Given** the kill switch is engaged
**When** any Tier 1 or Tier 2 decision reaches the AD-7 enforcement point (immediately before mock-service execution)
**Then** execution does not proceed

**Given** a Tier 1/2 decision blocked by the kill switch
**When** the orchestrator records the outcome
**Then** it sets `Incident.blocked_by_kill_switch: true` (tier is NOT reclassified to 3) and appends a trace entry marked accordingly (AD-15)

**Given** the kill switch is disengaged after having blocked a decision
**When** the operator takes the existing Approve action on that incident
**Then** the flag is re-checked and execution proceeds if now clear — no new endpoint is introduced

**Given** the kill switch flag
**When** checked across the pipeline
**Then** it is checked at exactly one point (immediately before mock-service execution) — never at ingestion, correlation, or analysis (AD-7)

### Story 1.11: Mock Service Execution & Verification

As an operator,
I want every approved/auto action executed against mock services with individual verification, and failures recorded rather than treated as silent success,
So that I can trust that "resolved" actually means the action succeeded (FR13, NFR2).

**Acceptance Criteria:**

**Given** an approved or auto-executed recovery option
**When** it is executed
**Then** each mock service call uses the shared `async def execute(action: dict) -> {ok, result, error}` contract (TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager, Notification incl. MPA, DG Checker)

**Given** a mock service call returns `ok: false` or raises
**When** the orchestrator processes the result
**Then** the failure is recorded in the trace with its `error` — never silently treated as success

**Given** an action composed of multiple mock-service calls
**When** one call succeeds and another fails
**Then** each is verified and recorded individually, not rolled up into one pass/fail result

### Story 1.12: Execution Trace Recording

As an operator,
I want every incident to produce a structured, timestamped execution trace covering the full pipeline,
So that I can audit exactly what happened and why, including retries, failures, and confidence degradation (FR14, AD-4, AD-14, NFR1).

**Acceptance Criteria:**

**Given** an incident progressing through the pipeline
**When** each stage transition occurs (INGEST, CORRELATE, AGENT_CALL, SYNTHESIZE, CONFIDENCE, POLICY_DECISION, DG_CHECK, APPROVAL, EXECUTE, VERIFY)
**Then** a trace entry is appended with `stage`, ISO 8601 UTC `timestamp`, and stage-specific `detail`, regardless of whether that stage succeeded or failed

**Given** a stage failure, retry, or fallback
**When** the trace entry is written
**Then** `error: {stage, error, retried, fallback_used}` is populated per the Consistency Conventions error shape — never omitted

**Given** the trace list for an incident
**When** appended to
**Then** only the incident's own orchestrator task writes to it (AD-4) — trace is append-only, never rewritten or reordered

**Given** a golden-path incident from ingest to policy decision
**When** timed end-to-end under demo conditions
**Then** it completes in ~20-30s (NFR1), with the trace showing timestamps consistent with that budget

### Story 1.13: Per-Agent Demo-Safety Mock Override

As an operator,
I want to pin any specialist agent or the arbiter to a canned response instead of a live LLM call, with that substitution always visible and confidence-penalized,
So that I can pull a misbehaving agent out of the live-LLM path during a demo without the audience or the trace being misled about what actually ran (AD-16).

**Acceptance Criteria:**

**Given** `MOCK_AGENTS.<agent>` is set to true for a given agent (berth/crane/yard/arbiter)
**When** that agent would normally be called
**Then** the Messages API call is short-circuited and a canned, structurally-identical response is returned instead — every downstream stage (correlation, policy, execution) consumes it exactly as it would a real response

**Given** a mock-forced call occurs
**When** its `AGENT_CALL` trace entry is written
**Then** `detail.mock_forced: true` is set — the substitution is never indistinguishable from a real call in the trace

**Given** a mock-forced call occurs
**When** confidence (Story 1.6) is computed for that incident
**Then** the same -15pt missing-data penalty applies as for a fallback/cached-state field — a canned response is never treated as equivalent to real data

**Given** `MOCK_AGENTS` is unset or false for all agents
**When** the pipeline runs
**Then** behavior is identical to before AD-16 existed — the override is opt-in only, never a default

---

## Epic 2: Operator Visibility & Control

Operators watch incidents unfold on a dashboard, ask about any incident's status in plain language, and act on a Tier-3 approval card, all built to the finalized UX spine (DESIGN.md/EXPERIENCE.md).

### Story 2.1: Design Token System

As a developer building any Portwatch frontend component,
I want DESIGN.md's exact token set implemented as the shared theme,
So that every component looks visually consistent without each one reinventing colors, type, or spacing (UX-DR1).

**Acceptance Criteria:**

**Given** the frontend theme is initialized
**When** any heading, label, data value, or button renders
**Then** it uses Barlow Condensed (600); body text uses Barlow (400)

**Given** any surface needing accent color
**When** styled
**Then** it draws from the steel-blue accent ramp (`#5980a6` family, 100-900) or `accent-2` (`#728fab`), never an ad hoc color value

**Given** any shape in the UI
**When** rendered
**Then** it uses zero border-radius, except the 3px tag radius, applied consistently

**Given** any panel padding or spacing value
**When** applied
**Then** it derives from the 3.4px base spacing scale (10-18px panel padding), not an arbitrary pixel value

### Story 2.2: Blueprint Panel Primitive

As a developer building any incident-related surface,
I want a reusable blueprint panel component,
So that every card (incident, approval, trace, map) shares one consistent visual container instead of each being styled separately (UX-DR2).

**Acceptance Criteria:**

**Given** the blueprint panel component
**When** rendered
**Then** it has a 1px divider border, zero border-radius, and four 11px crosshair corner marks at each corner

**Given** any of: an incident card, the approval card, the trace log, or a map panel
**When** implemented
**Then** each uses this shared component rather than a one-off styled container

### Story 2.3: IncidentFeed

As an operator,
I want a reverse-chronological feed of incidents with clear status indicators,
So that I can see what's happening across the port at a glance and immediately spot what needs my attention (UX-DR3, part of the Day-4 minimum demoable slice).

**Acceptance Criteria:**

**Given** the incident feed
**When** rendered
**Then** incidents are listed reverse-chronologically, each with a 7x7px accent status dot (light accent = Tier 1/2, `accent-900` = Tier 3 pending) and, if in progress, a 2px progress bar (neutral-300 track, accent-600 fill)

**Given** one or more incidents are Tier-3-pending
**When** the feed sorts
**Then** those rows sort to the top, above recency — never buried by a more recent Tier 1/2 incident

**Given** an incident resolves automatically at Tier 1
**When** its row updates
**Then** it shows a quiet tag only, no interruption (UX-DR10)

**Given** an incident auto-resolves at Tier 2
**When** its row updates
**Then** it shows a small non-sound notification badge (UX-DR10)

**Given** an incident's confidence is degraded (fallback, disagreement, variance, or a Story 1.13 mock-forced call)
**When** its row or detail view renders
**Then** an inline plain-language reason is shown, not just a lower number (UX-DR10)

**Given** the incident API is stale or unreachable
**When** the feed can't get a fresh read
**Then** a small "last updated Xs ago" indicator shows — never a blocking error screen (UX-DR10)

**Given** two or more incidents are open concurrently (FR16)
**When** the operator interacts with the feed
**Then** each remains independently selectable without one incident's state affecting another's row (UX-DR10, FR16 proof at the UI level)

**Given** any interactive element in the feed
**When** navigated via Tab/Enter/Space
**Then** it is fully operable without a mouse, with a visible AA-contrast focus ring (UX-DR11)

**Given** severity or tier is conveyed
**When** rendered
**Then** it is never color alone — label text + shape + `accent-900` together (UX-DR11)

**Given** any incident's summary text
**When** displayed
**Then** it reads plain and factual per EXPERIENCE.md's Do/Don't table (e.g. "MSC Anna — ETA slipped 90 min," never "CRITICAL DISRUPTION" or escalating emoji) (UX-DR12)

### Story 2.4: IncidentDetail + ApprovalBanner

As an operator,
I want a persistent, clear approval card for any Tier-3 recommendation, and the ability to approve, reject, or pick a different option,
So that I stay in control of risky decisions without the system stalling or defaulting on a timeout (UX-DR4, FR11, part of the Day-4 minimum demoable slice).

**Acceptance Criteria:**

**Given** an incident reaches Tier 3
**When** the approval card first appears
**Then** it uses `aria-live="assertive"` on that first appearance only (not on every re-render), with a pulsing status dot, and shows situation, recommendation, predicted impact, and confidence with its degradation reason when applicable

**Given** a recovery option was rejected by the DG gate during re-planning (Story 1.9)
**When** shown in the approval card
**Then** it appears struck through with its DG-gate reason, not hidden

**Given** the approval card is showing
**When** time passes with no operator action
**Then** it remains visible with no auto-dismiss and no timeout-driven default action

**Given** the operator clicks Approve
**When** the action is sent
**Then** `POST /incidents/{incident_id}/approval` is called with `action: "approve"` (AD-11)

**Given** the operator clicks Reject
**When** the action is sent
**Then** the same endpoint is called with `action: "reject"`

**Given** the operator wants a different ranked option
**When** they select one
**Then** the endpoint is called with `action: "select_alternative", option_id: <id>` — never a free-form edit payload (AD-11)

**Given** a Tier 1/2 incident is blocked by the kill switch (`blocked_by_kill_switch: true`, AD-15)
**When** its detail view renders
**Then** it shows a "needs manual action — kill switch engaged" tag, resolved via the same existing Approve action (UX-DR10)

**Given** any control in the approval card
**When** navigated via Tab/Enter/Space
**Then** Approve/Reject/Modify are all fully operable without a mouse (UX-DR11)

**Given** the approval card's microcopy
**When** written
**Then** it uses the same plain, non-alarmist register as a Tier 1 footnote — no escalating tone for a Tier 3 banner (UX-DR12)

### Story 2.5: ExecutionTrace Viewer

As an operator,
I want to view an incident's full execution trace in the dashboard,
So that I can audit exactly what happened, including retries, failures, and confidence changes, without digging through logs (UX-DR5, FR15, completes the Day-4 minimum demoable slice).

**Acceptance Criteria:**

**Given** an incident is selected
**When** its trace is viewed
**Then** it renders with `role="log" aria-live="polite"`, rows in reverse-chronological order, each keyed to the SCREAMING_SNAKE stage vocabulary (INGEST/CORRELATE/AGENT_CALL/SYNTHESIZE/CONFIDENCE/POLICY_DECISION/DG_CHECK/APPROVAL/EXECUTE/VERIFY)

**Given** a trace row represents an error, retry, or fallback
**When** rendered
**Then** it shows an `accent-900` dot marker and bolder text, distinguishing it from a normal-outcome row

**Given** a trace row has `detail.mock_forced: true` (Story 1.13)
**When** rendered
**Then** it is visibly annotated (e.g. "response mocked for demo stability"), never presented identically to a live-call row

**Given** the trace viewer
**When** navigated via keyboard
**Then** it is fully operable per the accessibility floor (UX-DR11), and error rows are distinguished by more than color alone

### Story 2.6: AskPortwatch Natural-Language Query

As any user,
I want to ask about any incident's status in plain language without needing to select it first,
So that I can quickly check on something specific (e.g. "where's MSC Anna") without navigating the feed (UX-DR6, FR12).

**Acceptance Criteria:**

**Given** the AskPortwatch input
**When** a free-text question is submitted with no incident selected
**Then** `GET /incidents/query?q=...` is called without an `incident_id`, and the backend resolves the relevant incident entirely from the text (FR12, matches UJ-2)

**Given** an incident is currently selected in the feed
**When** a question is submitted
**Then** the optional `incident_id` hint is included as a convenience, but the backend still works correctly if it's omitted

**Given** a query with no confident match
**When** answered
**Then** the response is grounded and honest about the lack of a match, never a fabricated incident status

**Given** suggestion chips are shown
**When** clicked
**Then** they populate and submit a valid query in the same way as free text

### Story 2.7: MapPanel

As an operator,
I want an illustrative strait/yard map panel,
So that I have spatial context for an incident without mistaking it for live vessel tracking (UX-DR7).

**Acceptance Criteria:**

**Given** the map panel
**When** rendered
**Then** it appears inside the shared blueprint panel component (Story 2.2), read-only

**Given** the map panel's caption
**When** displayed
**Then** it explicitly states positions are illustrative, not live AIS — never implies real-time vessel tracking

### Story 2.8: KillSwitchControl

As an operator,
I want a persistent, always-visible kill switch control with a deliberate engage step,
So that I can reliably halt all autonomous execution, and can't do so by accident (UX-DR8).

**Acceptance Criteria:**

**Given** the kill switch control
**When** the dashboard renders
**Then** it appears in the persistent header, never nested in a menu

**Given** the operator wants to engage the kill switch
**When** they interact with the control
**Then** it requires two steps (toggle + inline confirm) before engaging

**Given** the kill switch is already engaged
**When** the operator wants to disengage it
**Then** one step is sufficient

**Given** the kill switch is engaged
**When** any screen is viewed
**Then** a persistent global banner is shown (UX-DR10), in addition to any per-incident `blocked_by_kill_switch` tags (Story 2.4)

**Given** the operator toggles the control
**When** the action is sent
**Then** `POST /kill-switch {enabled: bool}` is called (AD-7)

### Story 2.9: Incident Archive Route

As an operator,
I want to browse resolved incidents in a separate archive view,
So that I can review past incidents without cluttering the live feed (UX-DR9).

**Acceptance Criteria:**

**Given** the Incident Archive route
**When** loaded
**Then** it filters `GET /incidents` client-side to resolved incidents only — no new endpoint is introduced

**Given** the archive list
**When** rendered
**Then** it reuses the IncidentFeed row and blueprint-panel styling (Story 2.2, 2.3), adding a resolution-outcome tag: Auto-resolved / Approved / Rejected

**Given** an archived incident is opened
**When** its trace is viewed
**Then** it renders read-only (reusing Story 2.5's ExecutionTrace component) with no approval actions available

**Given** there are no resolved incidents yet
**When** the archive is viewed
**Then** a plain one-line empty-state message is shown, not a blank screen or an error (UX-DR10)

---

## Epic 3: Proven at Scale

Portwatch resolves multiple simultaneous incidents without interference, and extends beyond a single terminal/incident type using the same agents and policy engine, unchanged.

### Story 3.1: Concurrent Incident Proof

As an operator,
I want two or more incidents to be triggered and resolved concurrently without blocking each other,
So that Portwatch handles a realistic multi-disruption day, not just one incident at a time (FR16, core).

**Acceptance Criteria:**

**Given** two signals for unrelated entities arrive close together
**When** they are ingested
**Then** two separate orchestrator tasks run concurrently, each owning its own `Incident` record (AD-4), with no shared mutable state between them

**Given** two incidents are both mid-pipeline at the same time
**When** one incident's specialist agents are slow or fail-and-retry (Story 1.5)
**Then** the other incident's processing is unaffected — no blocking across incidents

**Given** two concurrent incidents both reach Tier 3 at roughly the same time
**When** the operator views the dashboard
**Then** both appear as independently actionable approval cards (Story 2.4), each resolvable without affecting the other

**Given** the demo needs to show this live
**When** two incidents are triggered back-to-back
**Then** both resolve correctly and independently within the same demo session, proving FR16 is real behavior, not just a design claim

### Story 3.2: Pasir Panjang Load Balancing

As an operator,
I want the arbiter to propose routing container flow to Pasir Panjang when Tuas yard utilization is high,
So that Portwatch demonstrates it extends to a second terminal cluster without redesigning the pipeline (FR17, Day-5 stretch, ranked 2nd).

**Acceptance Criteria:**

**Given** the Yard Manager mock already models both Tuas Block C7 and Pasir Panjang Block P2 (AD-12, built from day 1)
**When** Tuas yard utilization is high
**Then** the arbiter's synthesized recovery options include routing a portion of container flow to Pasir Panjang instead of further loading Tuas

**Given** this routing recommendation is produced
**When** it flows through the pipeline
**Then** it reuses the existing Yard Agent, arbiter, and policy engine completely unchanged — no new agent, tier rule, or pipeline stage

**Given** the dashboard is viewed
**When** either block's utilization changes
**Then** both Tuas C7 and Pasir Panjang P2 utilization are shown, and the recommended option's description names the terminal

**Given** Tuas utilization is not high
**When** the arbiter synthesizes options
**Then** no Pasir Panjang routing option is forced in — it only appears when the utilization condition warrants it

### Story 3.3: AGV/Gate Specialist Agent

As an operator,
I want an AGV/Gate specialist agent that analyzes gate-queue and AGV-congestion signals and proposes recovery options,
So that gate/AGV congestion is handled by the same trusted pipeline as berth/crane/yard disruptions (FR20, Day-5 stretch, ranked 3rd).

**Acceptance Criteria:**

**Given** a gate-queue or AGV-congestion signal is ingested (Story 1.1)
**When** analysis runs
**Then** an AGV/Gate specialist agent, built on the same specialist-agent pattern as Berth/Crane/Yard (Story 1.3: direct Messages API call, scoped tool manifest), analyzes it and returns a structured recommendation

**Given** the AGV/Gate agent's recommendation
**When** it reaches the arbiter (Story 1.4)
**Then** it is synthesized into ranked recovery options (e.g. adjusting gate appointment slots, rerouting AGV traffic) using the existing AGV Manager and Gate Manager mocks (FR13) — no new mock-service contract

**Given** an AGV/Gate-sourced recovery option
**When** it reaches confidence scoring, policy classification, and execution
**Then** it passes through Stories 1.6, 1.7, 1.8, and 1.11 completely unchanged — no new pipeline stage or tier rule specific to this agent

### Story 3.4: Mocked MPA Clearance Check

As an operator,
I want a mocked MPA-style clearance check modeled on digitalPORT@SG's workflow shape,
So that the pitch can show a compliance-interoperability angle without any live external dependency (FR19, Day-5 stretch, ranked 5th).

**Acceptance Criteria:**

**Given** an action that would benefit from an MPA clearance check
**When** it is evaluated
**Then** a mocked clearance-check mock service (request → clearance status → conditions) is called, added to the existing mock roster alongside the DG Checker (FR13) — using the same `execute(action) -> {ok, result, error}` contract as every other mock

**Given** the MPA clearance mock
**When** implemented
**Then** it makes no live calls to digitalPORT@SG or any real MPA system — mocked only, consistent with the Out-of-Scope exclusion of real PSA/external integrations

**Given** the clearance check result
**When** it affects a recovery option
**Then** it flows through the existing policy/execution path unchanged — no new tier rule

### Story 3.5: Weather Circuit-Breaker Agent

As an operator,
I want a Weather agent that detects severe convective weather and proposes safety-first recovery options,
So that Portwatch demonstrates it generalizes to a disruption type with real physical-safety stakes, still gated by the same tiering (FR18, Day-5 stretch, ranked last).

**Acceptance Criteria:**

**Given** a mocked meteorological-radar feed signals severe convective weather within a 30-minute detection window
**When** it is ingested
**Then** a Weather agent, reusing the existing specialist-agent pattern (Story 1.3), proposes: locking anti-typhoon pins on affected Tuas cranes, rerouting AGVs to flood-safe staging zones, and a natural-language schedule-adjustment notice to affected shipping lines

**Given** a Weather agent's recovery option involves crane-pin locking or AGV rerouting (high physical-safety stakes)
**When** it is classified by the policy engine (Story 1.7)
**Then** it routes to Tier 3 for human approval — never silent auto-execute, regardless of confidence or cost

**Given** the Weather agent's output
**When** it reaches confidence, policy, and execution
**Then** it uses the exact same formula, tier rules, and execution path as any other recovery option — no weather-specific carve-out in the deterministic layers

---

## Epic 4: Operator Visibility (demo-critical)

Added 2026-08-28 via `sprint-change-proposal-2026-08-28.md` (Correct Course). The console makes an in-flight incident legible at a glance — spatially and procedurally. Additive, frontend-contained, reads only the existing polled trace data. **P0 / demo-blocking — sequenced before Epic 3's Day-5 stretch items.** Does NOT touch the golden-path backend (see Architecture Spine AD-17).

Implementation: **Option A — d3-geo vector basemap** (real Singapore Strait coastline from bundled TopoJSON, Mercator-fit; markers = token-coloured SVG primitives). This is the approach the design canvas `pw-map.js` already specifies ("real Natural Earth geometry via d3-geo … no tiles … mocked positions, not a live AIS feed"). No runtime network call. Story 2.7's `MapPanel` is retained as the yard/plan schematic and as the no-incident-selected fallback.

**Realises:** UX-DR7 (revised 2026-08-28), UX-DR13 (new), FR15.

### Story 4.1: Geographic MapPanel

As an operator,
I want the map to show the real Singapore Strait / Tuas terminal with the selected incident's affected entities marked,
So that I can see where an incident is happening — without it being, or implying, a live vessel-tracking feed.

**Acceptance Criteria:**

**Given** the Live Console renders and an incident is selected
**When** the map draws
**Then** it shows a real bundled Strait/terminal basemap with token-coloured markers for that incident's affected berth / crane / yard block / vessel, positioned from `frontend/src/lib/geo.ts`

**Given** the selected incident's trace advances
**When** the map re-renders on the next 2–3s poll
**Then** affected-entity markers reflect the current pipeline stage (e.g. analysing → action applied), colour never the sole signal (label + shape too)

**Given** either map variant
**When** the caption is shown
**Then** it contains "illustrative" and "not live AIS", contains none of `real-time` / `live positions` / `tracking` / `current location`, and adds that positions are mock incident state — assertions carried verbatim from Story 2.7's test

**Given** the rendered map
**When** it is inspected
**Then** it is a single `role="img"` node with a full-sentence text equivalent, **no runtime network request is made** (asserted with a `fetch` spy), and `npm run verify` (lint + build + test) stays green

**Given** no incident is selected
**When** the console renders
**Then** the map shows the basemap with no incident markers (degraded-safe; matches Story 2.7's default behaviour)

### Story 4.2: Agent-action stage rail

As an operator,
I want a compact stage rail showing where the selected incident is in the agent pipeline,
So that I can follow what the AI is doing without reading the full trace log.

**Acceptance Criteria:**

**Given** a selected incident
**When** its trace is polled
**Then** a stage rail renders the pipeline stages (INGEST … VERIFY) with reached stages marked done, the current stage active, and error stages marked with label + shape (not colour alone) — derived only from trace entries

**Given** the incident completes
**When** VERIFY is reached
**Then** the rail shows the terminal state and ExecutionTrace (UX-DR5) remains the authoritative detailed log — unchanged

**Given** the rail
**When** navigated by keyboard / screen reader
**Then** each stage is announced with its state; the rail adds no new interactive controls

**Given** App-level tests
**When** they run
**Then** the composed console renders the rail + map for a selected fixture incident and updates on selection change
