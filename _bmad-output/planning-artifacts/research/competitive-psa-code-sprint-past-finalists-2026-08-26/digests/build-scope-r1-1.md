# Digest: Build & Demo Scope Teardown — PSA Code Sprint past editions (round 1)

## Findings

1. **Claim:** PSA Code Sprint 2023 champion, Team ByTheSea, built "opPORTunity" — an HR transformation portal with three modules: PortBOT (resume-review/employee-support chatbot), LightHouse (AI talent matching & skill profiling), and PortConnections (AI recommendation engine matching employees for cross-departmental social activities).
   Source: github.com/xavierkoo/psa-codesprint-2023 (README). Publisher: GitHub (participant-authored). Undated. Accessed 2026-08-26. Confidence: high. Class: build-scope.

2. **Claim:** opPORTunity's tech stack: Vue.js (frontend), FastAPI (backend), MySQL via Docker, AI layer of LangChain + ChromaDB + OpenAI API; a separate Streamlit app for the PortBOT demo; orchestrated via Docker Compose (client/server/AI split).
   Source: same repo/README. Accessed 2026-08-26. Confidence: high. Class: tech-stack.

3. **Claim:** README requires a real OpenAI API key — the AI integration was genuinely wired up, not stubbed, though the Streamlit demo layer suggests the riskiest AI demo (chatbot) was isolated into its own simple shell rather than fully integrated into the primary web app — a scoping pattern worth noting.
   Source: same repo. Accessed 2026-08-26. Confidence: medium (inferred from architecture). Class: pattern.

4. **Claim:** Another 2023 project, "HR-Gen2" — also AI-powered HR platform (employee data management, personalized development insights, candidate suitability evaluation, AI company-info Q&A) — built with React, Firebase, and GPT-4.
   Source: github.com/SlothKai/psa-codesprint (README). Publisher: GitHub (participant-authored). Undated. Accessed 2026-08-26. Confidence: high. Class: build-scope/tech-stack.

5. **Claim:** Two independent 2023 teams converged on the same problem domain (HR/workforce transformation) with a similar approach (LLM chatbot + lightweight frontend/backend) — suggests that year's challenge track was HR/talent-focused.
   Confidence: medium (only two data points). Class: pattern.

6. **Claim:** PSA Code Sprint has run annual editions 2021–2025 with an official results page listing champions/runners-up per year (e.g. 2022 champion "Long Ken Kai My" (NUS); 2024 champion "TELETUBBIES" (NYP)), drawing from Singapore universities/polytechnics.
   Source: psacodesprint.com/past-events, psacodesprint.com/code-sprint-2024. Publisher: PSA Code Sprint (official). Accessed 2026-08-26. Confidence: high (names/rankings) — no project descriptions present. Class: build-scope (negative finding).

7. **Claim:** PSA's social channels covered finals (2023 video, 2025 recap post) but these are marketing/event-recap posts, not technical writeups; not deep-fetched.
   Source: facebook.com/singaporepsa, instagram.com/p/DQYJWHhjUJa. Publisher: PSA International. Accessed 2026-08-26. Confidence: low (unverified for technical substance). Class: build-scope.

## What was looked for and not found

- Any description of what 2024/2022/2025 champion/runner-up teams built — official site lists names/rankings only.
- No Devpost page for PSA Code Sprint.
- No participant blog/Medium/LinkedIn build retrospective beyond the two 2023 GitHub repos.
- No PSA press release with technical/build detail.
- Facebook/Instagram finals posts not deep-fetched (budget).

## Leads

- Search GitHub directly for more `psa-codesprint`/`psa-hackathon` repos by year (2021, 2022, 2024, 2025).
- Check individual psacodesprint.com year pages (2021, 2022, 2025) for embedded project descriptions/photos.
- Search LinkedIn directly for team names found here (ByTheSea, TELETUBBIES, JJM, THE SPRINTS, PORT DOCKERS).
- Follow up fetch on the 2023/2025 Facebook/Instagram finals posts.

## Overall assessment

Thin public data. Only 2023 yielded real build-scope/tech-stack detail (from 2 participant GitHub repos, not official sources). Official channels reliably document *who won*, not *what was built*. High confidence on 2023 specifics; low confidence on any cross-year pattern given the small sample.
