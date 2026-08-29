---
title: Portwatch Tuas
type: design
status: final
updated: 2026-08-29
owner: product-ux
colors:
  background:
    ink: "#07141B"
    panel: "#0D1C26"
    elevated: "#122833"
    subtle: "#183243"
  signalSeafoam: "#66E0D2"
  signalAmber: "#F7B267"
  signalRed: "#E8695A"
  paper: "#E6F1F3"
  border: "#214459"
  textPrimary: "#EAF7F9"
  textSecondary: "#A4B8C0"
  accent:
    cyan: "#66E0D2"
    amber: "#F7B267"
    red: "#E8695A"
typography:
  display:
    family: "Space Grotesk"
    weight: 600
    scale: "28-72px"
  body:
    family: "Space Grotesk"
    weight: 400
    scale: "14-16px"
  mono:
    family: "IBM Plex Mono"
    weight: 400
    scale: "10-12px"
rounded:
  sm: 8
  md: 12
  lg: 16
  xl: 22
spacing:
  xs: 4
  sm: 8
  md: 12
  lg: 16
  xl: 20
  xxl: 24
components:
  rail:
    width: 72
  panel:
    minHeight: 160
  cornerMark:
    thickness: 2
---

# Brand & Style

Portwatch-Tuas is a calm but serious operational command surface for port teams coordinating disruption recovery. The brand is grounded in maritime control-room language: trustworthy, low-glare, and precise under pressure. The interface should never feel theatrical or consumer-oriented; it should read like a disciplined instrument used for live operational decisions.

The visual system reinforces confidence without drama. Signals are restrained and context-based: seafoam denotes healthy flow and active routing, amber marks degraded confidence or caution, and red is reserved for hard failures or safety-critical thresholds. This makes urgency feel earned instead of constant.

The design language is intentionally dark and technical, but not cyberpunk. It embraces a quiet, evidence-first rhythm: narrow rails, wide operational surfaces, and clearly labeled state transitions.

## Colors

The palette is anchored in deep marine neutrals and small, high-meaning accents.

- Background ink: {colors.background.ink}
- Secondary panel: {colors.background.panel}
- Elevated surfaces: {colors.background.elevated}
- Seafoam signal: {colors.signalSeafoam}
- Warning amber: {colors.signalAmber}
- Critical red: {colors.signalRed}
- Primary copy: {colors.textPrimary}
- Secondary copy: {colors.textSecondary}
- Border and dividers: {colors.border}

Use the seafoam accent only for pass states, live telemetry, and active route paths. Use amber for degraded capacity, watch status, and uncertain estimates. Reserve red for failures, threshold breaches, and safety stoppages. The paper tone is used sparingly for emphasis and intentional contrast, not as a default surface.

## Typography

The interface balances technical legibility with operational authority.

- Display and headline UI: Space Grotesk, semibold
- Body copy and labels: Space Grotesk, regular
- Timestamps, route IDs, confidence numbers, and status tokens: IBM Plex Mono

Use a tight typographic rhythm: dense labels, short headings, and tabular numerals for status and metrics. Numeric values should be clear at a glance, especially in live watch states.

## Layout & Spacing

The system is designed for a desktop-first command topology with a fixed rail and a wide operational workspace.

- Left navigation rail: 72px wide
- Core content rhythm: 8px/12px/16px spacing tokens
- Panels should be quiet and modular, with consistent 12px-20px internal padding
- Major surfaces favor a left-to-right operational flow, reflecting port scheduling and vessel handoff logic

The layout should keep critical tooling in view without turning the page into a dense grid. The command rail stays persistent; primary operational content owns the majority of the canvas; event or decision context stays as a narrow but obvious side band.

## Elevation & Depth

Depth is created through subtle contrast and panel separation rather than heavy shadows.

- Base surfaces sit in the dark ink background
- Elevated panels are slightly lighter and separated with thin borders
- Active states gain contrast via border and motion, not excessive glow
- Use depth to clarify hierarchy: a selected vessel, active incident, and approval card should all stand out without becoming decorative

The interface should feel grounded and stable, like a serious operations console rather than a neon product demo.

## Shapes

Rounded corners are subtle and practical.

- Small controls: 8px radius
- Standard cards: 12px radius
- Larger panels: 16px radius
- Selection or emphasis blocks: 22px radius

Shapes remain consistent across cards, tags, buttons, and map context blocks. They should support clarity and calm rhythm rather than visual novelty.

## Components

Key UI components should inherit the operational library and use the same signal vocabulary throughout the product.

- Command rail: persistent navigation with compact icon + label patterns
- Status pill: short uppercase token with a mono value and a consistent color semantic
- Metric card: dense KPI block with label, value, delta, and status cue
- Decision card: plain-English recommendation with tier tag, option set, and action controls
- Event log: timestamped, readable sequence with clear event-to-outcome ordering
- Map / port canvas: geographic and berth context with route trace and selected vessel emphasis
- Corner mark: small bracket shape used on active operational panels and high-signal containers

The whole product should feel like one instrument, with each component using the same semantics and the same visual restraint.

## Do's and Don'ts

### Do

- Keep the interface calm, grounded, and readable under load
- Use state colors to clarify meaning, not decorate the surface
- Preserve a confident human decision boundary around automation
- Make the reason for escalation visible before asking for approval
- Use microcopy that is plain, direct, and operationally honest

### Don't

- Do not use loud gradients, purple accents, or sci-fi glow treatments
- Do not hide the policy boundary between recommended action and human consent
- Do not let warning states dominate the entire product all the time
- Do not use decorative motion when it reduces readability
- Do not add marketing language to operational tooling

# Portwatch Tuas design direction is intentionally disciplined: signal, not spectacle.
