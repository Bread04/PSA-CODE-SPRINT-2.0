---
name: Portwatch Console
status: superseded
superseded_by: "../ux-PSA CODE SPRINT-2026-08-29/EXPERIENCE.md (Portwatch — Harbor Signal, 2026-08-29). Retired when visual identity was redirected to follow frontend/portwatch-tuas/src. Behavioral decisions (computed confidence, DG gate, session-scoped archive, no-color-only severity, IA scope) carried forward into the new spine."
sources:
  - "{planning_artifacts}/prds/prd-PSA-CODE-SPRINT-2026-08-24/prd.md"
  - "{planning_artifacts}/architecture/architecture-PSA CODE SPRINT-2026-08-24/ARCHITECTURE-SPINE.md"
  - "{planning_artifacts}/epics.md"
  - "imports/portwatch-console-design/Portwatch Console.dc.html"
updated: 2026-08-26
---

# Portwatch Console — Experience Spine

> Internal ops tool. Single-surface desktop web console (React + TypeScript + Vite), no responsive/mobile variant, no login. Paired with `DESIGN.md` for visual identity. Grounded in the Portwatch PRD, Architecture Spine, and the existing design canvas import.

## Foundation

Desktop-only web console, `min-width: 1280px`, no breakpoints below that — this is an instrument panel for someone at a workstation, not a phone. Single-user, no auth or session management; the console assumes one fixed operator context for the life of the running demo (Architecture AD, PRD Out-of-Scope). Frontend polls a single read-only Incident API every 2–3 seconds (`GET /incidents`, `GET /incidents/{id}`); the only write paths from the console are the approval action (`POST /incidents/{id}/approval`) and the kill switch (`POST /kill-switch`). `DESIGN.md` is the visual identity reference; this spine owns behavior.

Users: operations owners and workers, skewing middle-aged, watching or intermittently checking the console mid-shift. The visual language (`DESIGN.md`) is a precise, schematic instrument panel by deliberate choice, matching the team's existing design canvas exactly — legibility for this audience comes from behavioral restraint, not from softening the aesthetic: most incidents should be invisible (Tier 1/2), and the console should not make an operator work to find the one thing (Tier 3) that needs them.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Live Console | App open (default) | Primary surface: incident feed, active incident detail, map/yard panels, execution trace, Ask Portwatch, kill switch |
| Incident Archive | Nav tab from Live Console | Session-scoped list of resolved incidents (Tier 1, 2, and 3) with their outcome and a link into their full trace — not a persisted database, cleared when the session/demo resets |

No settings, tiering-configuration, or login surfaces in this pass (explicitly deferred). Approval happens inline on the Live Console via the approval banner, not a separate screen — the operator should never have to navigate away from context to act.

→ Composition reference: [`mockups/live-console.html`](./mockups/live-console.html) — Tier 3 approval-pending state (Flow 1). Incident Archive is spine-only: it reuses the Live Console's feed-row and blueprint-panel components exactly, so no separate mock was produced. Spine wins on conflict with any mock.

## Voice and Tone

Brand voice lives in `DESIGN.md.Brand & Style`. Microcopy here is **plain, factual, and non-alarmist** — this console reports on real port operations to people who've seen a lot of shifts; it doesn't need to sell them on urgency.

| Do | Don't |
|---|---|
| "MSC Anna — ETA slipped 90 min. Crane #4 hydraulic fault." | "⚠️ CRITICAL DISRUPTION DETECTED ⚠️" |
| "Needs your approval." | "Action required immediately!!!" |
| "Auto-resolved. Resolved 6:42am, no action needed." | "✓ Success! Everything's fine!" |
| "Couldn't reach Crane #7 — using last known state. Confidence 67%." | "Error: telemetry timeout (code 504)" |
| Same plain register for a Tier 1 footnote and a Tier 3 banner — urgency comes from placement and persistence, not tone. | Escalating exclamation/emoji as severity increases. |

## Component Patterns

Behavioral; visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Incident feed | Live Console, left column | Reverse-chronological list of open + recently-resolved incidents. Clicking a row loads it into the incident detail column. Tier 3 rows awaiting approval always sort to the top, above recency. |
| Incident detail | Live Console, center column | Shows situation, recommendation, predicted impact, alternatives for the selected incident. If the selected incident is Tier 3 and unresolved, the approval banner renders pinned at the top of this column. |
| Approval banner | Incident detail, when Tier 3 pending | Persistent — no auto-dismiss, no timeout-driven default action. Approve executes immediately; Reject cancels the recommendation and logs the rejection to the trace; Modify lets the operator pick a listed alternative (never free-text edit of the plan — alternatives are pre-computed, not authored live). |
| Execution trace | Live Console, right column | Append-only, newest entry at top, one row per stage (`INGEST`, `CORRELATE`, `AGENT_CALL`, `SYNTHESIZE`, `CONFIDENCE`, `POLICY_DECISION`, `DG_CHECK`, `APPROVAL`, `EXECUTE`, `VERIFY`). Renders live as new entries arrive via polling — `aria-live="polite"` so screen readers announce new entries without interrupting. |
| Ask Portwatch | Live Console, below trace | Free-text question + suggestion chips, always usable standalone — the backend resolves the relevant incident from the question itself (`GET /incidents/query`, FR12), so an operator never has to select an incident first (matches UJ-2: a planner asks "What's the status of MSC Anna?" without navigating anywhere). If an incident is already selected, its `incident_id` is passed as an optional hint to bias the answer toward that context — a convenience, never a precondition. |
| Map / yard panel | Live Console, center or left column | Geographic, incident-driven view — shows the selected incident's affected entities on a real Strait/terminal basemap and updates as its trace progresses (revised 2026-08-28, sprint-change-proposal-2026-08-28.md). Pan/zoom optional and lockable. Still **not** the primary decision surface — the approval banner and incident detail carry the decision-relevant facts in text; the map is orientation and demo legibility, not the thing an operator acts on. Caption states the view is illustrative and not live AIS / not vessel tracking. |
| Kill switch | Live Console, persistent header/footer position | Always visible, never nested in a menu. Engaging it is a two-step action (toggle + inline confirm) since it disables all autonomous execution system-wide; disengaging is single-step. |
| Incident Archive list | Incident Archive surface | Same row shape as the feed, plus a resolution outcome tag (Auto-resolved / Approved / Rejected). Clicking opens that incident's full trace read-only — no approval actions possible on archived incidents. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Tier 1 resolved (silent) | Feed | Appears already marked resolved by the time an operator notices it — no banner, no interruption. A quiet "auto-resolved" tag is the only marker (per UJ-3: most incidents should be invisible). |
| Tier 2 resolved (auto + notify) | Feed | Same as Tier 1 but with a small notification indicator (badge, not sound) so an operator can see it happened without it demanding action. |
| Tier 3 awaiting approval | Feed + Incident detail | Row sorts to top of feed with `accent-900` status dot; approval banner pinned in incident detail. Persists until approved/rejected/modified — never times out to a default. |
| Tool timeout / degraded confidence | Incident detail | Recommendation still shown, but confidence score drops and a plain-language reason renders inline ("Crane #7 telemetry timed out — using last known state"). Never hidden or silently recalculated without explanation (FR5/FR6). |
| DG re-plan | Incident detail | If a recommended option is rejected by the DG/IMDG gate, the console shows the rejected option struck through with a one-line reason, followed by the re-planned recommendation — the operator sees *that* a re-plan happened, not just the final answer, so trust in the system stays intact. |
| Kill switch engaged | Global | A persistent, unmissable banner across the top of the Live Console: "Autonomous execution disabled." A Tier 1/2 incident that would have auto-executed is instead marked `blocked_by_kill_switch` (AD-15) — its feed row shows a "Needs manual action — kill switch engaged" tag (tier itself is not changed to 3). The operator resolves it via the same Approve action as a Tier 3 card, which re-checks the kill switch and executes if now clear; re-enabling the switch does not auto-resume anything on its own. |
| API unreachable / stale poll | Global | Small persistent indicator ("Last updated Xs ago") rather than a blocking error screen — operators should never lose sight of the last known state because of a transient connectivity blip. |
| Empty archive | Incident Archive | Plain statement: "No resolved incidents yet this session." No illustration needed — this is a utility tool. |
| Concurrent incidents | Feed | Multiple incidents render as independent feed rows and can be selected independently; selecting one for detail never blocks or hides the others (proves FR16's stateless-per-incident handling in the UI, not just the backend). |

## Interaction Primitives

Primarily **mouse-driven** — this is a desktop console for occasional, deliberate action (approve/reject/select/ask), not a keyboard-first power-user tool like a code editor.

- Click a feed row to select it into the detail column.
- Click Approve / Reject / Modify on the approval banner — no keyboard shortcuts required for these given low action frequency, but they must be reachable via `Tab` + `Enter` for accessibility.
- Click a suggestion chip or type + `Enter` to submit an Ask Portwatch question.
- Kill switch: click to toggle, click again on the inline confirm.

**Banned:** anything that requires memorizing a shortcut to operate safely (this console cannot assume power-user familiarity given the stated audience), auto-executing or auto-dismissing the Tier 3 approval banner, sound-based alerting.

## Accessibility Floor

Behavioral; visual contrast lives in `DESIGN.md`.

- Type sizes and weights follow `DESIGN.md.Typography` exactly (no separate accessibility-driven size floor) — legibility for the stated audience is delivered through behavioral restraint (calm alerting, low-noise feed, grounded chat answers) rather than through altering the canvas's established type scale.
- All interactive elements reachable and operable via `Tab` / `Enter` / `Space`, not just click — approval actions especially must never be mouse-only.
- Trace log and Ask Portwatch answer regions use `aria-live="polite"`; the approval banner, being action-required, uses `aria-live="assertive"` on first appearance only (not on every re-render).
- Severity is never conveyed by color alone — every accent-900 marker pairs with a text label or icon (per `DESIGN.md`'s no-traffic-light rule, which is also an accessibility requirement here, not just a style choice).
- Focus rings visible at AA contrast against `DESIGN.md.colors.surface` on every interactive element.

## Key Flows

### Flow 1 — Escalation and approval (Priya, Ops Duty Manager, mid-shift)

1. Priya is watching the Live Console when a new row appears at the top of the feed with an `accent-900` status dot: "MSC Anna — ETA +90min, Crane #4 fault."
2. She clicks it. The incident detail column loads: Portwatch already correlated the two signals into one incident, queried the Berth/Crane/Yard agents, and hit a Crane #7 telemetry timeout mid-analysis — confidence shows 67% with a plain-language note explaining the drop from 91%.
3. She sees Option B struck through with "Rejected — DG/IMDG segregation conflict," followed by the re-planned recommendation Portwatch settled on instead.
4. The approval banner is pinned at the top: situation, recommendation, predicted impact, confidence, alternatives, Approve/Reject/Modify.
5. **Climax:** Priya reads it in under a minute — the banner has everything she needs without forcing her to dig into the trace log — and clicks Approve. The banner clears, the trace log fills in with EXECUTE and VERIFY entries across four systems as they complete, and the feed row updates to "Approved — resolved" without her navigating anywhere.

Failure: if one of the four execute steps fails verification, its trace row shows the failure plainly (not silently retried as success) and the incident stays open in the feed until Priya or the system addresses it.

### Flow 2 — Status query (Farah, terminal planner, mid-shift, not handling the incident)

1. Farah isn't the one working MSC Anna's incident, but she needs to know its status for her own planning. She opens the Live Console and, without selecting or navigating to anything, types straight into Ask Portwatch: "What's the status of MSC Anna?"
2. **Climax:** The answer renders immediately, grounded in the incident's actual live state — berth, cause, recovery plan, yard %, predicted departure, SLA risk, approval status — not a generic response. She gets exactly what she needs without interrupting Priya, selecting a row, or hunting through the trace log herself.

Failure: if Farah's question doesn't resolve to any known incident (e.g. a vessel name Portwatch has no record of), the panel says so plainly rather than fabricating an answer.

### Flow 3 — Silent auto-resolution (Arif, yard supervisor, not watching Portwatch at all)

1. A minor gate-queue congestion blip occurs — reversible, no SLA exposure, no safety flag. Portwatch evaluates it as Tier 1 and auto-executes a schedule refresh and appointment adjustment.
2. Arif never sees an approval prompt. The next time he glances at the Live Console, the incident already sits in the feed marked "auto-resolved," with a full trace available if he clicks in.
3. **Climax:** nothing demands his attention — which is the point. The console's restraint here is what makes Priya's Tier 3 banner in Flow 1 mean something: if everything were flagged, nothing would be trusted as urgent.

Failure: none applicable — Tier 1 auto-execution has no failure-facing UI by design; if the underlying action fails, the policy engine's own safeguards (outside this spine's scope) prevent silent-success misreporting, and the trace would show it as a failed execute step, upgrading the incident's visibility in the feed.
