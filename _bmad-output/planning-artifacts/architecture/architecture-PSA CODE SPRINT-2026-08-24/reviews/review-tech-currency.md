# Review: Tech-Currency Audit — Portwatch Architecture Spine

**Reviewer lens:** verify every committed technology/pattern decision in ARCHITECTURE-SPINE.md was web-researched or reality-checked, not asserted from training data.
**Date of review:** 2026-08-24
**Target:** `_bmad-output/planning-artifacts/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md`

## Verdict: PASS WITH CONCERNS

The spine's central, highest-risk claim (AD-2's framing of "raw Messages API, not Agent SDK") holds up under scrutiny against current Anthropic documentation and is in fact well-reasoned for this exact system shape. The named stack versions that are checkable (FastAPI) are correct and already self-annotated as verified. But several items are asserted without a stated verification method, one version choice (Python floor) is looser than it should be given what's actually current, and the spine is silent on model selection, which matters for a build that calls the Messages API directly.

---

## 1. Stack table — version-by-version check

| Item | Spine claim | Web-check result | Verdict |
|---|---|---|---|
| Python | `3.12+` | Python 3.14.7 is current stable (Aug 5, 2026); 3.13 is in maintenance; 3.12 is two majors behind. As a **floor** ("3.12+"), this is not wrong — 3.14 satisfies it — but it's a looser floor than a currency-checked spine should set. Nothing in the spine explains why 3.12 was chosen as the minimum rather than 3.13/3.14 (e.g. a specific library constraint). | **Under-verified.** Not false, but the "+" floor reads as carried over from training-data habit ("3.12 is a safe modern default") rather than checked against what's actually current in mid-2026. Recommend bumping the floor to 3.13+ or stating the reason 3.12 was kept. |
| FastAPI | `~0.141.x (verified current, July 2026)` | Confirmed: FastAPI 0.141.1 was released July 29, 2026. This is the one line in the table that already states its own verification and is accurate. | **Pass — correctly verified**, and it's the only row that shows its work. This is good practice; the other rows should match this standard. |
| Anthropic Python SDK | `latest stable` | Not a pinned claim, so nothing to falsify — but also nothing verified. No model ID, no SDK version, no confirmation the direct-Messages-API pattern was checked against current Anthropic guidance (see §2 below, where it turns out this framing is actually well-supported). | **Unverified but defensible in outcome** (see §2). The spine should still say what "latest stable" was checked against, and should probably commit to a model ID (see §3). |
| React / TypeScript / Vite | `current stable` (x3) | React 19.2.8 (July 21, 2026) is current; no React 20 announced. Vite 8.1.3 (July 2, 2026, Rolldown-based bundler) is current. TypeScript's usual cadence continues. All three exist, are appropriate for this use case (SPA dashboard, polling), and nothing here is implausible for mid-2026. | **Not wrong, but not a real "check" either** — "current stable" is a placeholder that can't be falsified and wasn't compared against an actual version number the way the FastAPI row was. Low risk (these are safe, boring choices) but inconsistent rigor. |

**Finding:** only 1 of 6 stack rows shows evidence of being checked against a real, dated source. The other 5 are either loose floors or unpinned "current" placeholders. For a hackathon this is low-stakes (nothing here is actually stale or wrong), but it means the spine's own claim of currency isn't uniformly backed — FastAPI's row sets a standard the rest of the table doesn't meet.

---

## 2. AD-2: "raw Messages API, not Claude Agent SDK" — is this the right pattern?

This is the decision most likely to be wrong if asserted from stale training data, since the Anthropic agent-building surface has changed substantially in 2025-2026 (Tool Runner, Managed Agents, multiagent sessions all postdate a lot of training data). Checked against current Anthropic documentation:

**The three/four-way split that actually exists today:**
1. **Claude API — manual loop**: hand-write the `while stop_reason == "tool_use"` loop. Full control, no beta dependency.
2. **Claude API — Tool Runner** (`client.beta.messages.tool_runner`): SDK automates the loop over *tools you define*. No built-in tools, no filesystem/bash access — you still host and define every tool.
3. **Managed Agents**: Anthropic hosts both the agent loop *and* a per-session sandboxed container (bash, files, code exec). This is the option with genuine autonomous reach.
4. **Claude Agent SDK**: Claude Code packaged as a library — ships built-in Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch tools, the full coding-agent harness, subagents, permissions. Meant for "a batteries-included coding/filesystem agent running on your own infra."

AD-2's stated concern is "an agent gaining tool/capability reach beyond its scoped role by inheriting a framework's broader autonomous-agent surface" — and specifically rules out the Agent SDK. **This is accurate**: the Agent SDK's entire value proposition is bundling broad built-in tools (file/bash/web access) and a persistent coding-agent harness, which is exactly the surface AD-3's per-agent tool-scoping is designed to prevent. Reaching for the Agent SDK here would have been a real mismatch — good catch, correctly reasoned.

**Is there a better-fit Anthropic-recommended pattern the spine missed?** Two candidates worth naming:

- **Tool Runner** (option 2): for a "custom agent with your own tools," Anthropic's own guidance calls this the fit for "most cases" where you want the request/execute/loop cycle handled without hand-writing it. However, the spine's actual design — each specialist-agent call is "a bounded, single-purpose request/response... no persistent agent session" — describes something closer to a *single* Messages API call with a scoped tool manifest per agent, not an iterative tool-use loop. If each agent call really is one-shot (call once, arbiter synthesizes across the returned tool_use outputs), the **manual single-call approach the spine picked is actually the more precise fit**, not an oversight — Tool Runner would be introducing loop machinery for a pattern that isn't looping. This should be made explicit in the spine's wording, since "not via the Claude Agent SDK" only rules out one alternative and leaves the Tool Runner question implicit.
- **Managed Agents multiagent sessions**: Anthropic explicitly recommends a multiagent session pattern for "work that fans out... then summarize" — which is a close structural match to Portwatch's fan-out-to-specialists/fan-in-to-arbiter shape. The spine doesn't mention this option at all. Its rejection is nonetheless correctly implied by AD-1 (avoid infra complexity — Managed Agents means Anthropic-hosted sandboxes, session/container lifecycle, a bigger platform surface) and AD-9/AD-10 (no persistence, no auth — Managed Agents assumes stateful, versioned, persisted agent configs). For a 6-day hackathon with no infra budget, staying off Managed Agents is the right call, but the spine states this as "not via the Claude Agent SDK" (ruling out only one alternative) rather than acknowledging the fuller decision space and why each option was rejected.

**Conclusion on AD-2:** the decision itself is correct and, notably, better-supported by current Anthropic guidance than a training-data-only pass would likely have produced (a training-data-era answer would be more likely to reach for the Agent SDK by name-recognition, or to not know Managed Agents/Tool Runner exist as distinct options at all). But the spine's rationale only argues against one of three real alternatives; it should be read as "correct conclusion, incomplete argument" rather than fully reasoned-through.

---

## 3. Gap: no model ID is committed anywhere in the spine

The Stack table pins "Anthropic Python SDK (Messages API, direct)... latest stable" but never names which Claude model the specialist agents and arbiter call. For AD-2/AD-3 (tool-scoped, bounded, per-role API calls) this is a load-bearing detail — tool-use reliability, context window, and cost all vary by model tier. Given this is a 6-day build with four parallel lanes, leaving the model unstated invites each implementer to independently guess a model string, which is exactly the kind of drift a spine is supposed to prevent (cf. AD-3's "adding capability means editing the manifest, never the prompt" — the same discipline should apply to which model backs the manifest). Recommend adding a row or an AD naming the model explicitly.

---

## 4. Other named tech/pattern claims — asserted without stated verification

- **"Anthropic Python SDK... latest stable"** — no version number, no date, no note on how this was checked (contrast with the FastAPI row, which states both a version and a verification date). Low risk given SDKs are typically backward-compatible, but inconsistent with the rigor shown elsewhere in the same table.
- **In-memory persistence (AD-9), no auth (AD-10)** — these are correctly sourced to the PRD ("Source: PRD Out-of-Scope"), not asserted as external-tech claims, so they're out of scope for a tech-currency check — flagged here only to note they're *not* part of this concern (good practice: the spine already distinguishes PRD-sourced decisions from tech-currency claims by citing sources for AD-9/AD-10/AD-12, but doesn't extend the same citation habit to the Stack table).
- **Mermaid pipeline / container diagrams, source tree, capability map** — structural, not technology-currency claims; not in scope for this review.

---

## Summary of findings

1. **FastAPI row is correctly verified** (0.141.1, July 2026) — the standard the rest of the table should have met.
2. **Python floor ("3.12+") is looser than current reality** (3.14 is now stable, 3.13 in maintenance) — not wrong as a floor, but reads as an unchecked default rather than a currency-checked choice.
3. **React/TypeScript/Vite rows are unpinned placeholders** ("current stable") — not falsifiable, so not wrong, but not evidence of a check either; real current versions (React 19.2.8, Vite 8.1.3) are fine choices.
4. **AD-2's "not the Agent SDK" framing is correct and well-supported by current Anthropic documentation** — the Agent SDK really would have over-granted tool/file/bash surface, contradicting AD-3. This is the review's most reassuring finding: the highest-risk architectural bet checks out.
5. **AD-2's rationale is incomplete, not wrong** — it argues against only one of three live Anthropic-recommended alternatives (Agent SDK, Tool Runner, Managed Agents multiagent sessions). The conclusion (avoid all three, use direct single-call Messages API) is still defensible via AD-1/AD-9/AD-10, but the spine doesn't say so explicitly.
6. **No model ID is committed anywhere** — a gap, not a wrong claim, but one that matters for a spine meant to keep four build lanes consistent.

## Recommendation

No committed decision needs to be reversed. Two small spine edits would close the gap between "asserted" and "verified":
- Add a sentence to AD-2 naming Tool Runner and Managed Agents multiagent sessions as the two alternatives considered and rejected (infra/statefulness cost, per AD-1/AD-9/AD-10), not just the Agent SDK.
- Add the specific Claude model ID to the Stack table (or a new AD), rather than leaving it to be decided per-agent during implementation.
