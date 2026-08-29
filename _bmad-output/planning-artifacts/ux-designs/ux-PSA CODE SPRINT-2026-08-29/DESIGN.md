---
name: Portwatch — Harbor Signal
description: Internal desktop command console for Tuas Port multi-agent disruption orchestration. Dark, low-glare maritime instrument panel that makes the whole agent orchestra — specialists, arbiter, confidence, policy tier, DG gate, execution — visible on one surface. Visual identity follows frontend/portwatch-tuas/src exactly.
status: final
updated: 2026-08-29
owner: product-ux
supersedes: "../ux-PSA CODE SPRINT-2026-08-26/DESIGN.md (Portwatch Console blueprint — retired 2026-08-29)"
sources:
  - "{planning_artifacts}/prds/prd-PSA-CODE-SPRINT-2026-08-24/prd.md"
  - "{planning_artifacts}/architecture/architecture-PSA CODE SPRINT-2026-08-24/"
  - "{planning_artifacts}/epics.md"
  - "imports/portwatch-tuas-src/ (DESIGN.md, EXPERIENCE.md, ideas.md, Home.tsx, PortwatchPrimitives.tsx, index.css)"
colors:
  background:
    ink: "#07141B"       # app ground — near-black marine blue, not flat black
    panel: "#0D1C26"      # secondary panel surface
    elevated: "#122833"   # elevated panel / hovered surface
    subtle: "#183243"     # inset wells, tracks, disabled fills
  border: "#214459"       # panel borders and dividers
  textPrimary: "#EAF7F9"
  textSecondary: "#A4B8C0"
  paper: "#E6F1F3"        # rare high-contrast emphasis only, never a surface
  signalSeafoam: "#66E0D2"  # healthy flow, live telemetry, active route, PASS, agent-complete
  signalAmber: "#F7B267"    # degraded confidence, watch, uncertain estimate, retry/fallback
  signalRed: "#E8695A"      # hard failure, threshold breach, safety stop, kill switch engaged
  # Rendered-CSS variants in portwatch-tuas (slightly desaturated against ink) — acceptable equivalents:
  #   seafoam text #79D8C7 · amber text #EDB15C · red text #F2746D · slate text #86A8AA
typography:
  display:
    family: "Space Grotesk"
    weight: 600
    scale: "28-44px"      # view titles: clamp(28px, 3.1vw, 44px), letter-spacing -0.045em
  body:
    family: "Space Grotesk"
    weight: 400
    scale: "11-15px"
  mono:
    family: "IBM Plex Mono"
    weight: 400
    scale: "8-12px"       # timestamps, route/incident IDs, confidence numerals, status tokens, stage labels
  eyebrow:
    family: "IBM Plex Mono"
    weight: 600
    size: "10px"
    letterSpacing: "0.17em"
    textTransform: "uppercase"
  metricValue:
    family: "IBM Plex Mono"
    weight: 600
    size: "27px"
    letterSpacing: "-0.08em"
rounded:
  sm: 4          # pills, tags, small controls, inputs
  md: 8          # standard panels and cards (the default)
  lg: 16         # large composed panels
  xl: 22         # selection / emphasis blocks
spacing:
  xs: 4
  sm: 8
  md: 12
  lg: 16
  xl: 20
  xxl: 24
  panelPadding: "17-18px"
components:
  rail:
    widthExpanded: 214
    widthCollapsed: 74
    activeMarker: "2px seafoam bar, left edge, soft glow"
  topbar:
    height: 72
  panel:
    radius: 8
    border: "1px solid {colors.border}"
    cornerBracket: "1px seafoam L-bracket, top-left, 18px"
    cornerMark: "1px seafoam corner, bottom-right, 9px (active/high-signal panels only)"
  statusPill:
    shape: "uppercase mono token + leading status dot, radius {rounded.sm}"
  metricCard:
    content: "mono uppercase label · large mono value · optional delta + note foot"
  agentChip:
    content: "agent name · run state (queued/running/complete/timeout/fallback) · confidence contribution"
  stageRail:
    content: "ordered pipeline stages in SCREAMING_SNAKE, each with state + timestamp; current stage emphasised"
  decisionCard:
    content: "plain-English situation · recommendation · predicted impact · confidence · 2-3 alternatives · tier tag · Approve / Reject / Modify"
  dgGate:
    content: "explicit labeled boundary block — PASS (seafoam) or VIOLATION → RE-PLAN (red), independent of tier"
  killSwitch:
    content: "persistent guarded control in topbar; engaged state paints a full-width red banner"
  traceLog:
    content: "aria-live polite; timestamp · STAGE · description rows in mono, newest appended"
---

# Brand & Style

Portwatch is the multi-agent disruption-orchestration layer for PSA's Tuas Port — it detects cross-system incidents, correlates them, runs specialist agents in parallel, scores confidence deterministically, lets a policy engine decide what is safe to auto-execute, and puts the rest in front of a human. This console is the operator's window onto that machine. The visual identity follows `frontend/portwatch-tuas/src` exactly — the "**Harbor Signal**" direction — and fully replaces the earlier "Portwatch Console" blueprint spine (retired 2026-08-29).

Harbor Signal is a calm, serious operational command surface grounded in maritime bridge instrumentation, Swiss information design, and modern observability dashboards. It reads like a disciplined instrument used for live decisions, not a consumer product and not a sci-fi HUD. The feeling is **vigilant, grounded, candid**: confidence without drama.

The core discipline is **instrument, not decoration** — every accent, divider, corner mark, and animation must reveal state, sequence, confidence, or consequence. Signals are restrained and earned: most incidents resolve silently (Tier 1/2) and never raise a signal at all, which is what gives a Tier 3 escalation its weight. The interface must never make an operator hunt for the one thing that needs them.

Because this is an *orchestration* console, one brand obligation is specific to Portwatch: **the whole orchestra stays visible**. The specialist agents, the arbiter, the confidence math, the policy tier, the DG hard gate, and the cross-system execution are all first-class on the surface at the same time — the operator should never have to trust a black box or navigate away to see how a recommendation was reached.

# Colors

The palette is deep marine neutrals with small, high-meaning accents. The base is near-black blue ink (`{colors.background.ink}`), not flat black — it gives the low-light depth of a control room.

- App ground: `{colors.background.ink}`
- Panel surface: `{colors.background.panel}` · elevated / hover: `{colors.background.elevated}` · inset wells & tracks: `{colors.background.subtle}`
- Borders and dividers: `{colors.border}`
- Primary text: `{colors.textPrimary}` · secondary text: `{colors.textSecondary}`
- Paper `{colors.paper}`: reserved for rare intentional high-contrast emphasis — never a surface, never a default.

Signal colors carry meaning and nothing else:

| Token | Value | Means |
|---|---|---|
| Seafoam | `{colors.signalSeafoam}` | healthy flow, live telemetry, active route path, PASS states, an agent that finished cleanly, DG gate cleared |
| Amber | `{colors.signalAmber}` | degraded confidence, watch status, uncertain / projected estimates, a tool retry or fallback-to-cached-state |
| Red | `{colors.signalRed}` | hard failure, safety-threshold breach, safety stop, DG violation forcing a re-plan, kill switch engaged |

Seafoam is the signature brand color. Use it only for pass / live / active. Use amber for degraded and uncertain. Reserve red for failures, breaches, and safety stops. Severity is never conveyed by color alone — every state also carries a text label and, where possible, a shape or position cue (see `EXPERIENCE.md` Accessibility Floor).

There is **no purple, no gradient wash, no glow-as-decoration**. The faint fixed harbor grid behind major workspaces (seafoam at ~5% opacity, 40px, masked to fade downward) and the ~2.5% film-grain overlay are the only atmospheric treatments — they must never reduce data legibility.

# Typography

Two families, each with one job.

- **Space Grotesk** — display and headline UI (600), body copy and labels (400). Compact and technical without being futuristic. View titles run large and tight: `clamp(28px, 3.1vw, 44px)`, letter-spacing `-0.045em`, weight 600.
- **IBM Plex Mono** — every value that must be read precisely or scanned in a column: timestamps, route and incident IDs, confidence numerals, status tokens, stage labels, KPI values, trace rows. Use tabular figures. Eyebrows / overlines are mono 600, 10px, `0.17em` tracking, uppercase, in seafoam.

Typographic rhythm is dense: short headings, compact labels, mono numerals. Confidence and KPI values are the loudest numbers on the surface (`{typography.metricValue}` — mono 600, ~27px, `-0.08em`).

# Layout & Spacing

Desktop-first command topology: a fixed left rail, a wide operational workspace, and a narrow decision/event side band. Flow is left-to-right, mirroring a port handoff and the agent pipeline itself.

- **Left command rail**: `{components.rail.widthExpanded}` expanded / `{components.rail.widthCollapsed}` collapsed (icon-only). Persistent. Active item marked by a 2px seafoam bar on the left edge with a soft glow.
- **Top bar**: `{components.topbar.height}` — brand lockup, breadcrumb, live clock, live chip, and the guarded kill switch.
- **Spacing scale**: 4 / 8 / 12 / 16 / 20 / 24. Panel internal padding 17–18px. Tight but not cramped.
- **Live Console body**: a first-row three-column grid — roughly **24% incident/agent detail · 52% map · 24% event log** — with full-width rows beneath for the decision card and stage rail. Columns stretch to equal height; the grid stacks responsively without layout shift.
- Critical tooling stays in view; the page never becomes an undifferentiated dense grid. The rail is always present, the operational content owns the canvas, and decision/event context stays a narrow but obvious band.

# Elevation & Depth

Depth comes from contrast and thin borders, not shadows or glow.

- Base panels sit on the ink ground with a 1px `{colors.border}` edge and a large soft ambient shadow (`0 14px 40px rgba(0,0,0,.12)`) plus a 1px inner top highlight.
- **Accent panels** (the one that needs attention right now) gain a seafoam-tinted border and a slightly stronger shadow — never a fill change, never a glow.
- **Interactive panels** shift their border to amber on hover and show a focus ring.
- Every panel carries a 1px seafoam **L-bracket at the top-left** (18px). Active / high-signal panels additionally carry a 1px seafoam **corner mark at the bottom-right** (9px) — the bridge-instrument motif. These are structural, not decorative: their presence means "this panel is live."

# Shapes

Rounded corners are subtle and practical — softer than a blueprint, far from a consumer app.

- Pills, tags, inputs, small controls: `{rounded.sm}` (4px)
- Standard panels and cards: `{rounded.md}` (8px) — the default
- Large composed panels: `{rounded.lg}` (16px)
- Selection / emphasis blocks: `{rounded.xl}` (22px)

Shapes stay consistent across cards, tags, buttons, map context blocks, and the stage rail. No icon library beyond `lucide-react` line icons at ~1.7 stroke; map primitives and the confidence dial are inline SVG.

# Components

Every component uses the same signal vocabulary and the same restraint. Behavioral rules live in `EXPERIENCE.md`; visual specs here.

- **Command rail** (`{components.rail}`) — persistent icon + label nav. Collapses to icon-only. Nav: Dashboard (Live Console), Active Incidents, Audit Trail. No settings/login.
- **Top bar** (`{components.topbar}`) — brand lockup (harbor-beacon mark + `PORTWATCH` / `TUAS` wordmark), breadcrumb, mono live clock, `LIVE` chip, kill switch.
- **Status pill** (`{components.statusPill}`) — leading status dot + short uppercase mono token; one consistent color semantic. Dot breathes slowly only when live; error states pulse once on entry then settle.
- **Metric / KPI card** (`{components.metricCard}`) — mono uppercase label, large mono value, optional delta + note foot. Used for yard utilization, vessels tracked, equipment health, operator queue, and live confidence.
- **Agent chip / agent roster** (`{components.agentChip}`) — one chip per specialist agent (Berth/Vessel, Crane, Yard; + AGV/Gate, Weather when built). Shows agent name, run state (`QUEUED` → `RUNNING` → `COMPLETE` / `TIMEOUT` → `FALLBACK`), and that agent's structured recommendation + constraints on expand. Parallel agents render side-by-side to make the fan-out legible.
- **Stage rail** (`{components.stageRail}`) — the pipeline as an ordered list of stages in SCREAMING_SNAKE (`INGEST · CORRELATE · AGENT_CALL · SYNTHESIZE · CONFIDENCE · POLICY_DECISION · DG_CHECK · APPROVAL · EXECUTE · VERIFY`), each with a state and timestamp; the current stage is emphasised. Restyled from the portwatch-tuas scenario-step rail into Harbor Signal.
- **Confidence readout** — large mono numeral that animates (~950ms ease-out) when the score changes; paired with a compact breakdown of what reduced it (staleness / missing-data / disagreement / variance, per PRD FR6). Amber below the tier threshold.
- **Decision card** (`{components.decisionCard}`) — the centerpiece. Plain-English situation, recommendation, predicted impact (delay / cost / yard / risk), confidence, 2–3 ranked alternatives, a tier tag, and Approve / Reject / Modify controls. The policy boundary between "recommended" and "committed" is always visible.
- **DG hard-gate block** (`{components.dgGate}`) — an explicit labeled boundary: `DG_CHECK — PASS` (seafoam) or `DG_CHECK — VIOLATION · RE-PLANNING` (red). Rendered independently of tier, because it can reject a tier-approved plan.
- **Kill switch** (`{components.killSwitch}`) — guarded control in the top bar; engaged state paints a persistent full-width red banner and every execution affordance goes disabled.
- **Execution trace log** (`{components.traceLog}`) — `aria-live="polite"`; mono `timestamp · STAGE · description` rows, newest appended; per-action verify results shown as PASS/FAIL, never collapsed to a summary.
- **Map / port canvas** — geographic berth/yard/route context for Tuas (B1–B5 and beyond) with the active route traced in seafoam and the selected vessel emphasised. Layer toggles: Berths / Yards / Routes. Illustrative visualisation of polled mock incident state (PRD §6a) — not an AIS/VTS feed; label it as such.
- **Ask Portwatch panel** — natural-language query box that answers from grounded live incident state; selecting an incident biases but does not gate the answer.
- **Empty / monitoring state** — calm "no active incidents — live feeds nominal" state with the ambient heartbeat log still ticking.

# Do's and Don'ts

## Do

- Keep the interface calm, grounded, and readable under load and in dim light.
- Keep the whole orchestra visible — agents, arbiter, confidence, tier, DG gate, execution on one surface.
- Use signal colors to clarify state, never to decorate.
- Preserve a visible policy boundary between what the system recommends and what a human commits.
- Make the reason for an escalation (degraded confidence, SLA risk, DG involvement, safety) visible *before* asking for approval.
- Show tool failure honestly: retry, fallback-to-cached, reduced confidence — with the reason logged.
- Use plain, direct, operationally honest microcopy; name uncertainty as "projected" / "watch threshold" / "pending validation".

## Don't

- No purple, no loud gradients, no sci-fi glow, no decorative motion that costs legibility.
- Don't convey severity by color alone — always pair with a label and, where possible, shape or position.
- Don't hide the policy boundary or the confidence breakdown behind a single number.
- Don't let warning states dominate the surface when nothing is wrong — silence is the default.
- Don't add marketing language, exclamation stacking, or emoji escalation to operational tooling.
- Don't import portwatch-tuas features the PRD doesn't carry (workforce/staffing reallocation card, fleet tabs, live external radar fetch) — Harbor Signal is the *look*, the PRD is the *scope*.

# Portwatch — Harbor Signal is disciplined by design: signal, not spectacle, and the orchestra always in view.
