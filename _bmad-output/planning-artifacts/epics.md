---
stepsCompleted: [1, 2]
inputDocuments:
  - "_bmad-output/planning-artifacts/prds/prd-PSA-CODE-SPRINT-2026-08-24/prd.md"
  - "_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md"
---

# Portwatch - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Portwatch, decomposing the requirements from the PRD and Architecture Spine into implementable stories. No UX design contract exists for this project (skipped — hackathon scope).

## Requirements Inventory

### Functional Requirements

FR1: Normalize inputs (vessel ETA changes, crane/equipment alerts, yard congestion metrics, gate queue metrics, weather events, DG exceptions, operator/user requests) into a common incident representation.
FR2: Correlate related signals into a single incident when they share an entity (same vessel/berth/crane/yard block) and occur within a 15-minute rolling window of each other.
FR3: Berth/Vessel, Crane, and Yard specialist agents run as independent, parallel LLM calls, each with scoped tool access, each returning a structured recommendation + constraints.
FR4: A separate Portwatch arbiter agent synthesizes specialist outputs into 2-3 ranked recovery options with predicted impact (delay, cost, yard impact, risk).
FR5: On tool timeout/failure: retry once, then fall back to last-known state and reduce confidence, logging the reason.
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
- Shared data shapes fixed in the spine: `Incident`, `RecoveryOption`, `TraceEntry` (see Structural Seed section of ARCHITECTURE-SPINE.md) — stories must conform to these field names.
- API seed fixed in the spine: `GET /incidents`, `GET /incidents/{incident_id}`, `POST /incidents/{incident_id}/approval`, `GET /incidents/query`, `POST /kill-switch`.
- Mock-service call contract: every mock exposes one `async def execute(action: dict) -> {ok, result, error}`, with an injectable timeout/failure mode (FR5 demo requirement).
- Stack: Python 3.12+ / FastAPI ~0.141.x backend; React 19.2.8 / TypeScript / Vite 8.1.3 frontend.
- Build plan constraint (PRD Section 10): Day 3 = golden path hard-freeze; Day 5 = stretch only (FR17, AGV/Gate agent, 2-concurrent-incidents demo), strictly additive.

### UX Design Requirements

None — no UX design contract was produced for this project (hackathon scope; bmad-ux was intentionally skipped).

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
FR10: Epic 1 - kill switch
FR11: Epic 2 - approve/reject/select-alternative
FR12: Epic 2 - natural-language status query
FR13: Epic 1 - mock-service execution + verification
FR14: Epic 1 - execution trace
FR15: Epic 2 - trace viewable in dashboard
FR16: Epic 3 - concurrent incident proof
FR17: Epic 3 - Pasir Panjang load-balancing (stretch)
FR18: Epic 4 - Weather Circuit-Breaker agent (stretch, ranked last)
FR19: Epic 4 - mocked MPA/digitalPORT@SG-style clearance check (stretch, ranked last)

## Epic List

### Epic 1: Autonomous Incident Resolution
Portwatch detects a cross-system disruption, analyzes it from three specialist angles, computes an honest confidence score, and safely resolves it — auto-executing what's low-risk, blocking and escalating what isn't. Core golden path (UJ-1, UJ-3); stands alone.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR13, FR14, NFR1, NFR2, NFR3

### Epic 2: Operator Visibility & Control
Operators watch incidents unfold on a dashboard, ask about any incident's status in plain language, and act on a Tier-3 approval card — approve, reject, or pick a different option. Builds on Epic 1's data but is a complete, standalone user-facing capability.
**FRs covered:** FR11, FR12, FR15

### Epic 3: Proven at Scale
Portwatch resolves multiple simultaneous incidents without interference, and extends to a second terminal cluster (Pasir Panjang) using the same agents and policy engine, unchanged. Direct evidence for the Scalability & Responsible AI judging criterion.
**FRs covered:** FR16, FR17

### Epic 4: Extended Incident Coverage (Day-5 stretch, ranked last)
Portwatch handles disruption types beyond cargo/crane/yard — a sudden severe-weather event and an MPA-style compliance check — through the same trusted pipeline, proving the architecture generalizes rather than being purpose-built for one incident shape.
**FRs covered:** FR18, FR19
