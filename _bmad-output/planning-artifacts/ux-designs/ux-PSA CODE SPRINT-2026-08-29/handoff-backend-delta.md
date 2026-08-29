# Handoff — backend reconciliation for the Harbor Signal frontend

**For:** the next `bmad-architecture` / `bmad-build` pass.
**Why:** the user asked for "the backend modified based on the modified frontend." That is code + contract work, outside a `bmad-ux` pass (which produces `DESIGN.md` + `EXPERIENCE.md` only). This note records the delta so it isn't lost.

## The situation

Three things currently disagree:

| | Contract shape | Stage vocab | Notes |
|---|---|---|---|
| **Current backend** (`backend/`, Python/FastAPI) | `/incidents`, `/incidents/{id}`, `/incidents/{id}/approval`, `/kill-switch`, `/incidents/query`; `agents/`, `policy/confidence.py`, `orchestrator/trace.py`, `mock_services/` | SCREAMING_SNAKE | Built to the **real PRD** + architecture spine. This is the source of truth for *behavior*. |
| **Current frontend** (`frontend/src/`) | consumes the above; `StageRail`, `ExecutionTrace`, `BlueprintPanel`, `GeoMapPanel` | SCREAMING_SNAKE | Built to the **retired** blueprint `DESIGN.md`. Needs a re-skin to Harbor Signal, not a rewrite. |
| **portwatch-tuas** (`frontend/portwatch-tuas/`) | its own Express server, `shared/domain.ts` (`DisruptionRecord`, `OperationalDomain: berth\|yard\|weather\|equipment\|staffing`, `executionStatus` enum), `/overview` `/disruptions` `/decision` | prose scenario steps | Adopted for **visual identity only**. Its server + domain model are **not** the target. |

## What "modify the backend" actually means here

Keep the current Python/FastAPI backend and its PRD-anchored behavior. The frontend re-skin needs a few **additive** contract fields so the Harbor Signal console can render the whole orchestra (see `EXPERIENCE.md` → Foundation → Data contract table). Likely additions to the per-incident payload:

- `agents[]` — `{ name, state: queued|running|complete|timeout|fallback, recommendation, constraints[], confidenceContribution }` (FR3; surface what the specialist agents already produce internally).
- `confidenceBreakdown` — `{ staleness, missingData, disagreement, variance }` alongside the existing computed `confidence` (FR6).
- `tierReason` — the one-line policy rationale string (FR7; the engine already knows it).
- `dgGate` — `{ status: pass|violation, replanning: bool }` as a first-class field, not just a trace row (FR9).
- `options[].predictedImpact` — `{ delay, cost, yard, risk }` structured rather than a prose blob (FR4).
- confirm `blocked_by_kill_switch` is on the incident payload (FR10) and `notification` targets include `MPA` (FR13).

No new pipeline stage, no new agent, no new endpoint — these expose state the orchestrator already computes. `GET /incidents/query` stays as-is (entity resolved from free text).

## Frontend re-skin (separate `bmad-build` task)

`frontend/src` keeps its data layer, hooks (`useIncidents`, `useApproval`, `useKillSwitch`, `useAskPortwatch`), routing, and component structure. What changes: `theme/tokens.css` + `tokens.ts` → Harbor Signal tokens; `BlueprintPanel` → Harbor Signal `Panel` (L-bracket + corner mark); zero-radius → 4/8/16/22; Barlow → Space Grotesk + IBM Plex Mono; add the **agent roster** component and expand `StageRail` per `EXPERIENCE.md` → The Orchestra. `GeoMapPanel` keeps its geographic approach.

## Out of scope for the reconciliation

Do **not** port from portwatch-tuas: the Express server, `shared/domain.ts`, the workforce/staffing model, fleet data, or the live `gov.sg` radar fetch. See `reconcile-portwatch-tuas-src.md` → Dropped.
