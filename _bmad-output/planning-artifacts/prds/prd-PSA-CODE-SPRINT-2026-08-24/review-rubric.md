# PRD Quality Review — Portwatch (PSA Code Sprint 2026-08-24)

## Overall verdict
Portwatch is a well-shaped hackathon PRD: it has a real thesis (tiered autonomy calibrated to build trust, proven by "the system doesn't cry wolf"), honest scope cuts, and personas/UJs that each do load-bearing work rather than decorating the doc. The main risk sits in done-ness clarity — the safety-critical policy engine (FR7) and confidence formula (FR6), the two pieces everything else depends on, are described qualitatively but never pinned to numbers, so Day 1–2 implementers could each build a different tiering table. Decision-readiness is adequate rather than strong: the confirm-heavy coaching process left almost no real open questions or `[NOTE FOR PM]` callouts on record, even though several genuine unresolved tensions exist (tier boundaries, confidence weights).

## Decision-readiness — adequate
The PRD does surface some real trade-offs honestly: Section 7 names the approval-bottleneck-at-scale limitation as "named, not-built" with a stated future-work answer rather than hiding it, and Section 9's Out of Scope list is concrete and specific rather than vague. FR9 (DG hard gate forcing re-plan even after tier approval) is a stated decision with a real consequence, not a smoothed-over "balance."

But the doc's only Open Questions entry (§ Open Items) is about how content compresses into slides/video — a production-logistics question, not a genuine unresolved trade-off about the system itself. Given this PRD was built via a coaching-path walkthrough with rapid confirm exchanges, the near-total absence of `[NOTE FOR PM]` callouts is notable: there are real tensions in the doc (exact tier boundaries in FR7, confidence formula weights in FR6, the FR2 correlation window) that were resolved by omission rather than flagged as decisions still needing a call. Nothing here reads as actively dodged, but nothing reads as interrogated either — it reads as confirmed-and-moved-on.

### Findings
- **medium** Open Questions section doesn't capture real tensions (§ Open Items) — the single entry is about slide/video compression, not a substantive product/design trade-off. *Fix:* add open items for the genuinely undecided pieces called out under Done-ness below (tier boundary values, confidence weights).
- **low** No `[NOTE FOR PM]` callouts anywhere in the document despite several real unresolved tensions (tier thresholds, correlation window, confidence weighting). *Fix:* tag these inline so the team knows they're deliberate deferrals, not oversights, before Day 1 scaffolding locks in an implicit answer.

## Substance over theater — strong
No dimension here reads as furniture. The three personas (Priya, the terminal planner, Arif) each map to a distinct policy tier (Tier 3 approval, a query-only interaction, Tier 1 silent auto-execute) and each UJ does real work distinguishing those tiers for the reader — this is the opposite of persona theater; cutting any one of them would remove a demonstrated capability. NFRs are concrete rather than boilerplate: NFR1 gives an actual time bound (~20–30s), NFR2 is a testable 100%-trace claim, NFR3 specifies degrade-not-crash behavior tied directly to the deliberate timeout injection in the build plan (§10, owner B). The Vision statement is tied to specific mechanics (auto-execute/escalate/audit trace, "augments rather than replaces") rather than being swappable into any other product PRD. There is no Differentiation/Innovation section manufactured for its own sake — the doc doesn't claim novelty it can't back up.

## Strategic coherence — strong
The thesis is explicit and unusual for a rubric-driven hackathon doc: UJ-3's closing line — "this journey is the proof point that most incidents should be invisible... which is what gives UJ-1's escalation card its weight" — states the actual bet (trust is earned by tier discipline, not by doing more). Feature prioritization follows from it: correlation (FR1-2) and confidence computation (FR5-6) exist to feed the policy engine (FR7-10), which is the thesis's mechanism. Success Metrics are tied to the actual target (judging criteria + three demo beats landing live) rather than proxy activity metrics — appropriate for this artifact's real audience (judges), not a DAU-style tell. A counter-metric is present and sharp: "a broken demo scores zero regardless of scope," directly justifying the Day-3 hard freeze in the build plan. MVP scope kind (capability/demo-proof spec) matches the build-plan logic throughout.

## Done-ness clarity — thin
Several FRs are concrete and testable as written: FR16 (≥2 concurrent incidents, no blocking), FR13 (each action verified individually, failures recorded not silently passed), NFR1–3. But the two FRs the rest of the system depends on are under-specified:

FR7 says the policy engine "classifies it Tier 1/2/3" against "tiered rules (reversibility, SLA risk, safety risk, confidence threshold, DG involvement)" but never states the actual boundary values — what confidence/reversibility/SLA combination is Tier 1 vs Tier 2 vs Tier 3. The only concrete numbers appear buried in UJ-3's narrative ("confidence ≥0.80" for Tier 1 auto-execute) rather than in the FR itself, and Tier 2's boundary is never stated anywhere. An engineer reading FR7 alone could not build the classifier.

FR6 asserts the confidence score is "computed, deterministic" from "staleness + missing-data + disagreement + variance penalties" but gives no formula or relative weights — two people on the same team could implement materially different scoring functions and both would satisfy the FR as written.

FR2's correlation window ("signals arriving within a time/entity window") has no numeric bound, in contrast to NFR1's explicit ~20-30s — an odd asymmetry given correlation timing is arguably more decision-critical than the golden-path latency figure.

FR1's "common incident representation" names no required fields/schema, though this is more defensible at this altitude since it's an internal data contract the team will settle during Day 1-2 scaffolding.

### Findings
- **critical** FR7 tier boundaries are undefined (§ Functional Requirements, D) — the policy engine is the safety-critical core of the whole system, and the FR only names the input dimensions, not the thresholds that separate Tier 1/2/3. The one concrete number (confidence ≥0.80) lives in a UJ narrative, not the FR. *Fix:* add an explicit tier boundary table (even provisional) to FR7 before Day 1-2 scaffolding, so owner A isn't inventing it unreviewed mid-build.
- **high** FR6 confidence formula has no weights or combination rule (§ Functional Requirements, C) — "deterministic" is claimed but not specified. *Fix:* pin at least placeholder weights per penalty component; refine during Day 1-2 if needed, but put a number in the PRD.
- **medium** FR2's correlation time/entity window has no numeric bound (§ Functional Requirements, A), unlike NFR1's explicit figure. *Fix:* state a target window (e.g., "within N minutes, same vessel/berth entity").
- **medium** FR1's "common incident representation" has no field list (§ Functional Requirements, A) — lower urgency since it's an internal contract, but worth at least bullet-listing required fields (entity refs, timestamps, source signal type, confidence) so owners A/B/C build against the same shape from Day 1.

## Scope honesty — strong
This dimension is the PRD's strongest. Section 9 (Out of Scope) is specific and non-generic: real PSA API integrations, certified DG/legal compliance, built handling of approval-bottleneck-at-scale, AGV/Gate agent (explicitly named as Day-5-only stretch that "cuts first under time pressure"), production auth/persistence/mobile. Section 6's `[ASSUMPTION]` tag on the DG/IMDG ruleset is used correctly and self-aware — it explicitly instructs the team to state the simplification in the architecture deliverable "so it reads as intentional scoping rather than an overlooked gap," which is exactly the honest-de-scoping behavior this dimension rewards. Section 7 names the approval-bottleneck-at-scale limitation as "not-built" with a stated future-work answer rather than pretending it doesn't exist. Open-items density (1 Open Question, 1 Assumption, 0 NOTE FOR PM) is appropriately low for a hackathon-stakes doc, though see Decision-readiness above for where a couple more would help.

## Downstream usability — adequate (matters less; largely standalone)
This PRD primarily feeds a 4-person build team directly (§10 Build Plan) rather than a further UX → architecture → story pipeline, so this dimension carries less weight per the rubric's own guidance. FR IDs (FR1–FR16) are contiguous and unique; UJ IDs (UJ-1–UJ-3) are contiguous with named protagonists throughout — no floating UJs. Cross-references resolve correctly (FR9's DG override references FR7's tier system consistently; FR10's kill switch is referenced again in §5 Security).

There is no formal Glossary, and terms like "Tier 1/2/3," "golden path," and "DG/IMDG" are used consistently but never defined in one place — low-friction for a 4-person team that was in the room for the PRD session, but would slow down anyone joining later or extracting a section standalone.

### Findings
- **low** No Glossary section (document-wide) — terms are used consistently but undefined. *Fix:* a 5-line glossary (Tier 1/2/3, golden path, confidence, DG/IMDG) would cost little and help any teammate who wasn't in the drafting session.

## Shape fit — strong
This is correctly shaped as an internal-tool/capability-spec PRD with just enough UJ formalism to earn its keep: three UJs (not four-plus), each tied to a distinct persona and each demonstrating a different autonomy tier — this is load-bearing UJ density for a multi-stakeholder-ish B2B tool (ops manager, planner, yard supervisor), not over-formalization. Constraint traceability for the DG/IMDG safety gate is handled correctly for a system with real safety implications, even under hackathon stakes — FR9 states it as a hard, tier-independent gate and §5/§6 reinforce it consistently. The build plan (§10) matches the capability-spec shape: day-by-day owner assignments map directly to FR groups (A→FR3-10, B→FR13, C→FR14-15/dashboard, D→FR9/integration), with scope logic (freeze after golden path, stretch is strictly additive) that follows from the demo-proof MVP kind rather than generic "what's easy first" sequencing.

## Mechanical notes
- The single `[ASSUMPTION]` tag (§6, DG/IMDG ruleset) is not collected into a formal Assumptions Index, but there's only the one, so roundtrip risk is negligible at this stakes level.
- FR IDs (FR1–FR16) and UJ IDs (UJ-1–UJ-3) are contiguous, unique, with no gaps or duplicates found.
- Success Metrics (§8) are unlabeled bullets rather than ID'd (no SM-1, SM-2, ...) — acceptable given no downstream traceability workflow consumes them by ID.
- No Glossary section exists; domain terms (Tier 1/2/3, golden path, DG/IMDG) are used consistently in every location checked, so there is no drift, just no single definition point.
- Cross-references checked (FR9→FR7, FR10↔§5 kill switch, UJ-3→§4 policy engine criteria) all resolve to real content elsewhere in the doc.
