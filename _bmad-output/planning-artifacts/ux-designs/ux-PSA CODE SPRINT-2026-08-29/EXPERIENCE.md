---
name: Portwatch — Harbor Signal
status: final
updated: 2026-08-29
owner: product-ux
supersedes: "../ux-PSA CODE SPRINT-2026-08-26/EXPERIENCE.md (Portwatch Console blueprint — retired 2026-08-29)"
sources:
  - "{planning_artifacts}/prds/prd-PSA-CODE-SPRINT-2026-08-24/prd.md"
  - "{planning_artifacts}/architecture/architecture-PSA CODE SPRINT-2026-08-24/"
  - "{planning_artifacts}/epics.md"
  - "imports/portwatch-tuas-src/ (EXPERIENCE.md, Home.tsx, PortwatchPrimitives.tsx, index.css, domain.ts)"
foundation:
  formFactor: "desktop-first command surface, min-width ~1280px, with responsive collapse for narrower laptop widths"
  uiSystem: "React + TypeScript + Vite; shadcn/ui primitives + custom Portwatch operations patterns"
  designReference: "DESIGN.md (Harbor Signal)"
  auth: "none — single fixed operator context for the life of the running demo"
---

# Portwatch — Harbor Signal · Experience Spine

> Internal ops console for PSA Tuas Port multi-agent disruption orchestration. Single-surface desktop web app, no login, no mobile variant. Visual identity: [`DESIGN.md`](./DESIGN.md). Feature scope and data contract are anchored to the **real PRD** (`prd-PSA-CODE-SPRINT-2026-08-24`), which is unchanged by this pass — `frontend/portwatch-tuas/PRD.md` is *not* adopted. This spine and `DESIGN.md` win on conflict with any mock or import.

## Foundation

Desktop-only web console, `min-width: ~1280px`, with a responsive collapse path for narrower laptop widths (see Responsive & Platform) — an instrument panel for someone at a workstation. Single-user, no auth or session management; the console assumes one fixed operator context for the running demo (PRD Out-of-Scope: production auth, persistence beyond the demo session).

The frontend polls a single read-only Incident API every **2–3 seconds** (no websockets). The only write paths from the console are the **approval action** (approve / reject / modify a Tier-3 recommendation) and the **kill switch**. Everything else the operator sees — feed, detail, agent roster, stage rail, confidence, trace, archive, Ask Portwatch answers — is derived from the polled incident state.

Users are operations owners and workers (duty managers, terminal planners, yard supervisors), skewing mid-career, watching or intermittently checking the console mid-shift. Legibility for this audience comes from **behavioral restraint**: most incidents are invisible (Tier 1/2), and the console must not make an operator work to find the one thing (Tier 3) that needs them. The visual language is a deliberate low-glare maritime instrument panel (`DESIGN.md`).

The core operational promise: **confidence, policy, and execution are visible at the same time**, and so is the machine that produced them (see The Orchestra).

### Data contract (backend reconciliation handoff)

`[NOTE FOR ARCHITECTURE/BUILD]` This pass produces UX contracts only. `frontend/portwatch-tuas/src` ships its own Express server + domain model (`DisruptionRecord` / `RecommendationOption`, `OperationalDomain: berth|yard|weather|equipment|staffing`, an `executionStatus` enum) that **diverges** from the current Python/FastAPI backend (`/incidents`, `agents/`, `policy/`, `orchestrator/`, `mock_services/`). The console described here expects the **real PRD's** contract, restyled — not portwatch-tuas's:

| Console needs | From (real PRD) |
|---|---|
| `GET /incidents`, `GET /incidents/{id}` — poll every 2–3s | FR15, Architecture |
| Per-incident `trace[]` — ordered `{ ts, stage, description, status }`, stage ∈ SCREAMING_SNAKE vocab | FR14 |
| Per-incident `agents[]` — `{ name, state, recommendation, constraints, confidenceContribution }` | FR3 |
| Arbiter `options[]` — 2–3 ranked, each `{ label, predictedImpact{delay,cost,yard,risk}, confidence, tier }` | FR4 |
| `confidence` — computed number + breakdown `{ staleness, missingData, disagreement, variance }` | FR6 |
| `tier` ∈ `1|2|3` + `tierReason`; `dgGate` ∈ `pass|violation` (+ `replanning`) | FR7, FR9 |
| `POST /incidents/{id}/approval` — `{ action: approve|reject|modify, optionId, note }` | FR11 |
| `POST /kill-switch` — engage / release; incidents carry `blocked_by_kill_switch` | FR10 |
| `GET /incidents/query` — free-text; resolves entity from text, optional incident hint | FR12 |
| Concurrent incidents — ≥2 active, independent, non-blocking | FR16 |
| Notification step lists **MPA** as a recipient alongside internal teams | FR13 |

A follow-up `bmad-architecture` / `bmad-build` pass reconciles the backend to this. See `handoff-backend-delta.md` in this folder.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| **Live Console** | App open (default) | Primary surface: incident feed, active-incident detail, **agent roster**, **stage rail**, geographic map, decision card, execution trace, Ask Portwatch, kill switch |
| **Active Incidents** | Rail nav | Filtered view of the feed — only unresolved incidents, with tier and confidence at a glance; selecting one returns to the Live Console focused on it |
| **Audit Trail** | Rail nav | Session-scoped chronological execution timeline of resolved incidents (Tier 1, 2, 3) — event, tier, decision, operator, outcome, reference hash — each row links into that incident's full trace. Not a persisted database; cleared on session/demo reset. |

No settings, tiering-configuration, or login surfaces (explicitly deferred). **Approval happens inline** on the Live Console via the decision card — the operator never navigates away from context to act.

→ Composition reference: [`mockups/live-console.html`](./mockups/live-console.html) — Tier 3 approval-pending state with the full orchestra visible (Flow 1). Active Incidents and Audit Trail are spine-only: they reuse the Live Console's feed-row, panel, and status-pill components exactly. Spine wins on conflict with any mock.

## Voice and Tone

Brand voice lives in `DESIGN.md` (Brand & Style). Microcopy here is **plain, factual, non-alarmist** — this console reports real port operations to people who have seen a lot of shifts.

| Do | Don't |
|---|---|
| "MSC Anna — ETA slipped 90 min. Crane #4 hydraulic fault." | "⚠️ CRITICAL DISRUPTION DETECTED ⚠️" |
| "Needs your approval." | "Action required immediately!!!" |
| "Auto-resolved 06:42 — no action needed." | "✓ Success! Everything's fine!" |
| "Couldn't reach Crane #7 — using last known state. Confidence 91% → 67%." | "Error: telemetry timeout (code 504)" |
| "Berth smoothing recommended (projected)." | "AI recommends the optimal solution!" |
| Same plain register for a Tier 1 footnote and a Tier 3 banner — urgency comes from placement and persistence, not tone. | Escalating exclamation / emoji as severity rises. |

Name uncertainty plainly: "projected", "watch threshold", "pending validation", "last known state". CTAs read as operating commands: "Approve", "Reject", "Modify", "Engage kill switch", "Ask Portwatch".

## The Orchestra — Agent Pipeline Visibility

The reason this console exists: an operator must be able to see **how** a recommendation was reached, not just what it is. The multi-agent pipeline stays legible on the Live Console at all times, for the active incident.

**1. Stage rail** — the pipeline as an ordered, always-present strip:

`INGEST → CORRELATE → AGENT_CALL → SYNTHESIZE → CONFIDENCE → POLICY_DECISION → DG_CHECK → APPROVAL → EXECUTE → VERIFY`

Each stage shows one of: `pending` · `active` (current, emphasised) · `done` (seafoam) · `degraded` (amber — e.g. a retry happened here) · `blocked` (red — DG violation, kill switch). Stage labels are the SCREAMING_SNAKE vocabulary verbatim, shared with the trace log and the backend contract.

**2. Agent roster** — the `AGENT_CALL` stage expands to a row of **parallel** agent chips: Berth/Vessel, Crane, Yard (core); AGV/Gate and Weather when those Day-5 agents are built. Each chip shows the agent name, its run state (`QUEUED → RUNNING → COMPLETE`, or `TIMEOUT → FALLBACK` with the reason), and — on expand — that agent's structured recommendation and constraints. The fan-out is drawn side-by-side so it reads as "these ran at once", not a list.

**3. Confidence** — at the `CONFIDENCE` stage, the computed score (PRD FR6, deterministic, never an LLM self-report) with a breakdown of what reduced it: staleness, missing-data, specialist disagreement, outcome variance. The number animates when it changes; it turns amber below the tier threshold.

**4. Policy decision** — `POLICY_DECISION` shows the tier (1/2/3) and the one-line reason it landed there (reversible? SLA breach? safety risk? confidence? DG? cost?). This is a deterministic engine outside LLM authority — the card says so.

**5. DG hard gate** — `DG_CHECK` renders as an explicit labeled boundary: `PASS` (seafoam) or `VIOLATION → RE-PLANNING` (red). A violation forces the arbiter to re-plan even after a tier-approved recommendation — the rail visibly loops back to `SYNTHESIZE`. This is the DG-forced-re-plan demo beat.

**6. Execution & verify** — `EXECUTE` lists each cross-system action (TOS, Crane Scheduler, Yard Manager, AGV Manager, Gate Manager, Notification incl. **MPA**, DG Checker); `VERIFY` shows each action's PASS/FAIL individually. A failure is recorded, never silently treated as success (PRD NFR2).

For **Tier 1** incidents the whole orchestra still runs and is still inspectable in the trace — it just never raises a signal or a card. For **concurrent incidents**, each has its own independent stage rail and agent roster; selecting a feed row swaps the Live Console's focus without disturbing the other.

## Component Patterns

Behavioral rules; visual specs in `DESIGN.md` (Components).

### Command rail
Persistent. Fast switch between Dashboard (Live Console), Active Incidents, Audit Trail. Collapses to icon-only for wider map visibility; collapse state is remembered for the session. Never takes focus away from operational content.

### Incident feed
Newest-first list of incidents from the poll. Each row: incident ID (mono), one-line plain-English summary, tier tag, confidence, live status pill. Selecting a row focuses the whole Live Console — detail, agent roster, stage rail, map, trace — on that incident. A `blocked_by_kill_switch` row carries a visible tag. Stale poll (>~10s) shows a quiet "last updated" note, not an error wall.

### Active-incident detail + decision card
The decision card is the centerpiece and appears only when the active incident is **Tier 3, approval-pending**. It contains: plain-English situation, recommendation, predicted impact (delay / cost / yard / risk), confidence + breakdown, 2–3 ranked alternatives, tier tag, and **Approve / Reject / Modify**. "Modify" lets the operator pick a different returned option before committing. The boundary between "recommended" and "committed" is always visible; nothing executes until the operator acts.

### Agent roster & stage rail
See The Orchestra. Both are always present for the active incident; both are read-only.

### Execution trace log
`aria-live="polite"`. Mono `timestamp · STAGE · description` rows, newest appended. Retries, fallbacks, and per-action verify results are all explicit rows. This is the auditable narrative — it reads chronologically and explains what happened, why, and who acted.

### Ask Portwatch
Free-text query, answered from grounded live incident state (berth, cause, recovery plan, yard %, predicted departure, SLA risk, approval status). The backend resolves the entity from the text; selecting an incident first only biases the answer as an optional hint — it is not required.

### Kill switch
Guarded control in the top bar (confirm before engaging). Engaged: a persistent full-width red banner, and every execution / approval affordance is disabled. Blocked Tier 1/2 incidents get a `blocked_by_kill_switch` flag + feed tag and are resolved via the normal Approve action once the switch is released — not a tier reclassification.

### Map / port canvas
Geographic Tuas berth/yard/route context. Layer toggles: Berths / Yards / Routes. Active route traced in seafoam; selected vessel emphasised. Updates from the same polled incident state. Labelled as an illustrative visualisation of mock incident state (PRD §6a) — not an AIS/VTS feed, no vessel-tracking claim.

## State Patterns

The console spends most of its time in a few highly legible states:

- **Monitoring / live** — no active incident needing attention; ambient heartbeat log ticks; KPIs green. The default.
- **Watch / degraded** — confidence loss or emerging risk on an incident; amber signals; a recommendation may exist but is not yet required.
- **Decision required** — a Tier-3 policy threshold reached; the decision card is present and persistent (calm banner + card, no audio).
- **Executing** — an approved / auto action is running; `EXECUTE`/`VERIFY` stages active; per-action results appear as they land.
- **Re-planning (DG)** — DG gate returned a violation; stage rail loops to `SYNTHESIZE`; red boundary block; new options render when ready.
- **Resolved** — incident cleared; moves to Audit Trail; trace preserved; console returns to Monitoring if nothing else is active.
- **Kill-switch engaged** — global red banner; autonomous execution disabled; blocked incidents tagged.
- **Tool-timeout fallback** — an agent or mock timed out; retried once; now on last-known state with reduced confidence and a logged reason; surfaced, never hidden.

State transitions are explicit and visible: the console shows the current status **and** the operational reason for it, not color alone.

## Interaction Primitives

- Select an incident (feed row / Active Incidents) → focuses the entire Live Console on it.
- Select a vessel or berth on the map → focuses map + ties to the incident context.
- Toggle map layers (Berths / Yards / Routes).
- Expand a stage (esp. `AGENT_CALL`) → reveals the agent roster and per-agent output/constraints.
- Inspect a recommendation and its alternatives before acting.
- Approve / Reject / Modify a Tier-3 recommendation — with the choice preserved in the trace and Audit Trail.
- Ask Portwatch a free-text status question.
- Engage / release the kill switch (guarded).
- Trace an incident end-to-end from the Audit Trail after resolution.

Every interaction should reveal one more layer of decision context, never hide it. Hover / focus expose supplementary detail; the core narrative stays visible without interaction.

## Accessibility Floor

The console must work for operators under time pressure, in dim lighting, at high cognitive load.

- Maintain high contrast; `{colors.textPrimary}` on `{colors.background.ink}` is the default readable pairing (verify AA ≥ 4.5:1 for body, ≥ 3:1 for large/mono labels at finalize — `[ASSUMPTION]` the Harbor Signal secondary text `{colors.textSecondary}` and the desaturated signal-text variants pass on panel surfaces; confirm with a contrast check).
- Never rely on color alone for state — every state carries a text label, and where possible a shape or position cue (stage position, pill dot, boundary block).
- Keep status text explicit (`WATCH`, `DEGRADED`, `TIER 3`, `MANUAL APPROVAL REQUIRED`, `SAFE FALLBACK`, `DG VIOLATION`).
- Visible focus rings for keyboard users (2px seafoam, 3px offset — per portwatch-tuas `:focus-visible`).
- Route changes move focus into the new view container.
- Honour `prefers-reduced-motion`: disable the confidence tween, status-dot breathing, radar sweep, and panel transitions; state still resolves instantly and legibly.
- The execution trace is `aria-live="polite"` so new stages are announced without stealing focus.
- Avoid dense hidden tables when the operator needs to resolve a live incident fast.

Accessibility here is operationally necessary, not supplemental.

## Key Flows

Protagonists and incident numbers are from the **real PRD** (User Journeys UJ-1/2/3), mapped onto the canonical golden-path scenario.

### 1. Priya approves a Tier-3 recovery with the whole orchestra in view
Priya is Ops Duty Manager on the evening shift. MSC Anna's ETA slips 90 minutes (Malacca Strait congestion); five minutes later Crane #4 reports a hydraulic fault.

1. Portwatch has already **correlated** both signals into one incident — Priya sees one feed row, not two alerts. She selects it.
2. The **stage rail** shows `AGENT_CALL` active; the **agent roster** shows Berth/Vessel, Crane, and Yard agents running in parallel. The Crane agent hits a **Crane #7 telemetry timeout** — its chip flips `TIMEOUT → FALLBACK (last known state)`, and the `CONFIDENCE` readout animates **91% → 67%** with "missing-data" called out in the breakdown.
3. The arbiter (`SYNTHESIZE`) returns three ranked options and recommends Option B. `DG_CHECK` returns **VIOLATION** — DG segregation rejects part of Option B. The rail visibly loops back to `SYNTHESIZE`; a revised plan renders.
4. Because the revised plan still risks an SLA breach, `POLICY_DECISION` lands **Tier 3** ("SLA breach risk + degraded confidence") and the **decision card** appears: situation, recommendation, predicted impact, confidence, alternatives.
5. Priya reviews it in under a minute and clicks **Approve**. `EXECUTE` runs across TOS, Crane Scheduler, Yard Manager, AGV Manager; Notification goes to internal teams **and MPA**; `VERIFY` shows each PASS individually.

**Climax beat:** the DG gate rejects a tier-approved plan on-screen, Portwatch re-plans, and only then does Priya's single approval close the loop — the trace records the decision and every resulting state change.

### 2. Farah asks for status mid-incident
Farah is a terminal planner on the same shift, not handling the incident.

1. She types into **Ask Portwatch**: "What's the current status of MSC Anna?"
2. Portwatch resolves the entity from her text and answers from grounded incident state: berth, cause, recovery plan, yard %, predicted departure, SLA risk, approval status — not a generic model answer.
3. She did not have to find or select the incident first.

**Climax beat:** a plain-language question gets a grounded, specific answer in one step, mid-incident.

### 3. Arif never sees the Tier-1 incident
Arif is a yard supervisor, mid-shift, not watching the console.

1. Gate queue metrics show a minor congestion blip — fully reversible, no SLA exposure, no safety flag.
2. Portwatch ingests it, the orchestra runs end to end, `POLICY_DECISION` lands **Tier 1**, and it **auto-executes silently** — schedule refresh + appointment adjustment. No card, no signal.
3. Arif's first awareness is a routine notification already marked resolved; the full trace is there if he opens the Audit Trail.

**Climax beat:** the system stays silent on something that doesn't matter — which is exactly what gives Flow 1's escalation its weight.

## Inspiration & Anti-patterns

### Inspiration
- Maritime bridge instrumentation and signal-labeled displays.
- Observability dashboards that make confidence and pipeline state first-class.
- Safe decision surfaces that show both the automation and the human-approval boundary.
- Low-noise status hierarchies that keep the operator oriented in high-stakes contexts.

### Anti-patterns
- Over-designed marketing dashboards with decorative chrome.
- A single confidence number with no breakdown; a recommendation with no visible pipeline.
- Approval surfaces that lean on vague language or manufactured urgency.
- "One-click everything" that hides sequencing or accountability.
- Color-only severity.

## Responsive & Platform

Primarily a large desktop / wide laptop display — the operator scans feed, map, agent roster, stage rail, decision card, and trace at once.

For narrower widths the priorities hold:
- Keep the command rail accessible (collapsed to icons).
- Collapse the map and secondary panels into drawers or stacked sections; the **active incident + decision card + stage rail** stay dominant.
- Preserve the same state semantics, labels, SCREAMING_SNAKE vocabulary, and audit flow.
- Never degrade into an information-dense but unreadable stack.

No mobile surface (PRD Out-of-Scope).

# Portwatch — Harbor Signal helps an operator understand the disruption, see how the recommendation was built, choose the right response, and keep the accountability trail — without losing speed.
