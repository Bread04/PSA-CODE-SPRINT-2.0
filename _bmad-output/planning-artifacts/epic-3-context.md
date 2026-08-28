# Epic 3 Context: Proven at Scale

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Portwatch must prove it holds up under realistic pressure: multiple simultaneous disruptions resolve side-by-side without interfering, and the same trusted pipeline — specialist agents, arbiter, policy engine, confidence scoring, execution — extends to a second terminal cluster and to disruption types it was not purpose-built for. This directly answers the Scalability & Responsible AI judging criterion: the architecture generalizes rather than being hardcoded for one incident shape. The core deliverable is the concurrency proof; the terminal-cluster and new-agent extensions are strictly additive Day-5 stretch items built only after the golden path is frozen.

## Stories

- Story 3.1: Concurrent Incident Proof
- Story 3.2: Pasir Panjang Load Balancing
- Story 3.3: AGV/Gate Specialist Agent
- Story 3.4: Mocked MPA Clearance Check
- Story 3.5: Weather Circuit-Breaker Agent

## Requirements & Constraints

- Each incident is fully stateless and isolated: no shared mutable state across incidents, so two or more incidents can be triggered, run their full pipelines, and resolve in the same session without blocking one another. This is the central requirement of the epic and the live demo proof.
- The Pasir Panjang routing option must appear only when Tuas yard utilization is high; it reuses the existing Yard Agent, arbiter, and policy engine unchanged. When active, the dashboard shows both terminal blocks' utilization and names the terminal in the recommended option.
- New specialist agents (AGV/Gate, Weather) must reuse the established specialist-agent pattern exactly — direct messages-API call with a scoped tool manifest — and their recommendations flow through the same confidence formula, tier classification, and execution path with no new pipeline stage.
- Weather-sourced recovery options with physical-safety stakes (crane pin lock, AGV reroute) must route to Tier 3 for human approval and never silent auto-execute, regardless of confidence.
- The MPA clearance check is mocked only, modeled on the real digitalPORT@SG workflow shape, with no live external calls — added to the existing mock roster alongside the DG Checker.
- All of 3.2–3.5 are Day-5 stretch, strictly additive after the Day-3 golden-path freeze; cut from the bottom if time runs short. None introduce new endpoints, tiers, or policy rules.
- The global kill switch and DG/IMDG hard gate still apply to every new agent and option.

## Technical Decisions

- Concurrency is enabled by the single-writer orchestrator model: each incident owns one in-memory `Incident` record (with its embedded append-only trace) held by that incident's async task; only that task writes. Specialist agents, arbiter, policy engine, and mock services are pure call/return and never mutate state outside their own incident. Frontend only reads.
- Persistence is in-memory only (no database); state is lost on restart, acceptable for a demo session.
- Correlation is handled by a central in-memory registry keyed by entity (vessel/berth/crane/yard-block), consulted before dispatch — already built in Epic 1 and required for incident isolation.
- Every mock service exposes one call shape — `execute(action: dict) -> {ok, result, error}` — with an injectable timeout/failure mode, so new mocks (AGV Manager, Gate Manager already exist; MPA added here) integrate without interface drift.
- Shared data shapes (`Incident`, `RecoveryOption`, `TraceEntry`) and the existing read/write API endpoints are fixed; new agents must conform to those field names and reuse the existing incident/approval/query endpoints. No new backend surface.
- The Yard Manager mock already returns per-block utilization (Tuas C7, Pasir Panjang P2) from day one, so the FR17 routing logic is additive rather than a schema change.

## UX & Interaction Patterns

- The dashboard must render both Tuas C7 and Pasir Panjang P2 utilization when load-balancing is active, and name the terminal in the recommended option's description.
- Concurrent incidents must remain independently selectable in the feed, each with its own independently actionable Tier-3 approval card — the UI proof of concurrency lives in the Epic 2 feed/detail components, not new screens.
- The illustrative map and stage-rail (Epic 4) reflect per-incident state and must not imply the second incident's entities belong to the first; markers update from the same polled trace data, no new state.

## Cross-Story Dependencies

- 3.1 (concurrency) is the core, non-stretch deliverable and must land before any stretch item.
- 3.2–3.5 each assume the entire Epic 1 pipeline already exists; they reuse rather than extend the specialist-agent dispatch, arbiter synthesis, deterministic confidence, policy-tier classification, execution/verification, and DG gate.
- 3.2 depends on the dual-block Yard Manager mock (built day one in Epic 1) and on the dashboard's utilization display.
- 3.3 reuses the existing AGV Manager and Gate Manager mocks; 3.4 adds the MPA mock to the existing roster; both depend on the fixed mock-service call contract.
- 3.1's live concurrency demonstration relies on the Epic 2 feed and approval components to show two independently resolvable incidents.
- Stretch build order (highest value/hour first): 3.2, then 3.3, then 3.1's demo polish, then 3.4, then 3.5 — cut from the end under time pressure.
