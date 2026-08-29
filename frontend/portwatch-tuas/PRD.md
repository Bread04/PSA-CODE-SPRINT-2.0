---
title: Portwatch-Tuas PRD
status: final
created: 2026-08-29
updated: 2026-08-29
---

# Portwatch-Tuas

## 1. Product summary

Portwatch-Tuas is a human-in-the-loop port operations co-pilot for PSA-style terminal environments. It surfaces operational disruption risk, recommends the best next action, and escalates decisions to a human operator when the data is incomplete, ambiguous, or high-impact.

The product is designed for the PSA Code Sprint 2.0 challenge: demonstrate how an agent can analyze operational inputs, determine an objective, coordinate relevant actions, handle uncertainty, and maintain an execution trace.

## 2. Problem statement

Port and terminal operations teams are dealing with rapid, noisy signals: berth conflicts, weather disruption, yard congestion, equipment failures, staffing changes, vessel delays, and route bottlenecks. These signals arrive in parallel and often across disconnected tools. Operators need a clear answer to four questions:

1. What is the operational objective right now?
2. What is the likely impact if we do nothing?
3. Which action or escalation best balances service, safety, and throughput?
4. What is the decision trail for accountability and review?

Current manual triage is slow, fragmented, and difficult to audit. The result is delayed decisions, inconsistent response quality, and poor visibility into why an action was chosen.

## 3. Target users

### Primary users
- Port operations supervisors
- Vessel operations coordinators
- Yard and equipment control leads
- Frontline dispatch managers

### User needs
- Understand disruption risk quickly
- See real trade-offs between operational options
- Escalate only when appropriate
- Keep a clear audit trail of events, decisions, approvals, and outcomes

## 4. Product vision

Create an operational decision support agent that helps teams respond to disruption with speed, consistency, and human oversight. The system should not claim full autonomy in high-risk decisions; it should actively recommend, explain, and request approval where the stakes justify it.

## 5. Goals

### Business / outcome goals
- Reduce time to identify the root issue in an operational disruption
- Improve consistency of action recommendations under pressure
- Make decisions auditable and explainable
- Support faster escalation from operator to supervisor when confidence is low

### Product goals
- Accept operational inputs such as alerts, schedule changes, vessel status, weather, and yard conditions
- Detect likely objectives or issues
- Recommend the next best action or set of actions
- Present confidence, assumptions, and risk trade-offs
- Require human approval when action carries operational or safety risk

## 6. Non-goals

- Fully autonomous control of live port infrastructure without human oversight
- End-to-end replacement of all terminal systems and workflows
- Deep integration with every enterprise system in a single sprint prototype
- Guaranteeing deterministic decisions in highly ambiguous situations

## 7. User journeys

### Journey 1: disruption triage during berth delay

Actor: Maya, a vessel operations coordinator

1. Maya receives an alert that a vessel is delayed and berth availability is tightening.
2. The agent ingests the vessel status, berth schedule, weather, and yard capacity data.
3. The agent identifies the objective: protect berth utilization and minimize vessel turnaround delay.
4. The system suggests a ranked set of options, including berth reassignment, crane reallocation, and delayed non-critical moves.
5. Maya reviews the recommendation and the confidence score.
6. If confidence is high, the system marks the action as ready; if confidence is medium or low, it escalates for approval.
7. The system records the decision path, the data used, and the human approval decision.

### Journey 2: weather-driven yard congestion event

Actor: Daniel, a yard operations lead

1. Daniel sees a weather warning and rising yard congestion.
2. The system correlates weather, equipment availability, and resource loading.
3. The agent recommends a staffing or workflow adjustment rather than a risky guess.
4. Daniel reviews the rationale, projected impact, and alternative options.
5. The agent records the approval and outcome after implementation.

## 8. Core product requirements

### FR-01: Event intake
The system shall accept operational inputs including but not limited to:
- event logs
- state changes
- operational alerts
- schedule or ETA changes
- weather or environmental signals
- staffing or equipment status
- user-entered operational requests

### FR-02: Objective detection
The system shall identify the likely operational objective or issue from the incoming input, such as:
- minimize berth delay
- protect safety thresholds
- re-balance yard utilization
- reduce vessel turnaround time
- avoid service degradation or missed SLA

### FR-03: Decision support
The system shall generate a set of plausible next actions, grouped by impact, confidence, and risk.

### FR-04: Reasoning transparency
The system shall explain why it selected a course of action, including known assumptions, missing data, and confidence levels.

### FR-05: Human-in-the-loop escalation
The system shall require human review or approval when:
- the confidence is below a defined threshold
- the action has high operational impact
- the data is incomplete or contradictory
- the recommended action affects safety or service-critical processes

### FR-06: Tool orchestration
The system shall model tool usage and workflow coordination across relevant systems or operational functions, including recommending an action sequence rather than a single isolated step.

### FR-07: Failure handling
The system shall gracefully handle missing data, tool failure, and failed actions by surfacing the gap and offering an alternate path or escalation.

### FR-08: Execution trace
The system shall record a clear action log covering:
- key events
- extracted objective
- candidate options
- decision rationale
- confidence state
- tool calls or workflow steps
- approvals or escalations
- resulting outcome or failure message

### FR-09: Auditability
The system shall present a chronological account of decisions and actions so operators can review how the agent reached the recommendation.

### FR-10: Operational clarity
The product shall provide plain-language summaries of what the system thinks is happening and what it recommends, avoiding unexplained jargon.

## 9. Functional flow

1. Receive operational signal
2. Normalize event and context data
3. Detect objective and likely issue
4. Assess affected resources and risk
5. Generate ranked action options
6. Evaluate confidence and escalation trigger
7. Pause for human approval when needed
8. Execute or recommend action sequence
9. Record trace and resulting operational state
10. Show final summary to user

## 10. Non-functional requirements

### NFR-01: Safety
The system must never silently take high-risk action without a human approval pathway.

### NFR-02: Explainability
The user must be able to inspect why a recommendation was made and what assumptions informed it.

### NFR-03: Reliability
The system should degrade gracefully when data is missing or tools fail.

### NFR-04: Usability
The interface should support rapid operator triage and clear action selection under time pressure.

### NFR-05: Scalability
The design should support multiple event types and more operational domains without major redesign.

### NFR-06: Security and data handling
The system must respect operational access boundaries, avoid exposing sensitive data irresponsibly, and use role-aware approval.

## 11. Success metrics

- Time from alert to objective identification is reduced versus manual triage
- Operators can review recommendation rationale in under 30 seconds
- Approval flow is triggered in appropriate risk scenarios
- Execution trace is complete and understandable for operational review
- Demo scenario clearly proves a useful decision assist rather than an opaque chatbot

## 12. MVP scope for PSA Code Sprint 2.0

The MVP should focus on a single high-value workflow rather than trying to cover all port operations.

### Recommended MVP scenario
A berth or yard disruption event triggers a recommendation engine that:
- identifies the issue
- explains likely impact
- proposes 3 ranked options
- requires operator approval for high-impact actions
- shows a trace of decisions and results

### In-scope demo features
- live operational alert intake
- decision recommendation panel
- ranked options with trade-offs
- approval controls
- execution timeline or action log
- “confidence + unknowns” explanation

### Out-of-scope for MVP
- full enterprise integration
- autonomous execution over critical infrastructure
- exhaustive policy engine across every terminal process

## 13. Risks and mitigations

### Risk: system feels like a black box
Mitigation: show rationale, confidence, missing data, and decision trail in plain language.

### Risk: over-autonomy
Mitigation: require human approval for high-risk actions and visually separate recommendations from executed outcomes.

### Risk: insufficient operational context
Mitigation: surface assumptions clearly and escalate when the system lacks needed information.

### Risk: demo becomes too generic
Mitigation: anchor the story in a concrete PSA-like port disruption scenario with clear action consequences.

## 14. Open questions

- Should the demo focus on berth disruption, yard congestion, equipment failure, or a broader operations mix?
- Is the prototype required to include a front-end dashboard, backend reasoning layer, or both?
- Should the system present all options or only the top recommendation with escalation controls?
- Does the demo need a live timeline or a simpler static execution trace for clarity?

## 15. Recommendation

The strongest PSA Code Sprint 2.0 product is a human-in-the-loop port operations decision assistant that prioritizes explainability, decision traceability, and controlled escalation. This approach aligns with the challenge statement, is realistic for a short sprint, and demonstrates the value of agentic AI without pretending that autonomy is always better than human judgment.
