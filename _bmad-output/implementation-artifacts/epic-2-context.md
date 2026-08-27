# Epic 2 Context: Operator Visibility & Control

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 2 builds the greenfield operator dashboard frontend — a desktop web console where a port operator watches incidents resolve, asks about any incident's status in plain language, and acts on Tier-3 approval cards (approve, reject, or pick a different pre-computed option). It also adds a session-scoped Incident Archive screen for reviewing resolved incidents. The console consumes Epic 1's read-only Incident API and its one write path (the approval action), plus the kill-switch endpoint. It is a complete, standalone user-facing capability layered on Epic 1's data. It must be built to the finalized UX contract (DESIGN.md + EXPERIENCE.md), which reproduces the team's existing "Portwatch Console" design canvas exactly — a precise schematic "blueprint" instrument panel, not a consumer dashboard. If time runs short, the Day-4 minimum demoable slice is IncidentFeed + IncidentDetail/ApprovalBanner + ExecutionTrace; AskPortwatch, MapPanel, KillSwitchControl, and IncidentArchive are additive on top, not prerequisites.

## Stories

- Story 2.1: Design Token System
- Story 2.2: Blueprint Panel Primitive
- Story 2.3: IncidentFeed
- Story 2.4: IncidentDetail + ApprovalBanner
- Story 2.5: ExecutionTrace Viewer
- Story 2.6: AskPortwatch Natural-Language Query
- Story 2.7: MapPanel
- Story 2.8: KillSwitchControl
- Story 2.9: Incident Archive Route

## Requirements & Constraints

- Operator can approve, reject, or modify a Tier-3 recommendation; "modify" is strictly selecting one of the arbiter's existing 2-3 ranked options by `option_id` — never a free-form plan edit.
- Any user can ask an incident's status in natural language without first selecting an incident; the answer must be grounded in live incident state and honest when nothing matches — never a fabricated status.
- The full per-incident execution trace must be viewable in the dashboard, including retries, failures, fallbacks, and confidence-degradation reasons.
- The console is desktop-only, `min-width: 1280px`, no responsive breakpoints, no login/session, single fixed operator context.
- The frontend only reads incident state (via polling); the only writes are the approval action and the kill switch.
- Never introduce a new backend endpoint. Archive filters the existing incident-list response client-side to resolved incidents.
- Approval card is persistent: no auto-dismiss, no timeout-driven default action, no sound alerting.
- Accessibility floor: every interactive element (especially Approve/Reject/Modify) operable via Tab/Enter/Space, not click-only; visible focus rings at AA contrast; severity never conveyed by color alone (label text + shape + darkest accent together).
- Voice & tone: all microcopy plain, factual, non-alarmist; identical register for a Tier 1 footnote and a Tier 3 banner; no escalating exclamation or emoji as severity rises (e.g. "MSC Anna — ETA slipped 90 min", not "CRITICAL DISRUPTION").

## Technical Decisions

- Stack: React 19.2.8 / TypeScript 5.x / Vite 8.1.3. Greenfield `frontend/` app; component/behavior spec is owned by the UX contract.
- Frontend reads by polling one read-only Incident API every 2-3 seconds — no SSE/WebSocket. Feed, detail, trace, and query all poll the same endpoint.
- API surface consumed: incident-list (summaries), incident-detail (full, includes trace), `POST` approval (`action`: `approve` | `reject` | `select_alternative` with `option_id`), natural-language query (`q` text plus optional `incident_id` hint — backend still resolves from text alone when omitted), and `POST` kill-switch (`{enabled: bool}`).
- Shared data shapes are fixed by the architecture spine and stories must conform to their field names: `Incident` (`incident_id`, `status` open|resolved, `entity_refs`, `tier` 1|2|3|null, `confidence` int 0-100, `recommended_option_id`, `options`, `approval_status` n/a|pending|approved|rejected, `blocked_by_kill_switch` bool, `trace`); `RecoveryOption` (`option_id`, `description`, `predicted_impact` {delay_min, cost, yard_impact, risk}, `reversible`, `dg_involved`); `TraceEntry` (`stage`, `timestamp` ISO 8601 UTC, `detail` dict, `error` {stage, error, retried, fallback_used} | null).
- Trace `stage` vocabulary is a fixed SCREAMING_SNAKE set: INGEST, CORRELATE, AGENT_CALL, SYNTHESIZE, CONFIDENCE, POLICY_DECISION, DG_CHECK, APPROVAL, EXECUTE, VERIFY.
- Kill-switch-blocked Tier 1/2 incidents carry `blocked_by_kill_switch: true`; the tier is NOT reclassified to 3. Operator resolves them via the same Approve action as a Tier-3 card, which re-checks the flag.
- A trace entry with `detail.mock_forced: true` (a demo-safety agent override from Epic 1) must be rendered visibly annotated, never identical to a live-call row.
- Routes: `LiveConsole` (default) and `IncidentArchive` (session-scoped, client-filtered, no persistence).
- Components (names fixed by the UX contract): `IncidentFeed`, `IncidentDetail`, `ApprovalBanner`, `ExecutionTrace`, `AskPortwatch`, `MapPanel`, `KillSwitchControl`, `IncidentArchiveList`.

## UX & Interaction Patterns

- Design tokens (implement exactly): Barlow Condensed (600) for all headings, labels, numeric displays, and buttons; Barlow (400) for body/incident/trace text. Single text color; hierarchy via weight/size. One hue only — the steel-blue accent ramp (`accent-100`..`accent-900`, `#5980a6` family) plus `accent-2` (`#728fab`) to distinguish two simultaneous incidents. No red/amber/green vocabulary: darkest accent (`accent-900`) marks both the kill-switch bar and trace error rows. Zero border-radius everywhere except the 3px tag radius. 3.4px base spacing scale; panel padding 10-18px (dense control-room, not editorial). Flat — no drop shadows; grouping via 1px divider borders and crosshair corner marks.
- Blueprint panel primitive: reusable card with 1px divider border, zero radius, and four 11px crosshair registration marks offset ~6px outside each corner. Used by every incident card, the approval card, the trace log, and both map panels — no one-off styled containers.
- Layout: fixed 54px header + 3-column body (296px left feed | flex center detail | 400px right trace + chat).
- IncidentFeed: reverse-chronological rows inside blueprint panels; 7x7px accent status dot (light accent = Tier 1/2, `accent-900` = Tier 3 pending); 2px progress bar (neutral-300 track, accent-600 fill) while resolving. Tier-3-pending rows always sort above recency. Clicking a row loads it into the detail column. Concurrent incidents stay independently selectable.
- IncidentDetail + ApprovalBanner: pinned Tier-3 card, `aria-live="assertive"` on first appearance only, pulsing status dot; shows situation, recommendation, predicted impact, alternatives, and confidence with its degradation reason when applicable. Any DG-gate-rejected option shown struck through with its one-line reason, not hidden. Approve/Reject/Modify wired to the approval endpoint.
- ExecutionTrace: `role="log" aria-live="polite"`, reverse-chronological rows keyed to the stage vocabulary; timestamp | stage-badge + text grid with 1px bottom dividers; error/retry/fallback rows get an `accent-900` dot marker and bolder text.
- AskPortwatch: free-text input + primary button + ghost-style suggestion chips; answer renders in an `accent-100`-background bubble; never requires an incident to be selected first; type + Enter or click a chip to submit.
- MapPanel: read-only illustrative strait/yard view inside a blueprint panel, custom inline SVG primitives (no icon library), captioned to state positions are illustrative, not live AIS.
- KillSwitchControl: persistent header control styled as a `role="switch"` circular dot (`accent-900` when engaged), never nested in a menu; engaging is two-step (toggle + inline confirm), disengaging is one-step. When engaged, a persistent global banner ("Autonomous execution disabled") shows on every screen, plus per-incident "needs manual action — kill switch engaged" tags on affected Tier 1/2 incidents.
- IncidentArchive: session-scoped screen reusing the feed row and blueprint-panel styling, adding a resolution-outcome tag (Auto-resolved / Approved / Rejected); opening an archived incident shows its trace read-only with no approval actions; empty state is a plain one-line message.
- Additional state patterns: Tier 1 auto-resolves silently (quiet tag only); Tier 2 adds a small non-sound notification badge; degraded confidence shows an inline plain-language reason; stale/unreachable API shows a small "last updated Xs ago" indicator, never a blocking error screen.

## Cross-Story Dependencies

- Stories 2.1 and 2.2 (design tokens, blueprint panel) are foundation — no standalone user value, but every later story depends on them; they must land first.
- Stories 2.3-2.5 (IncidentFeed, IncidentDetail/ApprovalBanner, ExecutionTrace) are the Live Console core and the Day-4 minimum demoable slice.
- Stories 2.6-2.8 (AskPortwatch, MapPanel, KillSwitchControl) are secondary surfaces on the same screen, additive on top of the core slice.
- Story 2.9 (Incident Archive) reuses Stories 2.2, 2.3, and 2.5's components directly rather than duplicating them.
- UX-DR10 (state patterns), UX-DR11 (accessibility floor), and UX-DR12 (voice & tone) are cross-cutting acceptance criteria distributed across stories 2.3-2.9, not standalone stories.
- Entire epic depends on Epic 1 having delivered the Incident API, approval endpoint, kill-switch endpoint, trace data, and the `blocked_by_kill_switch` / `mock_forced` markers.
- Epic 3's concurrent-incident proof (FR16) surfaces at the UI level through Story 2.3's independent-selectability and `accent-2` two-incident distinction.
