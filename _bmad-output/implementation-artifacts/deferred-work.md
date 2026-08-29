- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: Signal normalization does not semantically validate field values (e.g. `eta` timestamp format, `congestion_level`/`queue_length` numeric and non-negative) — only presence/blankness is checked.
  evidence: Blind-hunter and edge-case-hunter review of Story 1.1's diff both flagged that malformed-but-present values (e.g. `eta: "not-a-date"`, `congestion_level: -5`) pass normalization silently. Story 1.1's frozen spec scoped this story to structural normalization only; deeper validation was never in its I/O matrix.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: Entity ids/types are not normalized for case or whitespace, and are not checked for embedded `:` characters, before being passed into `make_entity_ref()`.
  evidence: Edge-case-hunter review of Story 1.1: two signals referencing "the same" entity with inconsistent casing/whitespace (e.g. `"C7-3"` vs `" c7-3 "`) would silently fail to correlate in Story 1.2, and an id containing `:` would corrupt the fixed `type:id` format's parse-back assumption. Low risk while all producers are internal/controlled, but worth hardening before Story 1.2 (correlation) or Story 3.x's mock services are built on top of it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: `_handle_dg_exception` only includes `container_id` in `entity_refs`, dropping the required `vessel_id` field from correlation even though FR2 correlates on "same vessel/berth/crane/yard block."
  evidence: Blind-hunter review flagged this as an unexplained asymmetry (vessel_id is required but not used for correlation for this signal type, unlike every other type where all id fields feed entity_refs). Not fixed now because it's a design question for Story 1.2 (correlation) to weigh in on — whether DG exceptions should correlate at the vessel level in addition to the container level — rather than a defect in Story 1.1's own contract.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-signal-ingestion-normalization.md`
  summary: No allowlist/type-checking on non-`operator_request` entity id fields (crane_id, yard_block_id, gate_id, area_id, container_id, vessel_id) confirming they are strings before being embedded in `entity_refs`.
  evidence: Edge-case-hunter review: a non-string id (int, list, dict) passed through any handler would produce a malformed-looking but "accepted" entity_ref instead of a rejection. Same root cause as the `operator_request` entity_type allowlist patch applied in this story's review, but broader in scope — deferred rather than expanding this story's patch set beyond what the review specifically demonstrated as exploitable.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-agv-gate-specialist-agent.md`
  summary: DESCOPED 2026-08-29 (sprint-change-proposal-2026-08-29.md). FR20 AGV/Gate specialist — a conditional 4th specialist for `gate_metric` incidents. Deferred because it requires unfreezing the Day-3-frozen 3-specialist contract; not "strictly additive".
  evidence: Both Story 3.3 and 3.5 blocked at planning on the same contract. Epic 3's generalization goal is already met by delivered 3.1/3.2/3.4, so cutting these two does not weaken the epic's judging evidence. `backend/` byte-unchanged at `2a269d4`.
  design: >
    Post-sprint, to land FR20 without regressing the golden path:
    (1) Relax `SpecialistBundle` to `min_length=3` only (drop `max_length=3`), keep berth/crane/yard as positions 0-2.
    (2) Extend `AgentName` with `"agv_gate"`; add `backend/agents/agv_gate.py` as a pure-data module (NAME / SYSTEM_PROMPT / TOOL_MANIFEST, tool names disjoint from the other three) mirroring `berth.py`.
    (3) In `dispatch.run_specialists`, build the agent list dynamically: base `("berth","crane","yard")` plus `"agv_gate"` appended IFF the incident's trace carries a CORRELATE entry with `detail.signal_type == "gate_metric"`. Non-gate incidents keep the exact 3-entry bundle.
    (4) Relax the arbiter guard (`arbiter.py:217`) from `!= 3` to `< 3`; confirm the arbiter prompt tolerates a 4th analysis.
    (5) Add `agv_gate` canned entry to `mock_override.CANNED_SPECIALIST`.
    (6) Re-freeze tests: `test_bundle_requires_exactly_three_recommendations` -> "at least berth/crane/yard, in order"; `len(fake.calls) == 3` / `max_in_flight == 3` -> assert `>= 3` for gate incidents, `== 3` otherwise.
    Reuses existing `agv_manager` / `gate_manager` mocks — no new mock contract. No new pipeline stage, endpoint, tier, or policy rule.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-weather-circuit-breaker-agent.md`
  summary: DESCOPED 2026-08-29 (sprint-change-proposal-2026-08-29.md). FR18 Weather specialist — conditional specialist for `weather_event` incidents. Same frozen-contract deferral as FR20.
  evidence: Blocked at planning on the identical 3-specialist contract. The AC2 physical-safety-to-Tier-3 requirement was separately assessed as NOT blocking — existing `classify_tier` (`backend/policy/engine.py`) already routes `reversible=False` / `risk=="high"` / `cost=="high"` / `dg_involved` / SLA-breach to Tier 3 before any confidence check. `weather_event` is already a handled signal type. `backend/` byte-unchanged at `7b309b7`.
  design: >
    Same 6-step roster-unfreeze as the FR20 entry above, with `weather` in place of `agv_gate`, gated on `detail.signal_type == "weather_event"`, and a mocked meteorological-radar TOOL_MANIFEST. The specialist emits crane-pin-lock / AGV-reroute options with `reversible=False` (or `risk="high"`) so the existing `classify_tier` lands them in Tier 3 — no weather-specific carve-out in the deterministic layers (AC3). If FR20 is built first, FR18 is then genuinely additive on top of the already-unfrozen roster.

- source_spec: `_bmad-output/implementation-artifacts/spec-ad19-agent-roster-read-surface.md`
  summary: Wire the live orchestrator write of incident.agents + per-recommendation AGENT_CALL trace entries once a live ingestion→specialists→arbiter→policy chain exists.
  evidence: AD-19 spec delivered the field + demo-seed data only; run_specialists has no live (non-test) caller today, so the orchestrator write has no call site. Integration point documented in backend/agents/dispatch.py.

- source_spec: `_bmad-output/implementation-artifacts/spec-harbor-signal-reskin.md`
  summary: Route changes for the Harbor Signal IA — rename the Incident Archive route/view to "Audit Trail" and add an "Active Incidents" filtered view (both filter GET /incidents client-side, no new endpoint, per AD-6); rail nav = Dashboard / Active Incidents / Audit Trail.
  evidence: Split from the Harbor Signal re-skin build (2026-08-29) as an independently shippable goal — route/nav work is fully decoupled from the token swap + component restyle + AgentRoster. EXPERIENCE.md (ux-PSA CODE SPRINT-2026-08-29) IA table + ARCHITECTURE-SPINE.md AD-18 frontend seed are the references.

- source_spec: `_bmad-output/implementation-artifacts/spec-harbor-signal-reskin.md`
  summary: epic-4 retro items 1 & 2 — add case "POLICY_START" to GeoMapPanel.stageToStateKey (-> "deciding", matching stageRail's fold) with a unit test, and a frontend-context note that GeoMapPanel.stageToStateKey and stageRail.RAIL_STAGES are two hand-maintained projections of backend trace.py STAGES.
  evidence: Split from the Harbor Signal re-skin build (2026-08-29) — small, fully independent stage-mapping fix; originally carried in the epic-4 retrospective (epic-4-retro-08-29-2026.md) action items 1 and 2.

- source_spec: `_bmad-output/implementation-artifacts/spec-harbor-signal-reskin.md`
  summary: AgentRoster needs `pending` / `running` run-states (and to render the frozen three even when only 1-2 agents have arrived) once a live ingestion→specialists→arbiter→policy chain exists. Today `deriveRoster` only distinguishes complete/timeout/fallback and renders only the arrived chips.
  evidence: Review (blind-hunter) of the re-skin build. Not fixable now — no live pipeline exists (demo incidents are fully-formed at seed time, see the AD-19 live-wiring deferral above). When the live chain lands, `AgentRunState` gains `pending`/`running` and the roster pads to berth/crane/yard from `ROSTER_AGENTS` regardless of which have reported.

- source_spec: `_bmad-output/implementation-artifacts/spec-portwatch-tuas-chrome.md`
  summary: KPI / MetricCard strip on the Live Console — active-incidents / pending-approval / resolved counts derived client-side from the polled GET /incidents list, plus a few clearly-illustrative "nominal" readouts (equipment health, feeds) and a selected-incident confidence tile. No /overview endpoint (AD-18).
  evidence: Split from the portwatch-tuas chrome-match build (2026-08-29). Needs the ported MetricCard primitive from that build first, then ships independently. portwatch-tuas Home.tsx getOverview() is the content reference; values are derived/illustrative, not a new mock dataset (reconcile-portwatch-tuas-src.md).

- source_spec: `_bmad-output/implementation-artifacts/spec-portwatch-tuas-chrome.md`
  summary: Fuller geographic map composition in GeoMapPanel — seafoam route trace for the active vessel, berth/yard nodes, Berths/Yards/Routes layer toggles, selected-vessel emphasis, matching frontend/portwatch-tuas/client/src/components/Map.tsx. Stays a bundled read-only projection of polled state (AD-17), no live tile/AIS calls.
  evidence: Split from the portwatch-tuas chrome-match build (2026-08-29). The urgent white/bright land-fill regression (light seafoam-tint fill glaring on the ink ground) is fixed IN that build via a dark --geo-land token; this entry is the remaining composition work (trace / toggles / nodes), isolated to GeoMapPanel + MapPanel.
