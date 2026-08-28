---
title: Portwatch PRD
status: final
created: 2026-08-24
updated: 2026-08-24
---

# Portwatch — PRD

**AI-powered disruption orchestration for Tuas Port**
Scoped for: PSA Code Sprint hackathon (6-day build, 4-person team). This PRD is scoped purely to win the hackathon — not a roadmap for a shipped product.

## 1. Problem & Vision

**Problem.** Tuas Port's automation runs deep *within* individual systems — automated quay cranes, AGVs, automated yard cranes, AI-supported yard planning. But operational disruptions do not respect system boundaries: a delayed vessel cascades into berth, crane, yard, and AGV consequences that no single system sees or owns end to end. Operators must manually correlate signals across systems and judge which decisions are safe to delegate and which require a human — under time pressure, mid-incident.

**Vision.** Portwatch is a multi-agent disruption orchestration layer that detects, correlates, analyses and responds to cross-system incidents — auto-executing what's safe, escalating what isn't, and leaving a complete auditable trace of every decision. It augments PSA's existing automation rather than replacing it.

**Why Singapore specifically.** Singapore's port ecosystem is harder to orchestrate than a generic automated terminal: over 80% of cargo is transshipment (box-to-box, ship-to-ship, not simple import/export), operations span physically separate terminal clusters (Tuas and Pasir Panjang) that must balance capacity against each other, vessel movements sit inside one of the world's densest and most heavily regulated straits, and MPA compliance touchpoints run through the whole operation. Portwatch's cross-system correlation and tiered-autonomy model is built for exactly that kind of fragmented, high-stakes environment — not a generic incident-response template with port nouns swapped in.

**Hackathon deliverable rubric** (source of truth for scope and success): the solution must process inputs — event log, state change, operational alert, process metric, or user request — and demonstrate: analysing the input to identify the objective/issue; determining an appropriate course of action; orchestrating relevant tools/systems/workflows; handling uncertainty, incomplete information, and tool failures; invoking human review/approval/escalation where appropriate; and producing a clear execution trace covering key decisions, tool calls, approvals, actions, results, and errors. Deliverables: a demo video (≤10 min), presentation slides (≤10), and an explanation of architecture, execution flow, key decisions, potential impact, and security/safety/scalability considerations.

Judging criteria targeted: Agentic AI Design & Technical Execution; Innovation & Originality; Scalability & Responsible AI; Presentation & Clarity.

## 2. User Journeys

**UJ-1 — Incident escalation and approval**

*Protagonist: Priya, Ops Duty Manager on shift.* Vessel MSC Anna's ETA slips 90 minutes due to Malacca Strait congestion; five minutes later Crane #4 reports a hydraulic fault. Priya doesn't triage two separate alerts — Portwatch has already correlated them into one incident, queried the Berth/Crane/Yard agents in parallel, and hit a Crane #7 telemetry timeout mid-analysis (confidence drops 91%→67%, logged with the reason). Portwatch generates three recovery options, recommends Option B, then — because DG segregation rules reject part of that plan — re-plans before presenting. Because the revised plan still risks an SLA breach, it stops short of auto-executing and puts a single approval card in front of Priya: situation, recommendation, predicted impact, confidence, alternatives. She reviews it in under a minute and clicks Approve. Portwatch executes across four systems, verifies each one, and only then closes the loop.

**UJ-2 — Mid-incident status query**

*Protagonist: a terminal planner, mid-shift, not the one handling the incident.* They ask in plain language, "What's the current status of MSC Anna?" Portwatch answers from live incident state (berth, cause, recovery plan, yard %, predicted departure, SLA risk, approval status) — grounded in what's actually happening, not a generic model response.

**UJ-3 — Tier-1 silent auto-execute**

*Protagonist: Arif, yard supervisor, mid-shift, not watching Portwatch at all.* Gate queue metrics show a minor congestion blip — fully reversible, no SLA exposure, no safety flag. Portwatch detects it, evaluates it through the policy engine (reversible, no SLA risk, low safety risk, confidence ≥0.80), and auto-executes a schedule refresh and appointment adjustment. Arif never sees an approval prompt — the first he knows of it is a routine notification already marked resolved, with the full trace available if he checks. This journey is the proof point that most incidents should be invisible: the system doesn't cry wolf over things that don't matter, which is what gives UJ-1's escalation card its weight.

## 3. Functional Requirements

### A. Signal ingestion & correlation

- FR1. Normalize inputs (vessel ETA changes, crane/equipment alerts, yard congestion metrics, gate queue metrics, weather events, DG exceptions, operator/user requests) into a common incident representation.
- FR2. Correlate related signals into a single incident when they share an entity (same vessel/berth/crane/yard block) and occur within a **15-minute rolling window** of each other, rather than surfacing them as separate alerts.

### B. Multi-agent analysis

- FR3. Berth/Vessel, Crane, and Yard specialist agents run as independent, parallel LLM calls, each with scoped tool access, each returning a structured recommendation + constraints.
- FR4. A separate Portwatch arbiter agent synthesizes specialist outputs into 2–3 ranked recovery options with predicted impact (delay, cost, yard impact, risk).

### C. Uncertainty & failure handling

- FR5. On tool timeout/failure: retry once, then fall back to last-known state and reduce confidence, logging the reason.
- FR6. Confidence is a computed, deterministic score, starting at 100 and reduced by: staleness (−1pt per 10s of telemetry age beyond fresh, capped at −20), missing-data (−15pt per required field using fallback/cached state), disagreement (−10pt flat if specialist agents' recommendations conflict), variance (−10pt if predicted-outcome spread across recovery options exceeds 30%). Never an LLM self-report. `[ASSUMPTION]` these are tunable starting weights, not empirically calibrated — defensible as "computed and traceable," not as precisely tuned.

### D. Policy & autonomy

- FR7. A deterministic policy engine, outside LLM authority, evaluates the selected recovery option against tiered rules and classifies it Tier 1/2/3:
  - **Tier 1** (silent auto-execute): reversible AND no SLA breach AND safety risk = LOW AND confidence ≥ 85 AND cost = LOW AND no DG involvement.
  - **Tier 2** (auto-execute + notify): reversible AND no SLA breach AND safety risk ≤ MEDIUM AND confidence ≥ 70 AND cost ≤ MEDIUM AND no DG involvement.
  - **Tier 3** (human approval required): everything else — irreversible, OR SLA breach, OR safety risk = HIGH, OR confidence < 70, OR DG involved, OR cost = HIGH.
- FR8. Tier 1 auto-executes silently; Tier 2 auto-executes and notifies; Tier 3 blocks execution and requests human approval via a structured decision card (situation, recommendation, predicted impact, confidence, alternatives).
- FR9. DG/IMDG segregation is a hard gate independent of tier — a violation forces re-planning even after a tier-approved recommendation.
- FR10. A global kill switch immediately disables all autonomous execution.

### E. Human interaction

- FR11. Operator can approve, reject, or modify a Tier-3 recommendation.
- FR12. Any user can query live incident status in natural language; answered from grounded incident state.

### F. Execution & verification

- FR13. Approved/auto actions execute against mock services (TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager, Notification, DG Checker); each action is verified individually; failures are recorded, never silently treated as success. The Notification step includes MPA as a recipient alongside internal teams — no new service, just an additional notification target on the existing mock.

### G. Audit & traceability

- FR14. Every incident produces a structured, timestamped execution trace: input → correlation → tool calls (incl. retries/failures) → agent recommendations → synthesis → confidence → policy decision → human approval (if any) → execution results/errors.
- FR15. The trace is viewable per-incident in the dashboard.

### H. Scalability proof

- FR16. Incident processing is stateless per incident (no shared mutable state), so ≥2 incidents can be triggered and resolved concurrently without blocking each other.

### I. Inter-Gateway load balancing — Day-5 stretch, not core MVP

- FR17. The Yard Manager mock service models a second terminal cluster (Pasir Panjang Block P2) alongside Tuas Block C7. When Tuas yard utilization is high, the arbiter's synthesized recovery options include routing a portion of container flow to Pasir Panjang instead of further loading Tuas — reusing the existing Yard Agent, arbiter, and policy engine unchanged; no new agent or infrastructure. Dashboard shows both blocks' utilization and names the terminal in the recommended option's description. Demonstrates the architecture extends to a new signal/option type without redesign — direct evidence for the Scalability judging criterion. Competes with FR20 (AGV/Gate agent), the 2-concurrent-incidents demo, FR19, and FR18 for Day-5 time; build only if higher-ranked items are on track.

### J. Gate/AGV congestion handling — Day-5 stretch, not core MVP, ranked below FR17

- FR20. An AGV/Gate specialist agent, reusing the existing specialist-agent pattern (FR3), analyzes gate-queue and AGV-congestion signals (FR1 ingestion) and proposes recovery options — e.g. adjusting gate appointment slots, rerouting AGV traffic — using the existing AGV Manager and Gate Manager mocks already named in FR13. Recommendations pass through the same confidence formula (FR6), policy engine (FR7), and execution/verification path (FR13) unchanged — no new pipeline stage, no new agent-orchestration mechanics. `[NOTE FOR PM]` Named in the original Day-5 ranking (Section 10) and in Out-of-Scope (Section 9) as "AGV/Gate agent," but had no FR number until this pass — flagged and closed during epic/story decomposition, 2026-08-27. Ranked third of the Day-5 stretch items — build only if FR17 is already on track, and before the 2-concurrent-incidents demo, FR19, and FR18.

### K. Environmental resilience — Day-5 stretch, not core MVP, ranked below FR20 and the 2-concurrent-incidents demo

- FR18. A mocked meteorological-radar feed can signal severe convective weather (e.g. a Sumatra squall) within a 30-minute detection window. On detection, a Weather agent — reusing the existing specialist-agent pattern (FR3) and routed through the same policy engine and DG-independent hard-gate style check as FR9 — proposes: locking anti-typhoon pins on affected Tuas cranes, rerouting AGVs to flood-safe staging zones, and a natural-language schedule-adjustment notice to affected shipping lines. Tiered like any other recovery option (FR7) — high safety-risk actions (crane pin lock, AGV reroute) route to Tier 3 for human approval, not silent auto-execute, given the physical-safety stakes. `[NOTE FOR PM]` Source: Jing Yi's tropical micro-climate research. Ranked last of the Day-5 stretch items — build only if FR17, FR20, and the 2-concurrent-incidents demo are already on track.

### L. Compliance interoperability — Day-5 stretch, not core MVP, ranked below FR18

- FR19. A mocked MPA-clearance-check mock service, modeled on the real digitalPORT@SG workflow's shape (request → clearance status → conditions), added to the existing mock-service roster alongside the DG Checker (FR13). No live API calls to digitalPORT@SG or any real MPA system — mocked only, consistent with the Out-of-Scope exclusion of real PSA/external integrations. Lets the pitch state the compliance layer is *designed to be compatible with* digitalPORT@SG's real clearance workflow, without claiming live integration. `[NOTE FOR PM]` Source: Jing Yi, noting MPA's digitalPORT@SG is a real, already-implemented system — real integration was considered and rejected for this build: no realistic path to authorized API access in the remaining build time, and a live external dependency is unacceptable demo risk (if digitalPORT@SG is slow or unreachable during judging, the golden path breaks with it). Ranked last of the Day-5 stretch items.

## 4. Non-Functional Requirements

- NFR1. Golden-path incident (ingest → policy decision) resolves in ~20–30s under demo conditions.
- NFR2. 100% of automated and human-approved actions produce a trace entry — no silent failures.
- NFR3. The system degrades (reduced confidence) rather than crashes when a mock tool times out.

## 5. Security & Safety

- Kill switch disables all autonomous execution instantly (FR10, in-scope for MVP).
- Policy engine enforced fully outside LLM control — the LLM proposes, the engine disposes.
- DG/IMDG segregation is a hard gate independent of policy tier.
- Least-privilege tool scoping per agent — no agent holds unrestricted access (e.g. the Berth agent cannot call the Yard Manager).
- A human can always reject or modify a Tier-3 action.

## 6. Compliance Note

`[ASSUMPTION]` The MVP's DG/IMDG ruleset is a simplified, representative subset built for demo purposes — not a certified compliance implementation. State this explicitly in the architecture explanation deliverable so it reads as intentional scoping rather than an overlooked gap.

## 6a. Visualisation Scoping Note

`[ASSUMPTION]` Added 2026-08-28 via `sprint-change-proposal-2026-08-28.md`. The console's geographic map is an *illustrative visualisation of mock incident state* built for the demo — it renders bundled basemap geometry and mock entity positions, updates from the same polled incident trace the rest of the dashboard uses, and makes no live network call. It is explicitly **not** an AIS/VTS feed and carries no vessel-tracking claim; the "Strait-Level Multi-Vessel Collision Avoidance" item in Future Extensions remains vision-only and un-demoed. State this in the architecture-explanation deliverable and the pitch so the map reads as intentional scoping, not an implied real-time tracking capability.

## 7. Scalability

- Incident processor built as stateless-per-incident workers from the start of the build (not retrofitted).
- ≥2 independent incidents triggered and resolved concurrently, demonstrated live.
- Approval-bottleneck-at-scale (e.g. many Tier-3 escalations during a single large event) is a **named, not-built** limitation. Stated future-work answer: escalations prioritized by predicted-impact/SLA-risk score and batched by shared root cause.

## 8. Success Metrics

- All four judging criteria (Agentic AI Design & Technical Execution; Innovation & Originality; Scalability & Responsible AI; Presentation & Clarity) are demonstrably hit within the video and slide limits.
- The golden-path incident, the DG-forced re-plan beat, and the concurrent-incident beat all land live in the demo.
- The execution trace is complete and legible for the demoed incident(s).

**Counter-metric:** feature count is not a proxy for quality — a broken demo scores zero regardless of scope. This is why the build schedule (Section 10) hard-freezes the golden path after Day 3.

## 9. Out of Scope

- Real PSA API integrations (mocked services only) — this explicitly includes digitalPORT@SG: FR19 is a mocked clearance-check service styled on its workflow, never a live call to the real system.
- Certified DG/legal compliance implementation.
- Built (not just stated) handling of approval-bottleneck-at-scale.
- FR20 (AGV/Gate agent and gate congestion handling) — Day-5-only stretch, additive, cuts first under time pressure if FR17 isn't already on track.
- Production auth, persistence beyond the demo session, mobile surface.
- Real meteorological radar integration — FR18's radar feed is mocked, same as every other signal source.

## Future Extensions (vision only — not built, not claimed as working)

Named explicitly here so the pitch can state ambition honestly rather than implying these exist: **Strait-Level Multi-Vessel Collision Avoidance** (AIS/VTS-fused, COLREGs-compliant evasion) and **Transshipment Optimization** (MARL/GNN-driven berth, dig-out ratio, and direct-loading planning) are genuine next-product directions for a Portwatch family, not hackathon-buildable modules — both require infrastructure, training data, and (for collision avoidance) safety validation far beyond a 6-day build. Claiming a working version of either would be a Responsible-AI liability in front of judges, not a strength. State them as roadmap, never as demoed capability.

## 10. Build Plan (4 people, 6 days)

- **A** — orchestration core (specialist agents, arbiter, policy engine, confidence formula)
- **B** — mock services (TOS, Crane Scheduler, Yard Manager, AGV, Gate, Notification, DG Checker) + deliberate timeout injection
- **C** — frontend (incident feed, impact graph, approval panel, execution trace) wired to the real backend
- **D** — integration, demo scenario scripting, DG safety layer, pitch/Q&A prep

**Day 1–2:** architecture + scaffolding, no UI.
**Day 3:** golden path (the Three-Way Disruption scenario) runs end-to-end for real. **Hard freeze on the golden path after this point.**
**Day 4:** dashboard wired to the real backend.
**Day 5:** stretch only, strictly additive, must not touch the golden path. Ranked by value/hour, cut from the bottom if time runs short: (1) DG re-plan beat polish, (2) FR17 Inter-Gateway load balancing, (3) FR20 AGV/Gate agent, (4) 2-concurrent-incidents demo, (5) FR19 mocked MPA/digitalPORT@SG-style clearance check, (6) FR18 Weather Circuit-Breaker agent.
**Day 6:** rehearsal + a recorded backup run of the demo, protecting against live LLM latency/flakiness during judging.

## Open Items

- `[NOTE FOR PM]` Tier thresholds (FR7) and confidence-formula weights (FR6) are engineering starting points set in this PRD to unblock the build, not empirically calibrated — expect Person A to tune them during Day 1–2 scaffolding as real mock data flows through; if a threshold changes, log it so the demo trace numbers stay consistent with what's written here.
- Presentation & Clarity: how this PRD's content compresses into the ≤10-slide deck and ≤10-minute video was not addressed in this PRD — recommended next step is `bmad-cis-agent-presentation-master`.
- `[NOTE FOR PM]` Pitch-narrative material surfaced from Jing Yi's Singapore-context research, not build-relevant but worth handing to the presentation pass: three argument beats — Portwatch speaks Singapore's operational language (transshipment/IGT/strait/MPA) rather than reading as a generic port tool; the deterministic policy engine + tiered autonomy + execution trace directly answers the "black box AI" objection enterprise judges tend to raise; and the timeout/confidence-degradation beat demonstrates engineering maturity around real-world tool failure, not just happy-path demo scripting.
