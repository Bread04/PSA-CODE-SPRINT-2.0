# Adversarial Incompatible-Build Review — 2026-08-30

**Target:** `ARCHITECTURE-SPINE.md` (Portwatch, status: final)
**Lens:** Construct two units one level down that each obey every AD (AD-1..AD-19) and every Consistency Convention to the letter, yet build incompatibly. Each such pair is a hole to close with a new or tightened AD.
**Method:** read the spine against the shipped backend (`backend/orchestrator/run.py`, `orchestrator/trace.py`, `registry/incident_registry.py`, `agents/dispatch.py`, `agents/base.py`, `models/incident.py`, `api/demo_seed.py`) and the governing UX companion (`ux-PSA CODE SPRINT-2026-08-29/EXPERIENCE.md`, *The Orchestra*).

---

## Verdict: FAIL

Not because the spine is unbuildable — most of it is already built — but because at least three constructed pairs below build to the letter of every AD and still produce a **broken flagship demo surface**: the DG-forced-re-plan beat renders green, the approval button posts an action string the backend rejects, and the "whole orchestra" agent chips cannot show the run-states EXPERIENCE.md specifies. Each is closable by tightening one AD or adding one convention line. Details and the full pair list follow.

---

## Pair 1 — DG_CHECK `detail` shape: two owners, two shapes, one key that decides the render

**Unit A — `backend/policy/dg_gate.py` + `orchestrator/run.py` (live path), built to AD-8 + the cross-lane sync line.**
The cross-lane sync convention says: `DG_CHECK -> violation (+ reason / rejected_option on a violation)`. The shipped live path (`run.py:271-292`) emits exactly this: `{"violation": True, "reason": ...}` on a conflict, `{"violation": False}` on a pass. `violation` is always present.

**Unit B — `backend/api/demo_seed.py` (demo-seed path), built to AD-18's DG bullet.**
AD-18 says: "DG-gate — `DG_CHECK` trace `detail` (`{violation: bool}` live; `{rejected_option, reason}` in the demo seed)". A builder following that bullet writes the demo-seed DG_CHECK with **no `violation` key** — and the shipped `demo_seed.py:99` does exactly that: `_tr("DG_CHECK", 15, {"rejected_option": "opt-3", "reason": "DG/IMDG segregation conflict"})`.

**The incompatibility:** both units obey the spine (each cites a different spine sentence). Person C's DG-gate renderer keys on `detail.violation` (the cross-lane line tells them to). On the demo-seed incident that key is `undefined` → falsy → the DG hard gate renders **PASS (seafoam)** during the `demo-tier3-alts` incident, which is precisely the "VIOLATION → RE-PLANNING" demo beat EXPERIENCE.md §5 builds the whole console around. The spine contradicts itself: the cross-lane sync line says `violation` is always present; AD-18's DG bullet says the demo seed omits it.

**Close it:** AD-18 (or a new AD) must pin one DG_CHECK `detail` schema for **both** paths — `violation: bool` mandatory always, `reason` and `rejected_option` optional-on-violation — and state that the demo seed MUST set `violation` explicitly. Delete the "`{rejected_option, reason}` in the demo seed" wording.

---

## Pair 2 — Approval action string: AD-11 vs the governing UX companion

**Unit A — `backend/api/approval.py` route, built to AD-11 + the API seed.**
AD-11 and the API seed pin the body as `{action: "approve" | "reject" | "select_alternative", option_id?: str}`.

**Unit B — `frontend/src/components/ApprovalBanner.tsx`, built to EXPERIENCE.md's data-contract table.**
EXPERIENCE.md "Data contract (backend reconciliation handoff)" row: `POST /incidents/{id}/approval — { action: approve|reject|modify, optionId, note }`. A frontend builder following the companion the spine names as *Governed by* posts `{action: "modify", optionId: "...", note: "..."}`.

**The incompatibility:** `"modify"` ≠ `"select_alternative"`; `optionId` ≠ `option_id`; `note` is absent from the spine contract entirely. The one write path the operator has in the demo (besides the kill switch) 400s or silently no-ops. AD-11 says "the spine wins on conflict", but no line in the spine actually reconciles the three string deltas, so two conformant builders diverge. The camelCase/snake_case split is systemic: EXPERIENCE.md's whole data-contract table is camel (`tierReason`, `dgGate`, `confidenceContribution`) while every backend model is snake.

**Close it:** add a Consistency Convention line — "JSON wire format is snake_case verbatim from the Pydantic `model_dump()`; the frontend does not camelize; the approval action literal is `select_alternative`, never `modify`." And add `note` to the approval body seed (accept-and-ignore is fine) or state it is unsupported.

---

## Pair 3 — Agent run-state (QUEUED/RUNNING/COMPLETE/TIMEOUT/FALLBACK) is not derivable from what AD-19 pins

**Unit A — `orchestrator` writer, built to AD-19 to the letter.**
AD-19 pins `Incident.agents: list[SpecialistRecommendation]` with fields `agent, summary, actions, constraints, rationale` — **no `state` field** — plus one `AGENT_CALL` trace entry per specialist with `detail: {agent, mock_forced}` and the standard `{stage, error, retried, fallback_used}` shape on timeout/fallback. Shipped `models/incident.py:81` and `demo_seed.py:59-90` match: entries carry no run-state.

**Unit B — `frontend/src/components/AgentRoster.tsx`, built to EXPERIENCE.md *The Orchestra* §2.**
EXPERIENCE.md requires each chip to show "its run state (`QUEUED → RUNNING → COMPLETE`, or `TIMEOUT → FALLBACK` with the reason)" and, in the data-contract table, `agents[] — { name, state, recommendation, constraints, confidenceContribution }`.

**The incompatibility, state by state:**
- `COMPLETE` — derivable: `agent` present in `Incident.agents` and its `AGENT_CALL` row has `error == null`.
- `FALLBACK` — derivable: that agent's `AGENT_CALL` row has `fallback_used: true`.
- `TIMEOUT` — partially: `error != null && fallback_used == false`. But per FR5 a fallback always follows a timeout, so this is never a resting state the poll can catch.
- `QUEUED` vs `RUNNING` — **not derivable at all.** `run_specialists` (`dispatch.py:74-116`) renders the brief once, fires `asyncio.gather` on all three, and the orchestrator appends the 1–3 `AGENT_CALL` entries only **after** `gather` returns. There is no per-agent "started" marker, and because `gather` resolves atomically the frontend never observes "berth COMPLETE, crane RUNNING". During the ~15 s the specialists run, `Incident.agents == []` and there are zero `AGENT_CALL` rows — all three chips sit in one indistinguishable "not started" bucket. EXPERIENCE.md explicitly wants the fan-out drawn "so it reads as 'these ran at once'", i.e. three simultaneously-RUNNING chips. AD-19 cannot produce that frame.
- `confidenceContribution` per agent — not emitted anywhere. The confidence formula's `disagreement` input is a single aggregate bool (`run.py:149`); there is no per-specialist contribution.

Two conformant builders: Person A ships the 5-field `SpecialistRecommendation`; Person C's roster reads `.state` and `.confidenceContribution` off each entry and renders `undefined`.

**Close it:** either (a) tighten AD-19 so the orchestrator writes a `state` field per agent AND emits an `AGENT_CALL` "started" entry (or a `run_state` map) before `gather`, so QUEUED/RUNNING/COMPLETE are real; or (b) amend EXPERIENCE.md to a 3-state chip (PENDING / DONE / DEGRADED) that AD-19's completion-only trace can actually feed, and delete `state` / `confidenceContribution` from the data-contract row. Right now the spine promises a surface it does not pin the data for.

---

## Pair 4 — CONFIDENCE `detail`: no pinned discriminator between structured and prose

**Unit A — live `CONFIDENCE` writer** (`run.py:153-164`): `detail = {confidence:int, staleness_seconds, fallback_fields, mock_forced, disagreement, variance_exceeds}`.
**Unit B — demo-seed `CONFIDENCE` writer** (`demo_seed.py:97`): `detail = {"reason": "Down from 91% — ..."}` — **no `confidence` int, no structured keys.**

AD-18 says "the frontend renders whichever is present". But it never names the discriminator key, and the two shapes are not defined as mutually exclusive. A conformant Person C picks `if "confidence" in detail` to mean "structured" → the demo-seed entry (which lacks `confidence`) falls through to a prose branch that then can't find `reason` if a different seed author included `confidence` for convenience. A second conformant Person C picks `if "staleness_seconds" in detail`. Both are "correct" against AD-18; they disagree on the demo seed.

**Close it:** pin the discriminator explicitly — e.g. "the demo-seed path emits `detail.reason` (str) and NO structured keys; the live path emits the structured keys and NO `reason`; the frontend branches on `"reason" in detail`." State it as an invariant the seed MUST honor.

---

## Pair 5 — Two writers of one `Incident`: AD-4 ("only the orchestrator") vs AD-5 (registry mutates + traces)

**Unit A — `IncidentRegistry`, built to AD-5.** `correlate()` (`incident_registry.py:91-128`) **appends a `CORRELATE` `TraceEntry`** and mutates `incident.entity_refs` and `incident.last_signal_at` via `_merge_signal`.
**Unit B — the per-incident orchestrator task, built to AD-4.** AD-4: "**Only** the orchestrator coroutine writes to `Incident` or appends trace entries."

These two spine rules directly contradict on the literal text. Today it is benign only because correlation happens before the orchestrator task is spawned. But AD-5 also says: "A match within the 15-minute rolling window **routes the signal into the existing incident's orchestrator**." That is the race the prompt asks about, and the spine specifies **no mechanism** for it:

- A conformant Person A (ingestion) reads "routes into the existing incident's orchestrator" as **spawn a fresh orchestrator task for the same `incident_id`** → now two orchestrator tasks own one `Incident` → the exact double-writer AD-4 exists to forbid, with concurrent `incident.trace.append` and `incident.tier` writes.
- A second conformant Person A reads it as **the registry mutates the live incident in place and the running orchestrator picks it up on its next stage** → the registry writes `entity_refs` / `last_signal_at` / a `CORRELATE` trace row into an `Incident` whose orchestrator is mid-`asyncio.gather`. Even under single-threaded asyncio (registry `correlate` is sync, so it won't interleave mid-function), the running analysis captured `entity_refs` **by alias** for the brief (`dispatch.py:74` renders once, but a naive specialist could hold `incident.entity_refs`), and a late `CORRELATE` entry lands in `trace` **after** `POLICY_DECISION` — the append-only trace is chronological, not pipeline-ordered.
- A third conformant Person A reads AD-5's "routes into the orchestrator" as a no-op after correlation (the signal is recorded and dropped) → the second signal for a live incident never influences the recommendation at all.

Three spine-conformant implementations, three different behaviors, and one of them re-opens AD-4.

**Close it:** AD-4 must carve out the registry explicitly ("the `IncidentRegistry` writes `entity_refs`, `last_signal_at`, and the `CORRELATE` entry; after the orchestrator task is spawned, only the orchestrator writes — the registry hands a mid-flight signal to the running task via a single-consumer queue / re-entrancy hook, never a second task, never a direct write"). And a new AD must define what "route into the running orchestrator" *does*: re-run from `SYNTHESIZE`? annotate and continue? The spine currently leaves this to invention.

---

## Pair 6 — Stage-rail state derivation: the trace records completions only, but the rail needs pending/active/done

**Unit A — trace producer**, built to AD-14 + `trace.py:STAGES`. Stages are written on **completion** (or on a bookkeeping boundary like `POLICY_START`). There is no `AGENT_CALL_START`, no `SYNTHESIZE_START`. On a DG re-plan (`run.py:269-289`) the loop re-emits `CONFIDENCE` and `POLICY_DECISION` and `DG_CHECK` but **never re-emits `SYNTHESIZE` or `AGENT_CALL`**.

**Unit B — `StageRail.tsx`**, built to EXPERIENCE.md *The Orchestra* §1: every stage must show `pending | active | done | degraded | blocked`, and "the rail visibly loops back to `SYNTHESIZE`" on a DG violation.

**The incompatibilities:**
- "active" (the current, emphasised stage) is underivable. During the ~15 s specialists run, the last trace entry is `CORRELATE` and `AGENT_CALL` has not appeared. Is `AGENT_CALL` pending, active, or stalled? A conformant Person C using "lowest-order stage not yet in trace = active" and a second using "highest-order stage in trace = done, next = active" agree here but neither rule is sanctioned by the spine, and they diverge the moment a stage is skipped (e.g. Tier 1/2 has no `APPROVAL` entry — is `APPROVAL` pending forever, or skipped?).
- The DG loop-back: EXPERIENCE.md says the rail loops to `SYNTHESIZE`; the trace's loop-back is visible only at `CONFIDENCE`/`POLICY_DECISION`. Person C animating "rail cursor returns to SYNTHESIZE" has no trace event to hang it on.
- Multiple `POLICY_DECISION` / `CONFIDENCE` / `DG_CHECK` entries exist after a re-plan. Which is "current"? A conformant Person C taking the **first** `POLICY_DECISION.detail.tier` shows a tier that disagrees with `Incident.tier` (the last one). AD-18 says derive tier from `Incident.tier` — but derive the *reason* from "the selected `RecoveryOption`", and after a DG-forced Tier 3 `selected is None` (`run.py:279`) — there is no selected option, so AD-18's reason-derivation recipe has no defined input for its own headline case.

**Close it:** add an AD that pins rail-state derivation from an append-only completion-only trace: "rail stage S is `done` iff a trace entry with `stage==S` (and no `error`) exists; `degraded` iff the latest `stage==S` entry has `error`; `blocked` iff `error` + `blocked` in detail; `active` = the lowest-order non-terminal stage with no entry; skipped stages (Tier 1/2 `APPROVAL`) are `done`/`n-a`, not `pending`. On re-plan, the rail reflects the **last** entry per stage." And give AD-18 a defined tier-reason for the `selected is None` case.

---

## Pair 7 — Entity-ref format: two examples, no grammar

**Unit A — ingestion normalizer**, built to the cross-lane sync line ("`entity_refs` values are the exact ids the ingestion layer normalizes to, e.g. `vessel:MSC-ANNA`, `berth:C7-3`").
**Unit B — Person B mock services + `frontend/src/lib/geo.ts` fixture (AD-17) + AD-12 Yard Manager.**

The spine gives two example strings and no rule for: the type-prefix vocabulary (cross-lane line and demo use `vessel|berth|crane|yard|gate` — 5; AD-5 says "vessel/berth/crane/yard-block" — 4, and names it `yard-block`, not `yard`; `gate` appears in neither AD-5 nor the shape doc), case (`MSC-ANNA` upper — guaranteed? or is `msc-anna` also valid?), separator inside the token (`C7-3` uses `-`; so does the type separator `:` — but a token with a `:` would be ambiguous), and the allowed charset.

Concrete divergence already in the seed: `demo_seed.py` carries the same yard block twice — as `entity_refs = ["yard:TUAS-C7", "yard:PASIR-PANJANG-P2"]` (upper, hyphen) and as CORRELATE payload keys `{"tuas_c7": 0.93, "pasir_panjang_p2": 0.44}` (lower, underscore). AD-12's Yard Manager keys its two blocks one way; a specialist tool call (AD-3 manifest) or a `geo.ts` lookup keyed the other way misses. Registry correlation (AD-5) is exact-string equality (`incident_registry.py:141`), so `berth:C7-3` and a yard `C7` never correlate even when they are the same quay.

**Close it:** add a Consistency Convention: pinned prefix set, `type:TOKEN` grammar, `TOKEN` charset `[A-Z0-9-]`, upper-case canonical, and one owner (ingestion `make_entity_ref`) that both Person B and `geo.ts` import or mirror. Reconcile AD-5's `yard-block` vs the shape doc's `yard` and register `crane` / `gate`.

---

## Pair 8 — `run_specialists(incident)` / `synthesize_options(incident)` take the full mutable `Incident` — is that an AD-4 violation?

AD-4: "do not pass a mutable `Incident` reference into any non-orchestrator function." The shipped `agents/dispatch.py` functions `run_specialists(incident)` and `synthesize_options(incident)` **do** receive the full mutable `Incident`; they mitigate by rendering a string brief once (`_incident_summary`) and never propagating the reference. But they live in `agents/`, not `orchestrator/`. A conformant Person A reading "non-orchestrator function" literally would flag these as violations and refactor them to take a pre-built `IncidentBrief` value — changing the call signature Person building the arbiter/specialists codes against. A second conformant Person A reads "the dispatch layer *is* part of the orchestrator" and passes `incident` freely, and a downstream specialist author then reads `incident.trace[-1].detail["payload"]` directly off the live object (as `base.py` docstring notes the brief does). Two readings, two call contracts, and one of them hands the live object to agent code.

Compounding: AD-14 says "**every** stage transition writes a trace entry (AD-4)". A specialist author who internalizes AD-14 but not the depth of AD-4 will have the specialist append its own `AGENT_CALL` entry — a second trace writer. AD-19 rule 2 says the orchestrator writes `AGENT_CALL` on the specialists' behalf, but AD-14's "every stage transition writes" phrasing actively invites the violation.

**Close it:** AD-4 should name the boundary in module terms ("`backend/orchestrator/**` and `agents/dispatch.py:run_specialists|synthesize_options` are the orchestrator; everything under `agents/berth|crane|yard|arbiter`, `policy/`, `mock_services/` receives values, never the `Incident`") and AD-14 should read "the orchestrator writes a trace entry for every stage transition" — not "every stage transition writes".

---

## Pair 9 — `predicted_impact` field names: spine shape vs governing companion

Spine shape doc + AD-18 line 161 pin `predicted_impact: {delay_min: int, cost: "low"|"medium"|"high", yard_impact: str, risk: "low"|"medium"|"high"}`. EXPERIENCE.md data-contract row pins `predictedImpact{delay, cost, yard, risk}` and the decision-card copy implies `cost` is a displayed magnitude ("$1.2M"), not a 3-value enum. `demo_seed.py` follows the spine (`PredictedImpact(delay_min=..., cost="medium", yard_impact=..., risk=...)`). Person C building the decision card's "predicted impact (delay / cost / yard / risk)" row from EXPERIENCE.md reads `.delay` / `.yard` and gets `undefined`; renders `cost` expecting a string like "$1.2M" and gets `"medium"`.

**Close it:** same fix as Pair 2 — one snake_case wire convention — plus an explicit "`cost` and `risk` are the literal enum `low|medium|high`, not free text; the card renders the enum" line so Person C doesn't build a currency formatter.

---

## Pair 10 — `mock_forced` double-penalty ambiguity (AD-16)

AD-16 honesty requirement: a mock-forced response "applies the same -15pt missing-data penalty it uses for a fallback/cached-state field — a canned response is treated as missing real data". `run.py:145-151` passes `fallback_fields=fallback_field_count` and `mock_forced=mock_forced` as **separate** inputs to `ConfidencePenalties.from_inputs`. A conformant Person building `policy/confidence.py` reads "the same penalty it uses for a fallback field" as "fold `mock_forced` into the `fallback_fields` count" (one -15). A second conformant Person adds `mock_forced` as its own weighted term in the FR6 config (another -15). When an agent is both mock-forced AND has a stale field, the two builds diverge by 15 points — and the confidence number is on the decision card and the tier threshold (FR7), so this can flip a tier.

**Close it:** the FR6 config module (named in the Consistency Conventions row) must state whether `mock_forced` is an increment to `fallback_fields` or an independent term, with the exact point value, in one place.

---

## Summary of holes to close (each = one tightened or new AD)

| # | Hole | Fix |
|---|------|-----|
| 1 | DG_CHECK `detail` has two shapes; `violation` key optional on the demo path → DG-forced-re-plan beat renders PASS | AD-18: `violation: bool` mandatory on both paths; delete "`{rejected_option, reason}` in the demo seed" wording |
| 2 | Approval action string `select_alternative` (spine) vs `modify` (governing UX companion); camel vs snake systemic | New Consistency Convention: snake_case wire format verbatim; `select_alternative` is the literal |
| 3 | Agent-chip run-state QUEUED/RUNNING (and `state`, `confidenceContribution`) not derivable from AD-19's completion-only data | Tighten AD-19 to emit per-agent `state` + a pre-`gather` "started" marker, or amend EXPERIENCE.md to a 3-state chip |
| 4 | CONFIDENCE structured-vs-prose has no pinned discriminator key | AD-18: pin `"reason" in detail` as the branch; make the two shapes mutually exclusive by rule |
| 5 | AD-4 "only orchestrator writes" vs AD-5 registry writes + traces; "route into the running orchestrator" has no defined mechanism → double-task or lost signal | AD-4 carve-out for the registry + new AD defining re-correlation-into-a-live-incident behavior |
| 6 | Stage-rail `pending/active/done` + DG loop-back not derivable from an append-only completion-only trace; "current" entry after re-plan undefined; AD-18 tier-reason has no input when `selected is None` | New AD pinning rail-state derivation rules; AD-18 tier-reason for the no-option case |
| 7 | Entity-ref format: two examples, no grammar; `yard:TUAS-C7` vs payload key `tuas_c7`; AD-5 `yard-block` vs shape `yard`; `gate`/`crane` unregistered | Consistency Convention: pinned prefix set + `type:TOKEN` grammar + case + one owner |
| 8 | "non-orchestrator function" (AD-4) undefined at the `agents/dispatch.py` boundary; AD-14 "every stage transition writes" invites a second trace writer | AD-4 names the boundary in module terms; AD-14 reads "the orchestrator writes…" |
| 9 | `predicted_impact` field names (`delay_min`/`yard_impact`) vs companion (`delay`/`yard`); `cost` enum vs displayed magnitude | Same snake_case convention + "`cost`/`risk` are the `low|medium|high` enum" line |
| 10 | `mock_forced` confidence penalty: fold-into-`fallback_fields` vs independent term → 15-pt divergence that can flip a tier | FR6 config module states the exact term and value in one place |

## What holds up

- AD-1/AD-9/AD-10 (single process, in-memory, no auth) — no incompatible pair constructible; they remove whole problem classes cleanly.
- AD-7 (kill switch: one flag, one enforcement point) — `run.py:183` and `approve_incident` check exactly at the pre-execution boundary and nowhere else; a second builder cannot conformantly add a check elsewhere.
- AD-13's `asyncio.gather` does **not** race AD-4 for the *within-incident* case: `dispatch.py` renders the brief once and specialists get an immutable string, so no mutable `Incident` reaches concurrent code. The race that survives is cross-coroutine (registry vs live orchestrator, Pair 5), not intra-analysis.
- AD-8's 2-attempt DG cap + forced-Tier-3 escape is unambiguous and correctly bounded in code.
- The frozen `SpecialistBundle` 3-tuple / `AgentName` literal / arbiter `len != 3` guard is genuinely locked and AD-18/AD-19 do not reopen it.

## Recommended disposition

Close holes 1, 2, 3, 5 before any further frontend build against the orchestra surfaces — they each break a demo-visible surface or re-open AD-4. Holes 4, 6, 7, 8, 9, 10 are one-line convention tightenings that should land in the same pass. None require re-architecting; all are under-specification in a spine that is otherwise coherent.
