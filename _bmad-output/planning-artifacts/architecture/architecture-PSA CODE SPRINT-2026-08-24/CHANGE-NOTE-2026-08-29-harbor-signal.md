# What changed — Harbor Signal UX pivot (2026-08-29)

**For the build lanes.** The console's visual identity was redirected to follow `frontend/portwatch-tuas/src` ("Harbor Signal"), and the goal "show the whole orchestra clearly" was made explicit. The PRD is unchanged. The architecture spine gained **AD-18** and **AD-19**. Here is what that does and does not change.

## TL;DR by lane

| Lane | Impact |
|---|---|
| **A — orchestration** | One small additive change (AD-19): after `run_specialists`, set `Incident.agents = <the validated bundle>` and append one `AGENT_CALL` trace entry per specialist. ~1 model field + ~10–15 lines + a `demo_seed.py` update. **Nothing else.** Golden path, tiers, policy, confidence, DG gate, execution, and every frozen test are untouched. |
| **B — mock services** | **Zero change.** MPA is already a notification recipient; nothing new. |
| **C — frontend** | Presentation re-skin + one new component. Swap `frontend/src/theme` tokens (Barlow Condensed / zero-radius / greyscale → Space Grotesk + IBM Plex Mono / marine ink / seafoam-amber-red / 8px radius / 214-74px rail). Add `AgentRoster` (reads `Incident.agents`). Rename routes: `IncidentArchive` → `AuditTrail`, add `ActiveIncidents` (both filter the existing `GET /incidents`). Same hooks, same single write path (approval + kill-switch). |
| **D — integration/demo** | **Zero change.** No new endpoint, no new env var, no deployment change. Verify the demo still runs after A's `demo_seed.py` update. |

## What is NOT changing

- The frozen specialist contract: `SpecialistBundle` stays exactly 3, `AgentName` stays `berth|crane|yard`, the arbiter `len(...) != 3` guard and all frozen specialist tests are locked (per `sprint-change-proposal-2026-08-29`).
- The pipeline, the policy engine, the DG hard gate, the kill switch, the confidence formula, the tier rules.
- The API surface: still `GET /incidents`, `GET /incidents/{id}`, `POST /incidents/{id}/approval`, `GET /incidents/query`, `POST /kill-switch`. No new route.
- Polling (AD-6) — the "live" orchestra view is still a 2–3s poll, not a push channel.
- `sprint-change-proposal-2026-08-29` otherwise stands: FR18/FR20 remain descoped; Epics 3 + 4 closed.

## How the "whole orchestra" renders (all from `GET /incidents/{id}`)

| Surface | Data source | Backend change? |
|---|---|---|
| Stage rail (`INGEST…VERIFY`) | `trace[].stage` + `error` shape | none (AD-18) |
| Policy tier | `Incident.tier` / `POLICY_DECISION.detail.tier` | none |
| Tier **reason label** | derived in the frontend from `tier` + selected option's `reversible`/`dg_involved`/`predicted_impact` + `confidence` vs threshold | none (no reason string is emitted) |
| Confidence + breakdown | `Incident.confidence`; `CONFIDENCE.detail` (`{staleness_seconds,fallback_fields,disagreement,variance_exceeds}` live, `{reason}` in demo seed — render whichever is present) | none |
| DG-gate state + re-plan loop | `DG_CHECK.detail` + AD-8 loop | none |
| Predicted impact | `Incident.options[].predicted_impact` (already structured) | none |
| **Agent roster** (per-agent summary / actions / constraints) | `Incident.agents` | **AD-19 — the one small add** |

## The frozen-contract check (process note)

The spec that named "reuse the pattern exactly" (FR18/FR20) still collided with a frozen contract — and so did this UX pivot's first framing ("everything's already in the API"). It wasn't: the specialist bundle is computed and dropped. Caught by reading the code (`models/incident.py`, `orchestrator/run.py`, `agents/base.py`, `api/demo_seed.py`) before committing the AD. Worth a pre-flight "is the data actually on the wire?" check when a display requirement lands.
