# Adversarial Review — Portwatch Architecture Spine

**Target:** `ARCHITECTURE-SPINE.md` (Portwatch, 2026-08-24)
**Method:** for each candidate hole, construct two concrete build units (people/lanes/components) that each follow every applicable AD to the letter, yet ship incompatible code. A pair "breaks" the spine if no AD, Rule, or Convention row actually pins down the shared contract they both depend on.

**Verdict: FAIL** — several load-bearing shared-data shapes (Incident, TraceEntry, arbiter "option", API endpoint surface, approval payload) are referenced by name across 2+ lanes but never given field-level shape. In a 4-person/6-day build these will diverge by day 2 and only surface at integration on Day 5-6.

---

## Finding 1 (Critical) — `Incident` record has no field-level shape

**AD-4** says "one `Incident` record per `incident_id`... embedded append-only `trace` list." **Models/** source tree says `models/` holds "Incident, TraceEntry data shapes" but the spine never enumerates them.

**Adversarial pair:** Person A (orchestrator, writes `Incident`) vs Person C (frontend `IncidentFeed`/`StatusQuery` components, reads `Incident` via API).

- Person A, obeying AD-4 + AD-8 + Consistency table literally, builds `Incident` with: `incident_id`, `status` (free string like `"awaiting_approval"`), `tier` (`1|2|3`), `confidence` (int), `trace: []`, and stuffs the arbiter's ranked options inside the *last trace entry's* payload (since "the trace list *is* the log" — Consistency Convention, row 3 — and no other field is specified for holding pending options).
- Person C, obeying AD-6 ("dashboard... approval card... poll the same read-only Incident endpoint") and AD-11 (approval card acts on "the arbiter's existing 2-3 ranked options"), builds the approval card assuming `Incident.pending_options: Option[]` is a **top-level field**, not something to be mined out of the trace array.

Both are letter-compliant. Integration breaks: the approval card either can't find options, or Person C writes trace-parsing logic Person A never designed the trace format to support (see Finding 2).

**Fix:** add an AD (or extend AD-4) with the literal `Incident` field list: `incident_id, status, tier, confidence, entity_refs, pending_options, trace, created_at, updated_at` at minimum — with `pending_options` explicitly a top-level field, not derived from trace.

---

## Finding 2 (Critical) — `TraceEntry` shape given only a `stage` enum, nothing else

Consistency Convention row 1 pins `stage` values (`INGEST`, `CORRELATE`, ... SCREAMING_SNAKE). Row 2 pins the **separate** error shape `{stage, error, retried, fallback_used}` (FR5). Nothing says what a *normal* (non-error) trace entry looks like, and nothing says how the FR5 error shape relates to a trace entry — is it a trace entry (reusing the `stage` field so there are two different enums sharing one key), or a sibling structure attached to one?

**Adversarial pair:** Person A (orchestrator emits trace entries at each pipeline stage) vs Person D (integration/demo scripting, builds the failure-injection demo scenario for FR5 and must read trace to script/verify it on stage).

- Person A builds trace entries as `{stage: "AGENT_CALL", timestamp, agent: "berth", data: {...}}` — one entry per agent call (3 entries fan out for berth/crane/yard), each with agent-specific payload shape.
- Person D, scripting the FR5 "agent timeout/failure" demo beat, needs to detect and highlight failure entries in the trace for the live demo. Reading only the Consistency table, Person D assumes failures appear as trace entries with `stage: "AGENT_CALL"` and a `retried`/`fallback_used` boolean sitting alongside `data` — but Person A (never told the error shape nests inside trace) instead pushed a **separate top-level `Incident.errors[]` list**, since AD-4 never said errors must live in `trace`.

Person D's demo script polls trace for `fallback_used: true` and finds nothing; the fallback narration silently never fires live.

**Fix:** state explicitly whether `{stage, error, retried, fallback_used}` (FR5) *is* a `TraceEntry` variant (same array, discriminated by presence of `error`) or a separate `Incident.errors` list — and give the full non-error `TraceEntry` shape (minimum: `stage, timestamp, summary/data`). Also pin: does fan-out to 3 specialist agents produce 3 trace entries or 1 aggregated `AGENT_CALL` entry? Frontend's `ExecutionTrace` component and the demo script need to agree on cardinality.

---

## Finding 3 (Critical) — arbiter's "ranked option" shape is a three-way shared contract with zero field spec

FR4/AD-11 both reference "the arbiter's existing 2-3 ranked options" as if it's a known structure. It is consumed by: (a) the Policy Engine (to classify tier — AD-8's pipeline runs DG-gate per option, tier classification presumably per top option or per all), (b) the DG/IMDG gate (checks each option for DG conflicts, AD-8), and (c) the frontend approval card (renders options, AD-11's `select_alternative(option_id)` needs an `option_id` to exist).

**Adversarial pair:** Person A (arbiter + policy engine + DG gate — all one person, so internally this one might stay consistent) is not the risk here; the real adversarial pair is **Person A's arbiter output** vs **Person C's `ApprovalPanel` component**, since Person C never sees Person A's Python types and works only from the spine + verbal/API contract.

- Person A, satisfying AD-11's "existing 2-3 ranked options," implements options as `List[dict]` with keys `id, plan, eta_minutes, dg_flag`.
- Person C, building `ApprovalPanel` against AD-11's literal API contract text — `select_alternative(option_id)` — assumes the wire field is named `option_id` (matching the function-signature naming in the AD itself), not `id`. `select_alternative` calls fail or silently select the wrong option if the API doesn't validate the key name strictly (e.g. defaults to option 0 on missing/None `option_id`).

**Fix:** pin the Option shape verbatim (field names, exact match to the `select_alternative(option_id)` parameter name used in AD-11) in the spine, not just in a person's head.

---

## Finding 4 (High) — "one read-only Incident endpoint" is ambiguous between one-endpoint-total and one-resource-family

AD-6: "dashboard (incident feed, trace view, approval card, status query) all poll **the same read-only Incident endpoint** at a 2-3s interval." This sentence is read two different ways depending on which noun "same...endpoint" binds to.

**Adversarial pair:** Person A/D (backend `api/` module) vs Person C (frontend, 5 different components: `IncidentFeed`, `ImpactGraph`, `ApprovalPanel`, `ExecutionTrace`, `StatusQuery`).

- Backend reading AD-6 literally as "one endpoint" builds a single `GET /api/incident` (singular, no id) returning **one flat blob** with everything (feed list + trace + pending options) crammed into one JSON response, on the theory that "the same...endpoint" = literally one URL for the whole dashboard.
- Frontend, needing feed (list of many incidents), per-incident trace (`ExecutionTrace`), and per-incident approval state (`ApprovalPanel`) as visually distinct components with independent poll cadences, builds against an assumed REST family: `GET /api/incidents`, `GET /api/incidents/{id}`, `GET /api/incidents/{id}/trace`. Four different fetches, all technically "the read-only Incident endpoint" as a resource concept, but four different URLs.

Both readings are defensible from the sentence as written. Whichever side didn't win the argument rebuilds the API layer or the fetch layer on Day 5.

**Fix:** the spine should give the literal endpoint list (method + path + response shape), not a prose description of a "read-only Incident endpoint" left to interpretation. This is exactly the kind of boundary AD-6 implies but doesn't pin.

---

## Finding 5 (High) — Approval endpoint wire shape (AD-11) unspecified beyond the three verbs

AD-11 pins the *contract as a set of verbs* — `approve` / `reject` / `select_alternative(option_id)` — but not: HTTP method, whether `incident_id` is a path param or body field, whether it's one endpoint with an `action` discriminator or three endpoints, or the response shape (does approval return the updated `Incident`, or `204 No Content`, requiring the frontend to re-poll?).

**Adversarial pair:** Person A (writes the approval endpoint handler, which is the *only* write path per AD-6/AD-4) vs Person C (`ApprovalPanel`, the only frontend component that writes).

- Person A builds `POST /api/incidents/{id}/approval` with body `{"action": "approve"}` / `{"action": "select_alternative", "option_id": "..."}`, single endpoint, discriminated union.
- Person C, working from AD-11's verb-per-function framing (`select_alternative(option_id)` reads like a function call, not a discriminator payload), builds three separate calls: `POST /api/incidents/{id}/approve`, `/reject`, `/select-alternative` with the id passed as a query param.

Neither violates AD-11's text (it never states HTTP method or endpoint count), so this is a straight 404 at integration.

**Fix:** literal endpoint signature(s) with method, path, request body schema, response schema — same fix pattern as Finding 4, applied to the one write path the whole system has.

---

## Finding 6 (High) — DG-gate loop-back re-entry point is internally inconsistent in the spine itself

AD-8: "On conflict, control returns to the arbiter for a new recovery option, which is then re-classified from AD-4's policy stage." **AD-4 is the single-writer/Incident-state AD — it has no "policy stage."** The policy-tier-classification stage is described in the Design Paradigm's pipeline (`...synthesize → policy → DG-gate...`) and lives under AD-8's own "Binds: FR9" plus the Capability Map row D (`policy/policy_engine.py`, governed by AD-7/AD-8). This is very likely a typo for "the policy stage" (no AD-4 reference intended), but as written it's a broken cross-reference that two engineers can resolve differently.

**Adversarial pair:** whoever builds the orchestrator's loop-control code (Person A) reading this at 11pm on Day 3, vs whoever later debugs/extends it (Person D, doing integration/demo scripting, who needs to know exactly what re-runs on a DG conflict to script a reliable demo beat).

- Reading "re-classified from AD-4's policy stage" as sloppy shorthand for "recompute confidence + re-run policy tier classification" (since AD-4 does own trace/state and this is where confidence lives per the Confidence Formula box in the pipeline diagram), Person A's orchestrator on DG-conflict re-invokes: synthesize(new option) → confidence → policy → DG-gate again.
- Person D, reading the same sentence as "just re-run tier classification on the new option, confidence is arbiter's job upstream and doesn't change," scripts the demo assuming confidence stays pinned across a DG-gate retry and only tier/DG re-evaluate. When Person A's implementation actually recomputes confidence and it comes back different (e.g. crosses a tier threshold), the live-demo narration ("still Tier 2, just a different option") is wrong on stage.

Also unaddressed: **loop termination.** Nothing caps DG-gate retry count — if the arbiter keeps proposing options that keep failing DG, this loop-backs forever. No max-retry Rule exists (unlike, presumably, AGENT_CALL fallback logic implied by FR5's `retried: bool`).

**Fix:** correct the cross-reference (should almost certainly read "re-classified from the policy stage," dropping "AD-4's"), state explicitly which pipeline stages re-run on DG-conflict (confidence? policy only? both?), and add a max-retry/terminal-failure Rule for the DG-gate loop.

---

## Finding 7 (Medium) — Entity key format for `IncidentRegistry` correlation is unspecified, and must match Person B's mock-service IDs

AD-5: registry "keyed by entity: vessel/berth/crane/yard-block." No format is given for what a key actually looks like (`"crane:CR07"`? `"CR07"`? `{type: "crane", id: "CR07"}`?). This key must originate from ingestion (normalizing raw signals — Person A's `ingestion/` per source tree) and must match whatever entity identifiers Person B's mock services (`crane_scheduler.py`, `yard_manager.py`, etc.) use internally, since specialist agents calling those mock services need the same entity reference the incident correlated on.

**Adversarial pair:** Person A (`ingestion/` + `registry/`) vs Person B (mock services).

- Person A normalizes incoming signals to a composite string key `"{entity_type}:{entity_id}"` e.g. `"crane:C7-CR03"`, matching AD-12's terminal-block naming style (`Tuas C7`).
- Person B, building `crane_scheduler.py` mock independently against FR3/FR13 with no visibility into the registry's key format, models cranes with a bare numeric `crane_id: int` (e.g. `crane_id: 3`), since nothing in the spine tells mock-service builders to align their entity ID scheme with the registry's.

Result: the Crane specialist agent, given a correlated `incident_id` + entity key `"crane:C7-CR03"` from the orchestrator, cannot look up the right mock-service crane record — silent mismatch, not a crash, which is worse (wrong crane's data used in analysis, discovered late).

**Fix:** pin one canonical entity-ID scheme (format + example per entity type: vessel, berth, crane, yard-block) in the Consistency Conventions table, binding both ingestion/registry (Person A) and mock services (Person B) to it.

---

## Finding 8 (Medium) — Tool manifest format (AD-3) unspecified; ambiguous who "owns" adding a tool for a new mock service

AD-3: "each agent's allowed tools come from a static manifest (agent name → tool schema list)... Adding capability means editing the manifest, never the prompt." Source tree: manifests live under `agents/` alongside `berth.py`, `crane.py`, etc. — implying Person A owns them. But mock services (Person B's lane) are the actual tool *implementations* the manifest schemas describe (Anthropic tool-use schemas need name/description/input_schema matching what the mock service actually accepts).

**Adversarial pair:** Person A (owns `agents/` manifests) vs Person B (owns `mock_services/`, e.g. `agv.py`, `gate.py` — added later per AD-12/FR17's Day-5 stretch scope for two-terminal-block routing).

- Person A writes the Crane agent's tool manifest early (Day 1-2) with a schema for `query_crane_status(crane_id: str)`, matching whatever Person B's `crane_scheduler.py` mock looked like *at that time*.
- Person B, extending `yard_manager.py` on Day 5 per AD-12 to support the two-terminal-block model, changes the mock's function signature to `query_block_utilization(terminal: Literal["Tuas C7","Pasir Panjang P2"])` — a reasonable, spine-compliant change (AD-12 explicitly mandates this) — but nothing in AD-3/AD-12 requires Person B to notify/update the manifest Person A owns. The manifest and the mock silently drift; the agent's tool call either 400s against the mock or the mock silently ignores an unexpected param shape.

**Fix:** either (a) state the manifest is generated/derived from the mock service's own declared schema (single source of truth, no drift possible), or (b) explicitly assign manifest-update ownership to whoever changes a mock service's signature, and require the Day-5 AD-12 rollout to include a manifest-sync step.

---

## Finding 9 (Low) — Kill switch access path is unspecified: who exposes it and where does the operator toggle it?

AD-7 pins *enforcement* (one flag, one check point, immediately pre-execution) precisely — that part is solid. It does not say where the flag lives (module ownership) or how it gets set to `true`. FR10 implies an operator-facing kill switch exists in the UI, but AD-6's write-path Rule says "No write path from frontend to Incident except the approval action (AD-11)" — the kill switch is not `Incident` state, so it's arguably exempt from that restriction, but no AD grants it a write path either.

**Adversarial pair:** Person C (frontend, needs a kill-switch toggle control) vs Person A/D (backend, owns the flag per AD-7's "single global in-memory flag").

- Person C, reading AD-6's Rule as scoped only to `Incident` writes, builds a kill-switch toggle calling an assumed `POST /api/kill-switch {enabled: bool}` endpoint that doesn't exist yet, since no lane's source-tree entry mentions it (`api/` is described only as "read-only Incident/trace endpoints, approval endpoint").
- Person A, building strictly from the source tree's `api/` description (read-only + approval only), never scaffolds a kill-switch endpoint at all — it's set only via a hardcoded config toggle or a debug script for the demo, since nothing assigns it an API surface.

Demo-day risk: the kill switch, a Security §5 safety feature, may end up with no operator-facing control at all, or a frontend button pointing at a 404.

**Fix:** add the kill-switch endpoint explicitly to the `api/` module description and Capability Map (currently absent — Section F/Security is the closest fit but doesn't list it), with method/path/payload.

---

## Summary Table

| # | Severity | Pair | Missing contract |
|---|---|---|---|
| 1 | Critical | Person A orchestrator vs Person C frontend | `Incident` field-level shape |
| 2 | Critical | Person A orchestrator vs Person D demo scripting | `TraceEntry` shape + FR5 error-entry relationship + fan-out cardinality |
| 3 | Critical | Person A arbiter vs Person C `ApprovalPanel` | Arbiter "option" field shape |
| 4 | High | Backend `api/` vs Frontend components | Literal endpoint list (AD-6) |
| 5 | High | Backend `api/` vs `ApprovalPanel` | Approval endpoint wire shape (AD-11) |
| 6 | High | Orchestrator loop-control vs demo scripting | DG-gate loop-back re-entry scope + broken AD-4 cross-ref + no max-retry |
| 7 | Medium | Ingestion/Registry vs Mock services | Entity-ID key scheme |
| 8 | Medium | Agent manifests vs Mock services | Manifest/mock schema sync ownership |
| 9 | Low | Frontend vs Backend `api/` | Kill-switch endpoint existence/shape |

## Recommendation

Before Day 1 code starts, tighten AD-4 (add literal `Incident`/`TraceEntry` field lists), AD-6 and AD-11 (add literal endpoint signatures), and AD-8 (fix the "AD-4's policy stage" cross-reference and state DG-loop retry scope/cap). These five are the ones most likely to cause silent, late-discovered integration failures given the lane split, since they're each written by one person and consumed by another with no shared type definition to compile against.
