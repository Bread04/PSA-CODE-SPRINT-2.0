# Portwatch — forged idea

Judging criteria targeted: Agentic AI Design & Technical Execution; Innovation & Originality; Scalability & Responsible AI; Presentation & Clarity.

## Architecture
- Genuine multi-agent, not single-agent + if-engine: 3 core specialist agents (Berth/Vessel, Crane, Yard) + optional cut-first 4th (AGV/Gate). Each is an independent LLM call, scoped least-privilege tools, can be wrong independently.
- Specialists run in **parallel** (asyncio.gather), each with its own timeout — this also produces the Crane #7 telemetry timeout demo organically instead of needing to fake it.
- Specialists don't message each other directly (avoids N² complexity). **Portwatch is a separate arbiter/synthesis agent** that sees all specialist outputs, resolves conflicts (e.g. Crane recommends reassignment, Yard flags capacity), produces Options A/B/C.
- Deterministic policy engine sits after synthesis, unchanged from original proposal — gates the chosen option, outside LLM authority.
- Keep specialist agents cheap/fast (small model, narrow prompt, one tool); reserve heavier reasoning for the arbiter call only. Protects demo latency.

## Confidence score
- Rejected: LLM self-reporting "91% confident." Not defensible under judge questioning.
- Locked: deterministic computed formula — `100 − staleness_penalty − missing_data_penalty − disagreement_penalty − variance_penalty`. Same trust philosophy as the policy engine, applied twice.
- Weights are tunable heuristics, not claimed to be precisely calibrated. Defensible answer if asked: "computed and traceable, not perfectly calibrated."
- Demo tie-in: Crane #7 timeout → missing_data + staleness penalties fire → confidence drops 91→67, traceably, in the execution log.

## Headline differentiator (Innovation/Originality)
- Core risk identified: stripped of port vocabulary, the pitch is a generic "orchestrator + specialists + policy gate + human-in-loop" pattern, indistinguishable from a hospital/airline/data-center incident-response system.
- Rejected as sufficient: berth/crane/yard coordination alone (too generic-sounding).
- Locked: promote **DG (dangerous goods) IMDG segregation constraint** from proposal's buried section 14 to the demo's central beat. It's the one genuinely maritime/regulatory-specific element.
- Demo twist: in the Three-Way Disruption scenario, Portwatch's own recommended Option B gets **rejected by the deterministic DG safety check** (segregation violation vs. cargo already in target yard block), forcing a re-plan live. Lands Innovation and Responsible-AI in the same beat.

## Scalability
- Rejected as sufficient: architecture diagram + claim ("the same architecture could eventually support..."). Not evidence.
- Locked: incident processor built as **stateless-per-incident workers** from Day 1–2 (no shared mutable state/locks) so concurrency is structural, not bolted on later.
- Day 5 stretch demo beat: trigger 2 independent incidents simultaneously live, show both resolve without blocking each other — converts the scalability claim into a shown fact.
- Known limitation, not built, but answer-ready for Q&A: approval-bottleneck at scale (e.g. many Tier-3 escalations during a typhoon). Stated future-work answer: escalations prioritized by predicted-impact/SLA-risk score, batched by shared root cause.

## Team & schedule (4 people, 6 days)
- A: orchestration core (agents, arbiter, policy engine, confidence formula)
- B: mock services (TOS, crane, yard, AGV/gate, notification, DG checker) + timeout injection
- C: frontend (incident feed, impact graph, approval panel, execution trace) wired to real backend
- D: integration, demo scenario scripting, DG safety layer, pitch/Q&A prep
- Day 1–2: architecture + scaffolding, no UI
- Day 3: golden path (Three-Way Disruption) runs end-to-end for real — **hard freeze after this point**
- Day 4: dashboard wired to real backend
- Day 5: stretch only, additive, must not touch golden path (DG layer, AGV/Gate agent, 2-concurrent-incidents demo)
- Day 6: rehearsal + recorded backup run of the demo (protects against live LLM latency/flakiness during the pitch)

## Not pressure-tested this session
- Presentation & Clarity — how the 31-section proposal doc compresses into an actual pitch (slides vs. backup material) was flagged but not worked through. Worth a follow-up pass before the pitch is finalized.
