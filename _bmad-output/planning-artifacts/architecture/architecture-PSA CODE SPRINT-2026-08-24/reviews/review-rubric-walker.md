# Review: ARCHITECTURE-SPINE.md — Portwatch

**Reviewer angle:** good-spine checklist walkthrough
**Target:** `_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md`
**Verdict: PASS WITH CONCERNS**

The spine correctly identifies and fixes the highest-risk divergence points for this build (state ownership, tool scoping, DG-gate ordering, kill-switch placement, the frontend read/write contract) and stays admirably lean for a 6-day/4-person hackathon. It has one real gap that could cause exactly the kind of Day-5/6 integration failure this document exists to prevent — the mock-service and agent I/O contracts are left silent rather than decided or deferred — plus a couple of smaller issues worth a fast fix.

---

## 1. Does it fix the real divergence points for the 4 build lanes? Does it miss any?

**Lanes as inferable from the spine:** orchestration core (ingest/registry/orchestrator/policy), mock services, frontend, integration (agents + Anthropic API wiring).

Covered well:
- **State ownership** (AD-4, AD-9) — the single biggest cross-lane hazard (concurrent incidents racing on shared state) is fixed decisively.
- **Tool/capability scoping** (AD-2, AD-3) — prevents an agent lane from silently growing capability reach.
- **Correlation semantics** (AD-5) — fixes exactly the kind of "how do we decide it's the same incident" logic that would otherwise be reinvented per-developer.
- **Frontend read/write boundary** (AD-6, AD-11) — forecloses a push-channel rabbit hole and pins the approval API to a closed action set instead of a free-form edit surface.
- **Kill switch** (AD-7) and **DG-gate ordering** (AD-8) — both are safety-relevant cross-cutting concerns with one clear enforcement point each; good catches.
- **Trace/stage vocabulary** (Consistency Conventions) — fixes the stage-name and error-shape vocabulary that independently-built pipeline stages would otherwise diverge on.

**Missed / silent:**
- **Mock-service call contract.** `mock_services/` is named as a lane (TOS, Crane Scheduler, Yard Manager, AGV, Gate, Notification, DG Checker) and appears as a box in both diagrams, but nothing in the spine fixes its calling convention: is it `async def execute(action, params) -> result`? What does a mock service return on simulated failure (relevant to FR5's `retried`/`fallback_used` fields)? Is latency/failure injection standardized so FR5 behavior is testable across all seven mocks? Without this, the orchestration-core lane and the mock-services lane can each build a plausible-but-incompatible interface, and the mismatch surfaces late (integration, Day 5-6) — precisely the failure mode this document exists to prevent. AD-12 fixes *one* mock service's data shape (Yard Manager blocks) but not the general contract all seven share.
- **Agent request/response schema.** AD-2/AD-3 fix *how* agents are called (direct Messages API, manifest-scoped tools) but not the shape of what goes in (what incident context is passed to Berth/Crane/Yard) or what comes out (the "2-3 ranked options" AD-11 assumes the arbiter produces — is that a fixed JSON shape, and do specialist agents emit the same shape the arbiter consumes?). This is the exact seam between two independently-built lanes (orchestration core and integration/agents) and is currently unfixed.

Both gaps are the same category of miss: real cross-lane call boundaries that are pictured in the diagrams but not specified anywhere in Rules or Conventions. They belong in this document, not deferred to code, because they are exactly the kind of thing that diverges silently when built in parallel.

## 2. Is every AD's Rule enforceable, and does it prevent its stated divergence?

Mostly yes. Two rules rely on discipline rather than a structural mechanism, worth flagging (not blocking):

- **AD-4** ("Only the orchestrator coroutine writes to `Incident`") is enforced by convention only — nothing stops another module that holds a reference to the same mutable `Incident` object from mutating a field directly. A cheap structural enforcement (return read-only snapshots/dicts to everything except the orchestrator, or make `Incident` fields settable only through an orchestrator-owned method) would convert this from a code-review convention into something actually unenforceable-to-violate. Given the hackathon pace, convention + review is a defensible tradeoff, but it's the one AD where "enforceable" is weakest.
- **AD-3** ("Adding capability means editing the manifest, never the prompt") is likewise a review-time convention — nothing stops a developer from inlining a tool schema into prompt-construction code instead of the manifest. Same tradeoff judgment as above.

All other rules (AD-1, AD-2, AD-5 through AD-11, AD-12) are concrete enough to check by inspection: single process vs. separate services, Messages API vs. Agent SDK import, 15-minute window logic, one polling endpoint, one kill-switch check site, DG-gate pipeline position, the three-verb approval contract, and the two named yard blocks. Each maps cleanly to its stated "Prevents" line.

## 3. Anything wrongly deferred that could let units diverge?

The **Deferred** section itself is reasonable — production infra, approval-bottleneck-at-scale, real PSA integrations, certified DG compliance, persistence/auth beyond the demo, and the two roadmap-only capabilities are all correctly out of scope and correctly *labeled* as deferred with reasons.

The actual risk isn't in what's deferred — it's what's **missing from both the Rules and the Deferred list**: the mock-service interface contract and the agent I/O schema (see §1). Neither is decided nor acknowledged as deferred; they're just absent. That's a worse state than an explicit deferral, because a silent gap doesn't warn the four lanes that they need to agree on something before they can integrate.

## 4. Is named tech plausible and not stale?

- Python 3.12+, Anthropic Python SDK "latest stable," React/TS/Vite "current stable" — all appropriately unpinned or loosely pinned; fine, and correctly avoid staleness by not hardcoding version numbers that will look wrong later.
- **FastAPI "~0.141.x (verified current, July 2026)"** stands out as the one line with a suspiciously specific, unsourced claim. FastAPI's actual version trajectory as of the last verifiable data point (~0.115.x in late 2024/early 2025) makes 0.141.x by mid-2026 plausible on trend, but "verified current" with no citation, sitting next to three other rows that deliberately say "current stable" instead of pinning a number, reads as an unverified or fabricated specific. Recommend either sourcing the claim or downgrading it to "current stable" like the other rows — the inconsistency in how precisely each row is pinned is itself a tell.

## 5. Are all owned structural dimensions decided/deferred/flagged — nothing silent?

- Paradigm — decided (single-writer pipeline).
- Stack — decided.
- State ownership — decided (AD-4, AD-9).
- Boundaries — decided (AD-1, source tree).
- Deployment/environment — decided for the demo, explicitly deferred for production.
- Security/auth — decided (AD-10, AD-3 least-privilege).
- Persistence — decided (AD-9).

These seven are all handled. The gap is a dimension the checklist doesn't name explicitly but that this spine's own diagrams put in scope: **inter-module call contracts** (mock-service interface, agent I/O schema — see §1). That's a structural dimension this altitude should own for a 4-lane parallel build, and it's silent rather than decided/deferred/flagged.

## 6. Mermaid diagrams: valid, non-empty, correct dependency direction?

Both diagrams are non-empty and use syntax that should render in standard Mermaid (colons, slashes, em dashes, and commas inside `[...]` node labels are all fine; edge labels with `/` are fine).

One fragility worth a fast fix in both diagrams: a node ID is referenced once **without** a shape/label before its shape is declared elsewhere.
- Diagram 1 (pipeline flow, lines ~22-41): `Approval -->|reject| Incident` uses the bare `Incident` before `Execution --> Incident[(Incident record + trace)]` gives it a shape.
- Diagram 2 (container view, lines ~140-155): `Operator((Operator)) -->|...| Frontend` uses bare `Frontend` before `Frontend[React + TS + Vite Dashboard] -->|HTTP poll 2-3s| API` gives it a shape.

Mermaid renderers generally resolve this by taking whichever declaration carries the shape, so this will likely render correctly in practice — but it's inconsistent (shape declared after first use in one diagram, and the pattern repeats), and reordering so each node's shaped declaration comes first would remove any renderer-dependent risk for zero cost.

On **content**: diagram 1 is a control/data-flow diagram (good — it's the most useful diagram in the doc, and it does convey real call direction stage-to-stage, including the DG-gate loop-back). Diagram 2 is a container diagram that correctly shows the two real external dependency edges (Frontend → API, Backend → Anthropic API) but shows no arrows *among* the backend's internal boxes (Ingestion, Registry, Orchestrator, Agents, Policy, MockSvc, Store) — it's a containment listing, not an internal dependency graph. That's an acceptable division of labor between the two diagrams (diagram 1 carries the internal flow), but if the checklist's "dependency-direction diagram" specifically means the container view, it's incomplete on its own; read together with diagram 1, the real dependency direction is conveyed.

## 7. Does it stay lean (seed vs. invariant discipline)?

Yes. The document is proportionate: 12 ADs, each tied to a specific prevented divergence and a specific FR; a compact conventions table instead of a full data dictionary; a source tree sketched at directory-not-file granularity; a capability map that's traceability, not restatement. It resists the temptation to specify things code will naturally own (e.g., it correctly leaves the confidence-weight *values* to a config module rather than dictating them, while still fixing *where* they must live). The one place it under-specifies relative to what the lanes actually need is the mock-service/agent I/O contract flagged above — everything else stays right-sized.

---

## Summary of findings

1. **[Moderate-High] Mock-service call contract is undecided and unacknowledged.** Named as a lane and pictured in both diagrams, but no fixed signature, error/failure shape, or latency-injection convention — risks late integration mismatch between orchestration-core and mock-services lanes.
2. **[Moderate] Agent request/response schema is undecided.** AD-2/AD-3 fix the calling mechanism, not the payload shape between orchestrator ↔ specialist agents ↔ arbiter, including the "2-3 ranked options" shape AD-11 assumes exists.
3. **[Low] AD-4's single-writer rule is convention-enforced, not structurally enforced** — nothing stops another module holding a reference to `Incident` from mutating it directly. Acceptable hackathon tradeoff but worth flagging.
4. **[Low] FastAPI version claim ("~0.141.x, verified current, July 2026") is suspiciously precise and unsourced**, inconsistent with the "current stable" treatment given to every other stack row.
5. **[Cosmetic] Both mermaid diagrams reference a node ID once unshaped before declaring its shape** (`Incident`, `Frontend`) — likely renders fine but is inconsistent ordering worth a quick fix.

Items 1-2 are the substantive concerns; 3-5 are minor/cosmetic and don't change the overall verdict on their own.
