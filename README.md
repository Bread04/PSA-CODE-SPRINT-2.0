# Portwatch — Harbor Signal

**AI-powered disruption orchestration for PSA Tuas Port.** Built for the PSA Code
Sprint hackathon (6-day, 4-person build).

Operational disruptions don't respect system boundaries: a delayed vessel
cascades into berth, crane, yard, and AGV consequences that no single system owns
end to end. Portwatch is a multi-agent layer that **detects, correlates,
analyses, and responds** to cross-system incidents — auto-executing what's safe,
escalating what isn't, and leaving a complete auditable trace of every decision.

---

## How it works

Each incident is an isolated async task (an *actor*) that owns one mutable
`Incident` record. Work flows through fixed pipeline stages; the LLM agents
*recommend*, and a deterministic policy engine *decides* what executes.

```
INGEST → CORRELATE → AGENT_CALL → SYNTHESIZE → CONFIDENCE → POLICY_DECISION → DG_CHECK → APPROVAL → EXECUTE → VERIFY
                    │ berth │ crane │ yard │  (parallel specialist agents)
```

- **Specialist agents** (Berth / Crane / Yard) run as parallel, scoped
  Anthropic Messages API calls; the **Arbiter** synthesises 2–3 ranked recovery
  options.
- **Confidence** is a computed deterministic score (never an LLM self-report).
- **Policy engine** classifies each option Tier 1 (silent auto-execute) /
  Tier 2 (auto + notify) / Tier 3 (human approval) — outside LLM authority.
- **DG/IMDG segregation** is a hard gate independent of tier; a violation forces
  a re-plan.
- A global **kill switch** disables all autonomous execution at one enforcement
  point.

Full design contract: [`_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-PSA%20CODE%20SPRINT-2026-08-24/ARCHITECTURE-SPINE.md).
See also [`docs/`](docs/) for the artifact index.

---

## Repo layout

| Path | What |
|---|---|
| `backend/` | Python 3.12 / FastAPI single-process backend — the whole pipeline |
| `backend/agents/` | Berth / Crane / Yard specialists, Arbiter, tool manifests |
| `backend/orchestrator/` | Per-incident task, sole state writer, execution trace |
| `backend/policy/` | Policy tiers, confidence formula, DG gate, kill switch |
| `backend/mock_services/` | TOS, Crane Scheduler, Yard Manager, AGV, Gate, Notification (incl. MPA), DG Checker, MPA clearance |
| `backend/api/` | FastAPI routes + demo seed / demo driver |
| `frontend/` | React 19 + TypeScript + Vite operator console ("Harbor Signal") |
| `frontend/portwatch-tuas/` | Visual-reference import only — **not** run as part of the app |
| `_bmad-output/` | Planning + implementation artifacts (PRD, architecture spine, UX, epics, retros) |

---

## Prerequisites

- **Python** 3.12+
- **Node** 20.11+ (project pins `>=20.11`)
- **Anthropic API key** — only for the *live* agent pipeline. The scripted demo
  runs fully offline without one.

---

## Quick start

### 1. Backend (`http://127.0.0.1:8000`)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt

# optional — enables the live LLM path (specialists, arbiter, NL query phrasing)
export ANTHROPIC_API_KEY=sk-ant-...        # Windows: set ANTHROPIC_API_KEY=...

python run_api.py                          # uvicorn api.app:app --reload, port 8000
```

The API seeds a few demo incidents on startup. `GET http://127.0.0.1:8000/healthz`
should return `{"ok": true}`.

### 2. Frontend (`http://127.0.0.1:5173`)

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.development` already points the console at
`http://127.0.0.1:8000`. Open the printed URL — the Live Console polls
`GET /incidents` every 2–3s and renders the feed, incident detail + approval
card, agent roster, stage rail, geographic map, execution trace, Ask Portwatch,
and the kill switch.

---

## Running the demo

The **Three-Way Disruption** golden-path scenario (vessel ETA slip + crane fault
+ telemetry timeout → confidence drop → 3 recovery options → DG-forced re-plan →
Tier-3 approval) is driven through the real specialist → arbiter → policy chain:

```bash
curl -X POST http://127.0.0.1:8000/demo/three-way-disruption
```

Then watch it play out in the console. This path is deterministic and needs no
API key. Disable it in a non-demo deploy with `PORTWATCH_DEMO_TRIGGER=0`.

---

## Environment variables

| Var | Default | Effect |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | When set, specialists/arbiter and NL-query phrasing use the live Messages API. Unset → mock/templated responses. |
| `PORTWATCH_SEED` | `1` | `0` starts with an empty incident store (no demo seed). |
| `PORTWATCH_DEMO_TRIGGER` | `1` | `0` disables the `POST /demo/three-way-disruption` route (404). |
| `MOCK_AGENTS` | `{}` | Per-agent demo-safety override (`{berth,crane,yard,arbiter}` bools) — short-circuits a named agent to a canned response; the trace marks it `mock_forced`. |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` (dev) | Backend base URL the console calls; empty = same-origin. |

---

## API surface

| Method + path | Purpose |
|---|---|
| `GET /incidents` | All incidents (polled by the console) |
| `GET /incidents/{id}` | One incident, full trace |
| `POST /incidents/{id}/approval` | `{action: "approve" \| "reject" \| "select_alternative", option_id?, note?}` |
| `GET /incidents/query?q=&incident_id=` | Natural-language status query (grounded in incident state) |
| `POST /kill-switch` | `{enabled: bool}` |
| `POST /demo/three-way-disruption` | Trigger the scripted golden-path scenario |
| `GET /healthz` | Liveness |

---

## Tests & CI

```bash
# backend — 248 tests across 13 files
cd backend && python -m pytest -q

# frontend — Vitest (unit / hook / contract / integration)
cd frontend && npm test

# frontend — full gate (lint + typecheck build + test), what CI runs
cd frontend && npm run verify

# frontend — Playwright end-to-end (needs the backend running)
cd frontend && npm run e2e
```

CI (`.github/workflows/ci.yml`) runs `npm run verify` for the frontend and
`pytest` for the backend on every push to `main` / `epic/**` and on every PR.

---

## Scope notes

- **In-memory only** — no database; state is lost on restart (a demo session,
  not a shipped product).
- **No auth** — single fixed operator context.
- **Mock services only** — no live PSA / MPA / weather integrations.
- The DG/IMDG ruleset is a simplified representative subset for the demo.
