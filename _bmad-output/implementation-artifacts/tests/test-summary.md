# Test Automation Summary — Live Console E2E + API Contract

**Date:** 2026-08-29
**Skill:** bmad-qa-generate-e2e-tests (2 passes)
**Scope:** Close the frontend↔backend integration gap flagged in the Epic 2/3/4 retrospectives — frontend unit tests stub `fetch`, backend tests use FastAPI `TestClient`, so real `client.ts` → real HTTP → real FastAPI → real orchestrator was never exercised together in one process.

## Framework

**Playwright** (`@playwright/test` ^1.62, Chromium) — newly added; the project had no browser e2e layer (only Vitest/jsdom + pytest/TestClient). `playwright.config.ts` boots **both** real servers per run:

- Backend: `backend/.venv` uvicorn → `api.app:app`, `PORTWATCH_SEED=1`, `ANTHROPIC_API_KEY=''` (forces the offline query template — deterministic, no LLM call).
- Frontend: `vite --host 127.0.0.1`, with `VITE_API_BASE_URL` injected by the config (no `.env` file).
- Hermetic: `reuseExistingServer: false`, fresh in-memory seed each run.

### No hardcoded values

- **Ports** live in `playwright.config.ts` only, as `E2E_BACKEND_PORT` / `E2E_FRONTEND_PORT` env-overridable defaults (`8123` / `5199`). The config derives the API base URL, exports it as `E2E_API_BASE_URL`, and passes `VITE_API_BASE_URL` straight to the Vite process — one authoritative value, no `.env.e2e`, no port literal in any spec.
- **Seed fixtures** (incident ids, row-label patterns, expected count, the query string) live in `frontend/e2e/fixtures.ts`, which mirrors `backend/api/demo_seed.py`. Specs import `API_BASE` / `SEED` / `resolvedRow()` — no seed string is re-typed in a spec body.
- `frontend/e2e/tsconfig.json` scopes the specs for the IDE/Playwright transpile; `tsconfig.node.json` now also type-checks `playwright.config.ts`.
- `vite.config.ts` `test.exclude` adds `e2e/**` so the Vitest run does not collect the Playwright `*.spec.ts` files.

## Generated Tests — `frontend/e2e/`  ·  **18 passing (~22s)**

Spec files run in alphabetical order under one `workers: 1` serial run; the mutating specs are named to sort into a safe sequence.

### `api-contract.spec.ts` — 7 tests (no browser, `APIRequestContext`)
Response **structure** validation, not just status codes, for every endpoint `client.ts` calls, against the `frontend/src/types/incident.ts` shape.

| Test | Asserts |
|---|---|
| `GET /incidents` | 200, array ≥ 7, every element matches the full `Incident` interface (nested `options[].predicted_impact`, `trace[].error`) |
| `GET /incidents/{id}` | 200, single `Incident`, id echoes |
| `GET /incidents/{unknown}` | 404 + string `detail` |
| `GET /incidents/query` | 200 `{answer: string}` non-empty; empty `q` → 200 honest "no match", never fabricated |
| `POST /kill-switch` | `{enabled:true}`→`{enabled:true}`, `{enabled:false}`→`{enabled:false}`, non-boolean → 422 |
| `POST /incidents/{id}/approval` | non-approvable → 200 + unchanged incident; missing `option_id` → 400; unknown incident → 404; bad verb → 422 |
| `GET /healthz` | 200 `{ok:true}` |

### `archive.spec.ts` — 3 tests (browser)
| Test | Real path |
|---|---|
| Navigate to `#/archive` | nav link `aria-current="page"`; "Incident Archive" region lists the 3 seeded resolved incidents (reused `IncidentRow`) |
| Select an archived incident | read-only `ExecutionTrace` (`role="log"`) shows `VERIFY`/`EXECUTE`; **no** Approve/Reject control mounted |
| "Live Console" link | returns to the `Incidents` feed region |

### `console-killswitch-safety.spec.ts` — 1 test (browser, safety property)
Engage the kill switch → select `demo-ks-blocked` → **Approve** → assert the action does **not** execute: the refetched `role="log"` trace contains "kill switch", the row never flips to resolved, the Approve control stays. Restores the switch to OFF. (Story 1.10 / epic-1-retro-item-2 end-to-end.)

### `console-smoke.spec.ts` — 6 tests (browser, from pass 1)
Feed polling · incident selection (detail/trace/rail/map) · AskPortwatch query · API error contract (404/422) · kill-switch engage/disengage · approval write path (`approve` + `select_alternative` → incident resolves via `apply_approval` → `approve_incident` → mock execution).

### `resilience.spec.ts` — 1 test (browser, order-independent)
Abort the `GET /incidents` poll route in the browser → assert the feed keeps the last-good rows (never an error screen) and shows the `.incident-feed__stale` "Last updated … ago" line after 8s → un-abort → stale line clears on the next success. (UX-DR10 / `client.ts` `ApiError` handling / `useIncidents` last-good retention.)

## Coverage

- **HTTP endpoints:** 6 / 6 exercised over real HTTP end-to-end — `GET /incidents`, `GET /incidents/{id}`, `GET /incidents/query`, `POST /incidents/{id}/approval` (`approve` + `select_alternative`), `POST /kill-switch`, `GET /healthz`. Status codes 200 / 400 / 404 / 422 all asserted; 200 bodies shape-checked.
- **UI workflows:** feed polling, selection + detail/trace/rail/map render, NL query, kill-switch engage/disengage, Tier-3 approval, alternative-option selection, Archive route + read-only trace, stale/last-good resilience, kill-switch-blocks-execution safety.
- **Not covered:** `reject` approval body (single Tier-3 fixture, consumed by `select_alternative`); DG-gate re-plan beat; the live agent pipeline (ingest → specialists → arbiter) — **no HTTP trigger exists**, out of scope until a `POST /signals` endpoint is built; visual/pixel/layout fidelity (Playwright asserts DOM + a11y).

## How to run

```
cd frontend
npm run e2e            # boots both servers, runs Chromium, tears down
npm run e2e:report     # open the last HTML report
```

Requires `backend/.venv` present (committed) and a one-time `npx playwright install chromium`.

## Known constraints

- **Order-dependent by design.** Serial run; the backend is one shared in-memory process seeded once per run and there is exactly one held Tier-3 incident. Spec file names encode the safe order: `api-contract` (read-only + self-restoring KS) → `archive` (read-only) → `console-killswitch-safety` (KS blocks, restores) → `console-smoke` (resolves `demo-ks-blocked` + `demo-tier3-alts`, last) → `resilience` (browser-side route abort, no server impact). Each full `npm run e2e` invocation is deterministic (fresh servers + fresh seed); individual tests are not reorderable.
- **`npm run verify` still green** (lint + build + test, 712 vitest tests). `e2e/` is outside the lint glob; `vite.config.ts` excludes it from Vitest; `tsc -b` now also checks `playwright.config.ts` (via `tsconfig.node.json`). `npm run e2e` is a separate command; **not yet wired into CI**.
- A benign `ConnectionResetError` is logged by uvicorn when `resilience.spec.ts` aborts in-flight poll sockets — the server keeps serving and the test passes.
- Chromium binary (~150 MB) is a one-time `npx playwright install chromium`, not vendored.

## Next steps

- Add `npm run e2e` as a CI job after `npm run verify`, starting from `npx playwright install --with-deps chromium`.
- Add a `reject` approval case once a second held Tier-3 fixture exists (or a test-only seed-reset endpoint).
- When a `POST /signals` / live-pipeline endpoint lands, add an e2e that drives a real incident from signal to synthesized options (the "golden path lands live" demo beat).

## Checklist validation (`bmad-qa-generate-e2e-tests/checklist.md`)

- [x] API tests generated — `api-contract.spec.ts` (out-of-process structure + status codes); in-process `backend/tests/api/test_api.py` (18) pre-exists
- [x] E2E tests generated — 4 browser spec files
- [x] Standard framework APIs (Playwright `getByRole` / web-first `expect`)
- [x] Happy path covered
- [x] Critical error cases (404, 422, 400, dead-poll, kill-switch-blocked)
- [x] All tests run successfully — **18 passed**
- [x] Semantic/accessible locators (`getByRole`, accessible names; a few `.class` locators for role-less status nodes)
- [x] Clear descriptions
- [x] No hardcoded waits/sleeps (Playwright auto-waiting + web-first assertions; the one long timeout is the real 8s staleness threshold)
- [~] Test independence — **serial by design** (shared in-memory backend, single Tier-3 fixture); rationale above
- [x] Summary created, tests in `frontend/e2e/`, coverage documented
