# Sprint Change Proposal — 2026-08-29

**Trigger:** `bmad-build-auto` HALT on Stories 3.3 and 3.5 (frozen-contract block)
**Prepared by:** Amelia (dev) via Correct Course
**Mode:** Incremental
**Scope classification:** Moderate (backlog reorganization — two stories cut, one epic closed)
**Status:** Approved 2026-08-29

---

## Section 1 — Issue Summary

**Problem statement.** Epic 3 Stories **3.3 (AGV/Gate Specialist Agent, FR20)** and **3.5 (Weather Circuit-Breaker Agent, FR18)** cannot be implemented as written without editing the Day-3-frozen golden-path specialist contract. `bmad-build-auto` correctly HALTed both at planning rather than proceeding unattended.

**Discovery.** During automated build of the Epic 3 Day-5 stretch block. Stories 3.1, 3.2, 3.4 completed normally; 3.3 and 3.5 both stopped at the same wall and were recorded `blocked` in `sprint-status.yaml` pending a human decision.

**Evidence — the frozen 3-specialist roster.**

| Frozen artifact | Lock | Origin |
|---|---|---|
| `backend/agents/base.py:97-99` | `SpecialistBundle.recommendations` — `min_length=3, max_length=3` | Story 1.3 |
| `backend/agents/base.py:60` | `AgentName = Literal["berth","crane","yard"]` | Story 1.3 |
| `backend/agents/arbiter.py:217` | hard guard — raises `SpecialistError` if `len(bundle.recommendations) != 3` | Story 1.4 |
| `backend/agents/dispatch.py:37` | `_AGENT_ORDER` — fixed 3-tuple, also the failure tie-break order | Story 1.3 |
| `backend/agents/mock_override.py` | `CANNED_SPECIALIST` — only `berth`/`crane`/`yard` keys | Story 1.13 |
| `backend/tests/agents/test_specialists.py:497` | `test_bundle_requires_exactly_three_recommendations` | frozen test |
| `backend/tests/agents/test_specialists.py:170,231,469` | `len(fake.calls) == 3`, `max_in_flight == 3`, berth→crane→yard order assertions | frozen test |

Every reading of FR20/FR18 — including the most conservative *conditional* 4th specialist that runs only for `gate_metric` / `weather_event` incidents — must change these model constraints, the arbiter guard, and the frozen test expectations.

**Why that is not permitted under the current plan.** `epic-3-context.md` and PRD §10 both state the 3.2–3.5 stretch block is *"strictly additive after the Day-3 golden-path freeze … None introduce new endpoints, tiers, or policy rules."* The PRD counter-metric is explicit: *"a broken demo scores zero regardless of scope"* — the reason the golden path hard-freezes after Day 3. `run_specialists` and the arbiter are on every incident's critical path (all three demo beats: golden path, DG re-plan, concurrency).

---

## Section 2 — Impact Analysis

### Epic impact

- **Epic 3 goal is already satisfied by completed work.** The epic's purpose is to show *"the architecture generalizes rather than being hardcoded for one incident shape"* (Scalability & Responsible AI judging criterion). Delivered evidence:
  - **3.1 (done)** — concurrent incident proof; the core, non-stretch deliverable.
  - **3.2 (done)** — Pasir Panjang load balancing; *same agents + arbiter + policy engine extended to a second terminal cluster, unchanged.*
  - **3.4 (done)** — mocked MPA clearance check; *new mock added on the existing `execute(action) -> {ok, result, error}` contract, no interface drift.*
- **3.3 and 3.5 are the lowest-value items behind the freeze.** PRD §10 Day-5 ranking (6 items): FR20 is **#3**, FR18 is **#6 (last)**. Both are explicitly *"cut from the bottom if time runs short."*
- No other epic depends on 3.3 or 3.5. Epic 4 (done) is sequenced before this block and does not touch it.

### Artifact conflicts

| Artifact | Conflict? | Action |
|---|---|---|
| PRD (`prd-PSA-CODE-SPRINT-2026-08-24/prd.md`) | No goal/MVP conflict — both FRs are already flagged Day-5-only, additive, first-to-cut (§10, and FR20 note at line 141). | No PRD edit required. FR18/FR20 status tracked in `epics.md` + this proposal. |
| `epics.md` | FR-map lines and Epic 3 summary still present 3.3/3.5 as build targets. | **Edited** — descope banners on both story headings; FR-map lines 113/115 annotated; Epic 3 summary + FRs-covered line updated. |
| `epic-3-context.md` (planning + impl copies) | Lists 3.3/3.5 as stories; "strictly additive" constraint is the basis for the cut, not in conflict with it. | No edit — the constraint text is what the decision rests on. |
| Architecture spine | No conflict — the frozen 3-specialist contract is being *kept*, not changed. | No edit. |
| UX designs | No conflict — no new screens; any new option surfaces through existing Epic 2 feed/detail. | No edit. |
| `sprint-status.yaml` | 3.3/3.5 marked `blocked` (unresolvable); Epic 3 `in-progress`. | **Edited** — 3.3/3.5 removed from live tracking with a decision comment; `epic-3: done`. |
| `spec-3-3-*.md`, `spec-3-5-*.md` | `status: blocked`. | **Edited** — `status: descoped`; Descope Decision section appended. |
| `deferred-work.md` | Conditional-4th-specialist design would be lost. | **Edited** — both designs preserved verbatim with a 6-step post-sprint implementation sketch. |

### Technical impact

- **Zero code change.** `backend/` remains byte-unchanged at `2a269d4` (3.3 baseline) / `7b309b7` (3.5 baseline). The golden path stays frozen.
- No test changes. No deployment / CI impact.

---

## Section 3 — Recommended Approach

**Selected path: Direct Adjustment — cut Stories 3.3 and 3.5, close Epic 3.** (Checklist Option 1, "defer story no longer viable within plan.")

**Alternatives considered and rejected:**

| Option | Effort | Risk | Why not |
|---|---|---|---|
| **A — Unfreeze the `SpecialistBundle`/arbiter contract now** | Medium–High | **High** | Edits the golden-path critical path + arbiter synthesis logic + re-freezes tests, for the #3 and last-ranked stretch items, with the demo imminent. Directly against the PRD counter-metric. |
| **B — Redo the specialist-roster architecture slice, re-ratify** | High | High | No time before demo; only justified if 3.3/3.5 were core deliverables, which they are not. |
| **C — Cut 3.3 and 3.5, close Epic 3** *(selected)* | Low | Low | Epic 3's generalization goal is already evidenced by delivered 3.1/3.2/3.4. Golden path stays frozen. Design preserved for post-sprint. |

**Rationale.** The freeze is a deliberate PRD-level risk control. These two stories are the least valuable items sitting behind it, and the judging point they would reinforce is already made live by three completed stories. The clean conditional-4th-specialist design is captured in `deferred-work.md` and can be built without demo pressure if the project continues.

**Timeline impact:** none — removes remaining Epic 3 work. **Effort:** ~0 (documentation only, applied).

---

## Section 4 — Detailed Change Proposals

All five applied 2026-08-29 in incremental review:

1. **`_bmad-output/implementation-artifacts/sprint-status.yaml`** — `epic-3: in-progress` → `done`; `3-3` / `3-5` removed from `development_status` and recorded in a descope comment pointing to this proposal; `last_updated` bumped.
2. **`_bmad-output/planning-artifacts/epics.md`** — DESCOPED banner block added under the Story 3.3 and Story 3.5 headings (ACs retained for the record).
3. **`_bmad-output/planning-artifacts/epics.md`** — FR-map lines for FR20/FR18 annotated DESCOPED; Epic 3 summary paragraph gains a dated update sentence; `**FRs covered:**` line splits delivered vs descoped.
4. **`spec-3-3-agv-gate-specialist-agent.md` / `spec-3-5-weather-circuit-breaker-agent.md`** — frontmatter `status: blocked` → `descoped`; `## Descope Decision — 2026-08-29` section appended to each.
5. **`_bmad-output/implementation-artifacts/deferred-work.md`** — two entries appended preserving the conditional-4th-specialist design and a 6-step post-sprint implementation sketch for each.

---

## Section 5 — Implementation Handoff

**Scope:** Moderate — backlog reorganization, no code.

| Recipient | Responsibility |
|---|---|
| **Dev (Amelia)** | All five artifact edits — **complete**. |
| **Product Owner / PM** | Acknowledge FR18 + FR20 as descoped-to-backlog for this sprint; carry into any post-sprint planning from the `deferred-work.md` entries. |
| **Whoever runs the Epic 3 retrospective** (optional) | Note the frozen-contract vs stretch-scope tension as a process learning: a stretch item that names "reuse the pattern exactly" can still collide with a frozen contract — worth a pre-flight contract check when minting future additive stories. |

**Success criteria:**
- `sprint-status.yaml` shows `epic-3: done` with no `blocked` entries. ✅
- `epics.md` unambiguously marks FR18/FR20 descoped with a pointer to this proposal. ✅
- The conditional-4th-specialist design is recoverable without re-derivation. ✅
- `backend/` untouched; golden path still frozen. ✅

**Next action:** Epic 3 is closed. Remaining open items outside this proposal (unchanged): epic-1 retro action items 3 & 4 (reconcile `epics.md` Story 1.10/1.12 with as-built; commit Epic 1.5–1.13 backend work); optional epic-3 / epic-4 retrospectives.
