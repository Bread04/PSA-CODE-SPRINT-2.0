---
title: 'competitive research: PSA Code Sprint past finalists'
type: 'competitive'
topic: 'PSA Code Sprint past finalists'
decision: "Sharpen Portwatch's execution/pitch/demo craft using past finalist patterns without copying concepts"
source: 'run'
status: complete
preset: 'standard'
validation: 'normal'
created: '2026-08-26'
updated: '2026-08-26'
---

# competitive research: PSA Code Sprint past finalists

**Decision this research serves:** Sharpen Portwatch's execution/pitch/demo craft using past finalist patterns without copying concepts

## Executive Summary

Public data on past PSA Code Sprint finalists is **thin** — no pitch decks, no judge quotes, and only one edition (2023) has real technical detail (from two participant-published GitHub READMEs, not official sources). The one thing verified directly and with high confidence is the **official judging rubric**: four equally-billed categories — Innovation & Creativity, UI/UX, Technology, Presentation — with no disclosed weighting [5][6]. That single fact is more actionable than anything found about specific past teams: it means polish and presentation clarity are not tiebreakers, they're a quarter of the score.

The best-evidenced data point, 2023 champion **opPORTunity**, is instructive on *craft* rather than concept: it isolated its riskiest, most failure-prone component (an LLM chatbot) into its own simple Streamlit shell rather than deeply integrating it everywhere [1] — a scoping instinct Portwatch's own PRD already shares (Day-3 golden-path freeze, Day-6 recorded backup run). Across the three editions with any confirmed winner (2022–2024), champions solved a **named, visible, real PSA/logistics operational pain point** with a clear before/after story, not an abstract technology showcase [1][2][3][4][7][8] — Portwatch's Priya/MSC Anna narrative already fits this shape and should be leaned into.

**Biggest caveat:** no judge quotes, scored rubrics, or post-mortems were found for any edition [none] — so "what past winners built" is scoping/craft inspiration only, not evidence of what judges specifically valued. Treat the verified rubric, not the past-winner pattern-matching, as the primary design target.

## Build & Demo Scope

Only 2023 yielded real technical detail. 2023 champion Team ByTheSea's **opPORTunity** was an HR-transformation portal with three named AI modules (PortBOT, LightHouse, PortConnections), built on Vue.js, FastAPI, MySQL, and a LangChain + ChromaDB + OpenAI AI layer, orchestrated via Docker Compose [1]. Its README requires a live OpenAI API key — the AI integration was genuinely wired up, not stubbed — but a separate, simpler Streamlit app handled the chatbot-facing demo, suggesting the team deliberately isolated its highest-risk component rather than fully integrating it into the primary web app (medium confidence — inferred from architecture, not stated) [1]. A second 2023 finalist, HR-Gen2, independently built a similar AI-HR concept on React/Firebase/GPT-4 [2], suggesting that year's problem statement pointed multiple teams toward HR/workforce tooling.

The official results archive reliably names champions and runners-up for 2022–2025 by team and institution, but publishes **no project descriptions** for any year except what participants separately chose to put on GitHub [3][4]. No Devpost page, no PSA technical writeup, and no participant retrospective blog was found. This is a genuine "thin public data" result, not a search failure — flagged as such rather than padded.

## Pitch & Presentation Craft

The official site states four judging categories, verified directly: **Innovation & Creativity** (uniqueness of idea/concept), **UI/UX** (UI appeal, ease of interaction), **Technology** (functionality, technical difficulty), **Presentation** (clarity/flow/organisation, communication style) [5]. The FAQ confirms no numeric weighting is disclosed [6] — I fetched both pages directly and confirmed this myself rather than relying on a paraphrase.

opPORTunity's naming pattern is worth noting as craft: each of its three modules got a memorable name tied to one HR pain point and mapped to a business theme (Talent/Experience/Engagement) [1] — a structural pattern (name + concrete pain point + capability), not just a feature list. No actual pitch deck, time limit, or judge Q&A format was found for any edition; the event runs briefings → problem statements → build period → a live in-person "FINALS" presentation, confirmed only at the format level [1][9]. Generic enterprise-hackathon judging guidance (technical execution, innovation, business impact, UX, presentation) recurs across marketing blogs but is explicitly **not PSA-specific evidence** [13][14][15] — included only as a low-confidence fallback pattern, clearly separated from the verified PSA rubric above.

## Judge/Audience Reception & Trajectory

Confirmed champions: 2022 "Long Ken Kai My" (NUS) — team/institution confirmed via the official archive [3], project described as **PSAccess**, a PON-digitization portal cutting paper waste, at medium confidence since that description rests only on a participant page and a PSA social post [7][8]; 2023 "ByTheSea" for opPORTunity, high confidence [1]; 2024 "TELETUBBIES" (NYP), project details unpublished [4]. 2025's winner could not be confirmed (Facebook login wall blocked retrieval) [10][11]; 2021 is unconfirmed. No judge quotes, scored criteria, or post-mortem commentary were found for any edition — a clean absence across both official and participant sources searched, reportable as a finding in itself.

An inferred (not judge-stated) pattern across the two champions with well-evidenced project descriptions (opPORTunity, high confidence; PSAccess, medium confidence): both solved a **visible, real, PSA-operational problem** (paper-based PON tracking, HR matching) rather than a generic tech demo [1][7][8] — flagged as an inference from project descriptions, not a sourced judging-criteria claim. Trajectory data is thin: one 2023 team member's LinkedIn title suggests a possible post-hackathon hire at PSA, unconfirmed (profile blocked) [12]; no evidence of any winning project being piloted or adopted in production, and none found continuing as an independent startup.

## Cross-Dimension Insights

The three dimensions combine into one insight none alone would give: the **verified rubric treats Presentation and UI/UX as equal to Technology** [5][6], and both well-evidenced champions' *actual* winning trait, as best as public evidence shows, was a clearly-told, visibly-real operational story rather than technical ambition [1][7][8] — while the one team with visible engineering discipline (opPORTunity's demo-isolation pattern) also happened to win [1]. Read together, this argues judges reward **legible, reliable, real-world-framed execution** over raw technical scope — not a finding any single dimension surfaces alone.

## Recommendations

1. **Invest real prep time in the demo narrative and deck clarity, not just backend depth** — Presentation is a quarter of the verified rubric, not a tiebreaker [5]. *Feeds: presentation deck (PRD Open Items already flags `bmad-cis-agent-presentation-master` as the next step for this).* Confidence: high (direct rubric verification).
2. **Extend the golden-path-freeze instinct to the demo's most fragile component specifically** — opPORTunity isolated its riskiest LLM component into its own simple shell [1]; Portwatch's PRD already plans a Day-6 recorded backup run for the whole demo, but consider a per-agent-call fallback/mock toggle so a single live-LLM hiccup during judging doesn't cascade through the pipeline. *Feeds: build-plan risk mitigation (PRD §10).* Confidence: medium (single-source pattern, architecturally inferred not stated).
3. **Open the pitch on the named, concrete operational story (Priya/MSC Anna), not the architecture** — matches the framing pattern of the two well-evidenced past champions (PSAccess's PON waste, medium confidence; opPORTunity's named HR modules, high confidence) [1][7][8]. *Feeds: presentation narrative structure.* Confidence: medium (pattern across 3 data points, judge motivation itself unverified).
4. **Do not treat "what past finalists built" as a proxy for "what judges want"** — no judge feedback was found for any edition [none]; the rubric (finding above) is the only directly-verified signal. Use past-finalist material for scoping/craft calibration only, which also protects Portwatch's Innovation & Originality standing since no evidence surfaced of a prior finalist attempting anything resembling multi-agent disruption orchestration. Confidence: high (rubric), low (comparison to unconfirmed 2021/2025 editions).

## Open Questions

- What did the 2021 and 2025 editions produce? Both unconfirmed — 2025's Facebook announcement was blocked by a login wall; 2021 wasn't indexed in this run. Would need a direct fetch with authenticated/alternate access, or a search specifically dated to those windows.
- Is there a numeric weighting behind the four rubric categories, even if undisclosed publicly? Would require asking the organizers directly (contact surfaced: PSAC-PSACODESPRINT@globalpsa.com) — not pursued, research-only scope.
- Were any past winning projects piloted or adopted inside PSA? Thin public data; likely only answerable by asking PSA directly or finding an internal source.

## Source Appendix

| # | Finding it supports | Publisher | Pub. date | Accessed | Confidence |
|---|---|---|---|---|---|
| [1] | opPORTunity build/tech-stack/naming pattern | [github.com/xavierkoo/psa-codesprint-2023](https://github.com/xavierkoo/psa-codesprint-2023) | undated (2023) | 2026-08-26 | high |
| [2] | HR-Gen2 build/tech-stack | [github.com/SlothKai/psa-codesprint](https://github.com/SlothKai/psa-codesprint) | undated (2023) | 2026-08-26 | high |
| [3] | Official winners list, no project descriptions | [psacodesprint.com/past-events](https://www.psacodesprint.com/past-events) | undated | 2026-08-26 | high |
| [4] | 2024 champion/runners-up | [psacodesprint.com/code-sprint-2024](https://www.psacodesprint.com/code-sprint-2024) | undated | 2026-08-26 | high |
| [5] | Official judging rubric (4 categories) | [psacodesprint.com/home](https://www.psacodesprint.com/home) | undated | 2026-08-26 (directly verified) | high |
| [6] | No numeric weighting disclosed | [psacodesprint.com/faq](https://www.psacodesprint.com/faq) | undated | 2026-08-26 (directly verified) | high |
| [7] | 2022 champion PSAccess | [reignnz.github.io/psa-codesprint-2022](https://reignnz.github.io/psa-codesprint-2022/) | undated (2022) | 2026-08-26 | medium |
| [8] | 2022 champion corroboration | PSA Singapore LinkedIn post | undated (2022) | 2026-08-26 | medium |
| [9] | Event format (finals presentation) | PSA Singapore Facebook (2023 finals video, metadata only) | 2023 | 2026-08-26 | low |
| [10] | 2025 finals date | PSA Singapore Facebook (2025 finals post, login-walled) | 2025-10-24 | 2026-08-26 | low |
| [11] | 2025 finals (unconfirmed winner) | [instagram.com/p/DQYJWHhjUJa](https://www.instagram.com/p/DQYJWHhjUJa/) | 2025 | 2026-08-26 | low |
| [12] | Possible post-hackathon hire | LinkedIn (Aaron Kwah, snippet only, profile blocked) | undated | 2026-08-26 | low |
| [13] | General enterprise-hackathon pattern (non-PSA) | [taikai.network/en/blog/hackathon-judging](https://taikai.network/en/blog/hackathon-judging) | undated | 2026-08-26 | low |
| [14] | General enterprise-hackathon pattern (non-PSA) | eventflare.io | undated | 2026-08-26 | low |
| [15] | General enterprise-hackathon pattern (non-PSA) | theinnovationmode.com | undated | 2026-08-26 | low |

## Staleness Map

| Claim | Class | Pub. date | Re-check by |
|---|---|---|---|
| opPORTunity build/tech-stack detail | build-scope | 2023-08 | 2024-08-01 (past due — re-check if reused) |
| HR-Gen2 build/tech-stack detail | build-scope | 2023-08 | 2024-08-01 (past due) |
| opPORTunity's narrative framing | pitch-structure | 2023-08 | 2024-08-01 (past due) |
| Confirmed champions 2022–2024 | winner | 2024-08 | 2025-08-01 (past due — 2025 winner should be re-checked) |
| Official rubric, no weighting | judging-criteria | 2026-08 (live page, verified today) | 2027-02-01 |
| Official past-events page structure | build-scope | 2026-08 | 2027-08-01 |
| Absence of judge feedback | judge-feedback | 2026-08 | 2027-08-01 |

**Earliest re-check: 2024-08-01** (the 2023-sourced build/pitch claims). In practice these are historical facts about a past edition that won't change — the re-check date matters only if this research is reused to infer *next* edition's likely problem statement or rubric, not for the claims themselves. The one claim worth an actual follow-up now is **2025's winner**, still unconfirmed.
