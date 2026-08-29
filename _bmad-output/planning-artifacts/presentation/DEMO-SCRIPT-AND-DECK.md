---
title: Portwatch — Demo Video Script + Pitch Deck
status: draft-v1
created: 2026-08-29
owner: presentation (Caravaggio)
sources:
  - prds/prd-PSA-CODE-SPRINT-2026-08-24/prd.md   # deliverable rubric, UJ-1/2/3, pitch-narrative beats (Open Items)
  - architecture/.../ARCHITECTURE-SPINE.md         # pipeline, "LLM proposes / engine disposes", ADs
  - ux-designs/ux-PSA CODE SPRINT-2026-08-29/EXPERIENCE.md  # Harbor Signal surfaces, Key Flows
  - ux-designs/ux-PSA CODE SPRINT-2026-08-29/DESIGN.md      # Harbor Signal palette/type
  - backend/api/demo_seed.py                       # exact incident ids, numbers, trace stages
decisions:
  video_format: live screen capture of Harbor Signal + voiceover
  deck: presenter-support only (sparse, big type — not read in isolation)
  architecture_depth: one diagram, ~75s
  singapore_context: stated up front, in the problem
targets: "≤10 min video · ≤10 slides · all 4 judging criteria on screen"
---

# Portwatch — Demo Video Script + Pitch Deck

> **Judging criteria this has to land** (PRD §1, §8): Agentic AI Design & Technical Execution · Innovation & Originality · Scalability & Responsible AI · Presentation & Clarity. Each has a marked beat below.

---

## Part 1 — The Demo Video (shot-by-shot)

**Format:** screen recording of the real Harbor Signal console (`frontend/portwatch-tuas` re-skin, wired to the FastAPI backend), single voiceover, no on-camera presenter. Target **9:00–9:30** on a 10:00 hard cap — the 30–60s of slack absorbs live-LLM latency.

**Recording setup**
- 1920×1080, console at `min-width ≥ 1280px`, browser chrome hidden (kiosk / full-screen).
- Seed data loaded (`PORTWATCH_SEED=1`, `backend/api/demo_seed.py`). The golden-path incident is driven **live** (real agent calls) on top of the seed; `MOCK_AGENTS` (AD-16) is the safety net if a call misbehaves — if it fires, the "response mocked for demo stability" tag is visible and the VO does not claim otherwise.
- Cursor discipline: move deliberately, pause 1s before every click, never wiggle. The cursor is a laser pointer, not a fidget toy.
- Capture 3s of hold before and after every scene cut for clean edits.
- **Day-6 backup run** (PRD §10) recorded end-to-end the day before, same script — this is the submission fallback if judging-day latency breaks a live take.

**Voice/tone** (from EXPERIENCE.md → Voice and Tone): plain, factual, non-alarmist. "Couldn't reach Crane #7 — using last known state." Never "⚠️ CRITICAL DISRUPTION." The restraint *is* the pitch.

Legend: **[SCREEN]** what's visible · **[ACTION]** cursor/interaction · **[VO]** narration · **[⭐]** judging-criteria beat.

---

### ACT 1 — The problem (0:00 – 1:15)

#### Scene 1.1 — Cold open (0:00 – 0:20)
- **[SCREEN]** Harbor Signal in its **Monitoring / live** state. Dark marine instrument panel. Ambient heartbeat log ticking. KPIs seafoam-green. No incident card. Let it breathe for 3 seconds before the VO starts.
- **[VO]** "This is the operations console at Tuas Port. Right now, nothing needs a human. That's the point — hold that thought."
- **[ACTION]** Slow zoom / settle on the feed column.

#### Scene 1.2 — The gap (0:20 – 1:15)
- **[SCREEN]** Cut to a single static diagram slide (Deck Slide 2 art): four labelled silos — Quay Cranes · AGVs · Yard Cranes · Yard Planning — each with a small internal "auto" loop. Then a red cascade line is drawn cutting *across* all four.
- **[VO]** "Tuas is one of the most automated ports on earth. But the automation runs deep *inside* each system — cranes, AGVs, yard planning — each optimising its own box."
- **[VO]** "Disruptions don't respect those boxes. A vessel slips its ETA, and ninety minutes later that's a berth problem, a crane problem, a yard problem, and an AGV problem — and no single system owns it end to end. Today a human correlates those signals by hand, mid-incident, under a clock."
- **[SCREEN]** Swap to the "Why Singapore" art (Deck Slide 3): four stat blocks.
- **[VO]** "And this is Singapore. Over eighty percent of the cargo is transshipment — box to box, not simple import-export. Operations span two physically separate terminals, Tuas and Pasir Panjang, that have to balance capacity against each other. Vessels move through the world's densest strait, and MPA compliance runs through the whole operation. This isn't a generic terminal with the nouns swapped — orchestrating *this* is the problem."
- **[⭐ Innovation & Originality]** — problem is framed as Singapore-specific, not a template.

---

### ACT 2 — The machine (1:15 – 2:30)

#### Scene 2.1 — One line (1:15 – 1:35)
- **[SCREEN]** Deck Slide 4 — one sentence, large.
- **[VO]** "Portwatch is a multi-agent layer that sits *on top* of PSA's existing automation. It detects a cross-system incident, correlates the signals, runs specialist agents to analyse it, decides what's safe to execute on its own, and puts everything else in front of a human — with a complete trace of every decision."

#### Scene 2.2 — The pipeline (1:35 – 2:30)
- **[SCREEN]** Deck Slide 5 — the **one architecture diagram**, animated left to right as the VO names each stage:
  `INGEST → CORRELATE → AGENT_CALL (Berth ∥ Crane ∥ Yard) → SYNTHESIZE (arbiter) → CONFIDENCE → POLICY_DECISION → DG_CHECK → APPROVE → EXECUTE → VERIFY`
- **[VO]** "One pipeline. Signals normalise and correlate into a single incident. Three specialist agents — berth, crane, yard — run *in parallel*, each with its own narrow tool access; the berth agent physically cannot call the yard manager."
- **[VO]** "An arbiter synthesises their outputs into two or three ranked recovery options. Then a **deterministic** layer takes over — a computed confidence score, a policy engine that classifies the action, and a dangerous-goods hard gate. Execution runs against every affected system and verifies each one."
- **[SCREEN]** The `POLICY_DECISION` and `DG_CHECK` blocks pulse; a small label appears: *no LLM in these boxes.*
- **[VO]** "The rule the whole system is built on: **the LLM proposes, a deterministic engine disposes.** Tier classification, the DG gate, the kill switch — that's plain code, no model in the decision path. That's our answer to 'it's a black box.'"
- **[⭐ Scalability & Responsible AI]** — deterministic control surface stated explicitly and shown in the diagram.

---

### ACT 3 — Golden path, live (2:30 – 6:30)  ·  *the heart of the demo*

> Canonical scenario: the **Three-Way Disruption** (PRD UJ-1, EXPERIENCE.md Flow 1, `demo_seed.py::demo-tier3-alts`). Protagonist: **Priya**, Ops Duty Manager.

#### Scene 3.1 — Two signals, one incident (2:30 – 3:05)
- **[SCREEN]** Back in the live console. Trigger signal 1: **MSC Anna — ETA slipped 90 min (Malacca Strait congestion)**. A feed row appears. ~4s later trigger signal 2: **Crane #4 — hydraulic fault**.
- **[SCREEN]** Crucially: the feed still shows **one row**, not two. Summary reads: *"MSC Anna — ETA slipped 90 min. Crane #4 hydraulic fault."*
- **[VO]** "Two signals, five minutes apart. Priya doesn't triage two alerts — Portwatch has already correlated them into one incident, because they share the same vessel and berth inside a fifteen-minute window."
- **[ACTION]** Click the feed row. Whole console focuses on the incident.
- **[⭐ Agentic AI Design]** — correlation, not alert spam.

#### Scene 3.2 — The orchestra runs (3:05 – 3:50)
- **[SCREEN]** **Stage rail** shows `AGENT_CALL` active. **Agent roster** expands: three chips — Berth/Vessel, Crane, Yard — side by side, all `RUNNING`, drawn so it reads as *at once*, not a list.
- **[ACTION]** Expand the Berth chip: its summary ("ETA slip pushes MSC Anna past the B3 window; Berth C7 slot 5 is the cleanest re-berth"), its actions, its constraints.
- **[VO]** "Three specialist agents, running in parallel. Each one only sees its own domain and its own tools. Here's the berth agent's actual reasoning and the constraints it's handing forward — not a summary Portwatch wrote afterward, the agent's own output."
- **[SCREEN]** Berth and Yard chips flip to `COMPLETE` (seafoam).

#### Scene 3.3 — A tool fails — and the system tells you (3:50 – 4:35)
- **[SCREEN]** The **Crane** chip flips `TIMEOUT → FALLBACK (last known state)` — amber. Trace row appears: `AGENT_CALL · crane · crane #7 telemetry timeout · retried · fallback_used`.
- **[SCREEN]** The `CONFIDENCE` readout animates **91% → 67%**. Breakdown shows the **missing-data** penalty called out.
- **[VO]** "Mid-analysis, the crane agent can't reach Crane #7's telemetry. It retries once, then falls back to last-known state. Confidence drops from ninety-one to sixty-seven, and the breakdown says exactly why — missing data. That number is *computed* — staleness, missing fields, agent disagreement, outcome spread. It is never the model grading its own homework."
- **[VO]** "It degrades. It doesn't crash. And it shows its work."
- **[⭐ Scalability & Responsible AI]** — graceful degradation + deterministic confidence = engineering maturity, not happy-path scripting.

#### Scene 3.4 — The DG gate overrides the AI (4:35 – 5:20)  ·  *climax beat*
- **[SCREEN]** `SYNTHESIZE` completes: the decision area shows **3 ranked options**. Top recommendation involves a **berth-window swap with EVER GIVEN** (`opt-3`, `dg_involved`).
- **[SCREEN]** `DG_CHECK` renders as an explicit boundary block → **VIOLATION → RE-PLANNING** (red). Trace: `DG_CHECK · rejected_option opt-3 · DG/IMDG segregation conflict`. The stage rail **visibly loops back to `SYNTHESIZE`**.
- **[VO]** "The arbiter's top plan is a berth swap. The dangerous-goods gate checks IMDG segregation — and rejects it. Incompatible DG classes would end up berthed together. This gate sits *outside* the policy tiers and *outside* the model. It just overruled the AI's best answer, on screen, and forced a re-plan."
- **[SCREEN]** A revised recommendation renders: **reassign MSC Anna to Berth C7 slot 5, reroute yard moves via Crane #6** (`opt-2`).
- **[⭐ Agentic AI Design + Responsible AI]** — the single strongest 45 seconds in the demo. Do not rush it.

#### Scene 3.5 — Policy lands Tier 3 → the decision card (5:20 – 6:00)
- **[SCREEN]** `POLICY_DECISION` → **TIER 3**. Reason line: *"SLA breach risk + degraded confidence (67% < 70 threshold)."* The **decision card** appears, calm banner, no audio:
  - Situation (plain English) · Recommendation (`opt-2`) · Predicted impact: **+35 min · cost medium · minor yard reshuffle · risk low** · Confidence **67%** · 3 alternatives · **Approve / Reject / Modify**.
- **[VO]** "The revised plan still risks an SLA breach, and confidence is below threshold. So the policy engine stops. It does *not* auto-execute. It builds one decision card — situation, recommendation, predicted impact, confidence, the alternatives — and it waits."
- **[⭐ Presentation & Clarity]** — the human-approval boundary is unmistakable.

#### Scene 3.6 — Approve, execute, verify (6:00 – 6:30)
- **[ACTION]** Read the card for a beat. Click **Approve**.
- **[SCREEN]** `EXECUTE` lists each action landing: **TOS · Crane Scheduler · Yard Manager · AGV Manager · Notification (internal teams + MPA) · DG Checker**. `VERIFY` marks each **PASS** individually. Incident moves toward resolved; trace is complete top to bottom.
- **[VO]** "Priya approves. Portwatch executes across four systems, notifies the internal teams *and* MPA, and verifies each action on its own. Every step you just watched is now a timestamped trace entry."

---

### ACT 4 — The proof points (6:30 – 8:45)

#### Scene 4.1 — The invisible majority · Tier 1 (6:30 – 7:00)
- **[SCREEN]** Feed shows `demo-auto-resolved` (yard Y4, Tier 1, resolved) and `demo-in-progress`. Trigger a fresh **gate-queue congestion blip**. It runs the full pipeline and resolves **without ever raising a card**. A routine notification appears already marked resolved.
- **[VO]** "Most incidents look like this. Fully reversible, no SLA exposure, no safety flag — confidence over the bar. The orchestra still runs end to end, the trace is still complete, but Tier 1 executes silently. Nobody gets pinged. That restraint is what gave Priya's escalation its weight."
- **[⭐ Innovation & Originality]** — "don't cry wolf" as a designed behaviour.

#### Scene 4.2 — Two incidents at once (7:00 – 7:35)
- **[SCREEN]** With MSC Anna still on screen, trigger a second independent incident (`demo-load-balancing` — Tuas C7 at 93%, reroute ~600 TEU to Pasir Panjang P2). Select between the two feed rows — each has **its own stage rail, its own agent roster**, neither blocks the other.
- **[VO]** "Two incidents, running concurrently. Each is an isolated task with no shared mutable state — that's built in from day one, not retrofitted. And notice the second one's recommended fix routes container flow from Tuas to Pasir Panjang. Same agents, same policy engine, a whole new option type — no redesign."
- **[⭐ Scalability & Responsible AI]** — FR16 concurrency + FR17 dual-terminal, both on screen.

#### Scene 4.3 — Ask in plain language (7:35 – 8:05)
- **[ACTION]** In **Ask Portwatch**, type: *"What's the current status of MSC Anna?"*
- **[SCREEN]** Grounded answer: berth, cause, recovery plan, yard %, predicted departure, SLA risk, approval status — pulled from live incident state.
- **[VO]** "A planner who isn't handling the incident just asks. Portwatch resolves the vessel from the text and answers from the live incident — not a generic model reply. One step, no clicking around to find it first."

#### Scene 4.4 — The kill switch (8:05 – 8:45)
- **[ACTION]** Click the guarded **kill switch** in the top bar. Confirm.
- **[SCREEN]** Persistent full-width **red banner**. Every execute/approve affordance disabled. Trigger a Tier 1 gate incident — it lands, gets a **`blocked_by_kill_switch`** tag in the feed, and does **not** execute. Its tier is still 1, not reclassified.
- **[ACTION]** Release the switch. Approve the blocked incident through the normal action; it executes and verifies.
- **[VO]** "One global flag, checked at exactly one point — right before any execution. Engage it and every autonomous action stops instantly. Anything that would have auto-run gets flagged for a human, not silently dropped and not secretly downgraded. Release it, and the operator clears the backlog the normal way."
- **[⭐ Scalability & Responsible AI]** — hard off-switch, cleanly enforced.

---

### ACT 5 — Trace + close (8:45 – 9:30)

#### Scene 5.1 — The audit trail (8:45 – 9:15)
- **[ACTION]** Open **Audit Trail**. Scroll the session's resolved incidents — Tier 1, 2, and 3. Open one row into its full trace.
- **[SCREEN]** Mono trace, chronological: `INGEST → CORRELATE → AGENT_CALL (incl. the retry + fallback) → SYNTHESIZE → CONFIDENCE → POLICY_DECISION → DG_CHECK → APPROVAL → EXECUTE → VERIFY`.
- **[VO]** "Every incident this session — what came in, which tools were called, which ones failed and were retried, what each agent recommended, how confidence was computed, what the policy engine decided, who approved it, and whether every action verified. The decisions Portwatch made on its own, and the ones it handed to a person, are in the same record."
- **[⭐ Agentic AI Design & Technical Execution]** — the complete execution trace, the rubric's core requirement.

#### Scene 5.2 — Close (9:15 – 9:30)
- **[SCREEN]** Deck Slide 10. Two lines of roadmap, then the wordmark.
- **[VO]** "Portwatch speaks Singapore's port — transshipment, two terminals, the strait, MPA — because that's what it was built for. Next on the roadmap: strait-level collision avoidance, and transshipment optimisation. Not today's demo — but the same orchestration layer extends to both. Thanks for watching."
- **[SCREEN]** Hold the end card 3s.

---

### Cut-for-time priority (if a live take runs long)
Trim in this order — never cut Act 3:
1. Scene 4.3 (Ask Portwatch) — shave to 15s or drop.
2. Scene 1.1 cold open — tighten to 10s.
3. Scene 4.2 — show concurrency, drop the FR17 load-balancing aside.
4. Scene 5.1 — one trace, don't scroll the list.

**Never cut:** correlation (3.1), the timeout/confidence beat (3.3), the DG override (3.4), the Tier-3 card + approve (3.5–3.6), the kill switch (4.4).

---

## Part 2 — The Pitch Deck (≤10 slides · presenter-support)

**Design:** Harbor Signal identity for continuity with the demo — ground `#07141B`, panels `#0D1C26`, text `#EAF7F9`, one accent per slide (seafoam `#66E0D2` healthy / amber `#F7B267` uncertainty / red `#E8695A` stop). Display type **Space Grotesk 600**; labels/mono **IBM Plex Mono** uppercase, letter-spacing `0.17em`. One idea per slide, ≤12 words of body, passes the 3-second rule. Slides back the narration — they are not read alone.

| # | Slide | On-slide text (final) | Visual | Speaker note |
|---|---|---|---|---|
| 1 | **Title** | `PORTWATCH` / "AI-powered disruption orchestration for Tuas Port" | Wordmark on ink; faint stage-rail motif along the base | Team + track. 5 seconds, move on. |
| 2 | **The gap** | "Automation runs deep *inside* each system. Disruptions cross every boundary." | Four auto-looping silos (Cranes · AGVs · Yard Cranes · Yard Planning); red cascade line cutting across | Today a human correlates these by hand, mid-incident, under a clock. |
| 3 | **Why Singapore** | "80% transshipment · Tuas ⇌ Pasir Panjang · world's densest strait · MPA throughout" | Four mono stat blocks | Not a generic terminal with port nouns swapped in. Orchestrating *this* is the problem. |
| 4 | **What it is** | "A multi-agent layer on top of PSA's automation: detect · correlate · decide · act · trace." | One line, large; small pipeline glyph beneath | It augments the existing automation, it doesn't replace it. |
| 5 | **Architecture** | `INGEST → CORRELATE → AGENTS ∥ → ARBITER → CONFIDENCE → POLICY → DG GATE → EXECUTE → VERIFY` | The one pipeline diagram; agents fan out and back in; POLICY + DG GATE marked "no LLM" | 75 seconds. This is the only architecture slide. |
| 6 | **The core rule** | "The LLM proposes. A deterministic engine disposes." | Split panel: *proposes* (agents, seafoam) / *disposes* (policy, DG gate, kill switch — plain, no accent) | Our answer to "it's a black box." Tier logic, DG gate, kill switch: plain code. |
| 7 | **Tiered autonomy** | "Tier 1 — silent · Tier 2 — auto + notify · Tier 3 — human approves" | Three stacked bands; Tier 3 carries the amber accent | Most incidents are invisible. That's what gives an escalation its weight. |
| 8 | **Built for the real world** | "Tool times out → retry → fallback → confidence degrades, logged. Never self-reported." | Confidence readout 91% → 67% with the breakdown | It degrades, it doesn't crash, and it shows its work. |
| 9 | **Scale & audit** | "Stateless per incident · concurrent by design · complete timestamped trace · MPA in the loop" | Two independent stage rails side by side; a trace strip below | ≥2 incidents resolve concurrently, live. Every decision — auto or human — in one record. |
| 10 | **Roadmap + close** | "Roadmap: strait-level collision avoidance · transshipment optimisation" / `PORTWATCH` | Wordmark; roadmap items in muted text, clearly labelled *not demoed* | Same orchestration layer extends to both. State as ambition, never as a working feature. |

### Slide ↔ video map
- Slides 2–3 → Act 1 (static art reused as the video's problem visuals).
- Slides 4–6 → Act 2 (Slide 5 art *is* the video's architecture diagram).
- Slides 7–9 → recap frames for Acts 3–4 if presenting deck + video together; otherwise pure narration backing.
- Slide 10 → Act 5 close.

### Responsible-AI honesty checklist (must hold in both deck and video)
- [ ] The geographic map is called an **illustrative visualisation of mock incident state** — not an AIS/VTS feed (PRD §6a).
- [ ] The DG/IMDG ruleset is stated as a **simplified representative subset**, not certified compliance (PRD §6).
- [ ] MPA / digitalPORT@SG is **designed-to-be-compatible**, mocked — never "integrated" (FR19).
- [ ] Collision avoidance and transshipment optimisation are **roadmap only**, never shown as working (Future Extensions).
- [ ] If `MOCK_AGENTS` fires during a take, the "response mocked for demo stability" tag is visible and the VO doesn't claim a live call (AD-16 honesty requirement).

---

## Part 3 — Clean narration script (for the VO recording)

> Continuous read, no stage directions. ~1,150 words ≈ 8:30–9:00 at a calm operator pace. Time-check against picture at Scene 3.4 and Scene 4.4.

**[Act 1]**
This is the operations console at Tuas Port. Right now, nothing needs a human. That's the point — hold that thought.

Tuas is one of the most automated ports on earth. But the automation runs deep inside each system — cranes, AGVs, yard planning — each optimising its own box. Disruptions don't respect those boxes. A vessel slips its ETA, and ninety minutes later that's a berth problem, a crane problem, a yard problem, and an AGV problem — and no single system owns it end to end. Today a human correlates those signals by hand, mid-incident, under a clock.

And this is Singapore. Over eighty percent of the cargo is transshipment — box to box, not simple import-export. Operations span two physically separate terminals, Tuas and Pasir Panjang, that have to balance capacity against each other. Vessels move through the world's densest strait, and MPA compliance runs through the whole operation. This isn't a generic terminal with the nouns swapped — orchestrating this is the problem.

**[Act 2]**
Portwatch is a multi-agent layer that sits on top of PSA's existing automation. It detects a cross-system incident, correlates the signals, runs specialist agents to analyse it, decides what's safe to execute on its own, and puts everything else in front of a human — with a complete trace of every decision.

One pipeline. Signals normalise and correlate into a single incident. Three specialist agents — berth, crane, yard — run in parallel, each with its own narrow tool access; the berth agent physically cannot call the yard manager. An arbiter synthesises their outputs into two or three ranked recovery options. Then a deterministic layer takes over — a computed confidence score, a policy engine that classifies the action, and a dangerous-goods hard gate. Execution runs against every affected system and verifies each one.

The rule the whole system is built on: the LLM proposes, a deterministic engine disposes. Tier classification, the DG gate, the kill switch — that's plain code, no model in the decision path. That's our answer to "it's a black box."

**[Act 3]**
Two signals, five minutes apart. MSC Anna's ETA slips ninety minutes in the Malacca Strait; then Crane #4 reports a hydraulic fault. Priya doesn't triage two alerts — Portwatch has already correlated them into one incident, because they share the same vessel and berth inside a fifteen-minute window.

Three specialist agents, running in parallel. Each one only sees its own domain and its own tools. Here's the berth agent's actual reasoning and the constraints it's handing forward — not a summary Portwatch wrote afterward, the agent's own output.

Mid-analysis, the crane agent can't reach Crane #7's telemetry. It retries once, then falls back to last-known state. Confidence drops from ninety-one to sixty-seven, and the breakdown says exactly why — missing data. That number is computed — staleness, missing fields, agent disagreement, outcome spread. It is never the model grading its own homework. It degrades. It doesn't crash. And it shows its work.

The arbiter's top plan is a berth swap. The dangerous-goods gate checks IMDG segregation — and rejects it. Incompatible DG classes would end up berthed together. This gate sits outside the policy tiers and outside the model. It just overruled the AI's best answer, on screen, and forced a re-plan.

The revised plan still risks an SLA breach, and confidence is below threshold. So the policy engine stops. It does not auto-execute. It builds one decision card — situation, recommendation, predicted impact, confidence, the alternatives — and it waits.

Priya approves. Portwatch executes across four systems, notifies the internal teams and MPA, and verifies each action on its own. Every step you just watched is now a timestamped trace entry.

**[Act 4]**
Most incidents look like this. Fully reversible, no SLA exposure, no safety flag — confidence over the bar. The orchestra still runs end to end, the trace is still complete, but Tier 1 executes silently. Nobody gets pinged. That restraint is what gave Priya's escalation its weight.

Two incidents, running concurrently. Each is an isolated task with no shared mutable state — that's built in from day one, not retrofitted. And the second one's recommended fix routes container flow from Tuas to Pasir Panjang. Same agents, same policy engine, a whole new option type — no redesign.

A planner who isn't handling the incident just asks: what's the current status of MSC Anna? Portwatch resolves the vessel from the text and answers from the live incident — not a generic model reply. One step.

One global flag, checked at exactly one point — right before any execution. Engage it and every autonomous action stops instantly. Anything that would have auto-run gets flagged for a human, not silently dropped and not secretly downgraded. Release it, and the operator clears the backlog the normal way.

**[Act 5]**
Every incident this session — what came in, which tools were called, which ones failed and were retried, what each agent recommended, how confidence was computed, what the policy engine decided, who approved it, and whether every action verified. The decisions Portwatch made on its own, and the ones it handed to a person, are in the same record.

Portwatch speaks Singapore's port — transshipment, two terminals, the strait, MPA — because that's what it was built for. Next on the roadmap: strait-level collision avoidance, and transshipment optimisation. Not today's demo — but the same orchestration layer extends to both. Thanks for watching.

---

## Open questions for the team
1. **Golden-path trigger mechanism on camera** — is there a dev "inject signal" control, or do we drive it via `curl`/a script off-screen? Affects whether Scene 3.1 shows a trigger action or just the result appearing.
2. **DG beat wiring** — `demo_seed.py` rejects `opt-3` at `DG_CHECK`; EXPERIENCE.md Flow 1 says the gate rejects part of the *recommended* option and loops to `SYNTHESIZE`. The script follows the EXPERIENCE.md version (stronger beat). Confirm the live golden path actually renders the rail looping back, or adjust narration to "rejects an option" if not.
3. **Concurrency take** — can we trigger a genuine second live incident, or is the 2nd one seed-only with a static rail? Changes Scene 4.2's claim strength.
4. **Deck build target** — Slides, Canva, or Figma? Say the word and I'll produce the actual slides from this table.
