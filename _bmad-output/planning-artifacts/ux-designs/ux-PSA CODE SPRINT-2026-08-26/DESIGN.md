---
name: Portwatch Console
description: Internal desktop console for Tuas Port disruption orchestration — a precise, schematic "blueprint" instrument panel, matching the team's existing Portwatch Console design canvas exactly.
status: superseded
superseded_by: "../ux-PSA CODE SPRINT-2026-08-29/DESIGN.md (Portwatch — Harbor Signal, 2026-08-29). This blueprint direction was retired when the user redirected visual identity to follow frontend/portwatch-tuas/src entirely."
updated: 2026-08-26
colors:
  bg: '#f2f2f3'
  surface: '#e9e9ea'
  divider: 'color-mix(in srgb, #1d1f20 16%, transparent)'
  text: '#1d1f20'
  text-muted: '#585c60'
  accent-100: '#eef6ff'
  accent-200: '#d6ebff'
  accent-300: '#b5d9fd'
  accent-400: '#94bce3'
  accent-500: '#749dc4'
  accent-600: '#597ea3'
  accent-700: '#416180'
  accent-800: '#2c455d'
  accent-900: '#1d2d3d'
  accent-2-100: '#eef6ff'
  accent-2-900: '#1f2d3a'
  accent-2: '#728fab'
  neutral-100: '#f5f5f8'
  neutral-300: '#dfe1e4'
  neutral-500: '#9a9fa3'
  neutral-700: '#585c60'
  neutral-900: '#2b2b2d'
typography:
  heading:
    fontFamily: "Barlow Condensed"
    fontWeight: '600'
    note: used for all headers, tags, numeric displays, uppercase micro-labels, buttons
  body:
    fontFamily: Barlow
    fontWeight: '400'
    note: descriptions, incident text, trace log entries
  micro-label:
    fontFamily: "Barlow Condensed"
    fontSize: 11px
    fontWeight: '600'
    letterSpacing: 0.14em
    textTransform: uppercase
  h2-incident-title:
    fontFamily: "Barlow Condensed"
    fontSize: 29px
    fontWeight: '600'
  data-confidence:
    fontFamily: "Barlow Condensed"
    fontSize: 38px
    fontWeight: '600'
type-scale:
  caption: 12px
  body: 13px
  body-lg: 14px
  section-title: 16px
letter-spacing:
  label: 0.08em
rounded:
  sm: 0px
  DEFAULT: 0px
  md: 0px
  lg: 0px
  tag: 3px
  full: 9999px
spacing:
  '1': 3.4px
  '2': 6.8px
  '3': 10.2px
  '4': 13.6px
  '6': 20.4px
  '8': 27.2px
  header-height: 54px
  col-left: 296px
  col-right: 400px
components:
  blueprint-panel:
    border: '1px solid {colors.divider}'
    radius: '{rounded.DEFAULT}'
    cornerMarks: true
    cornerMarkSize: 11px
    cornerMarkOffset: -6px
  button-primary:
    background: '{colors.accent-700}'
    color: '#ffffff'
    radius: '{rounded.DEFAULT}'
    minHeight: 44px
  button-secondary:
    background: 'transparent'
    color: '{colors.text}'
    border: '1px solid {colors.divider}'
    radius: '{rounded.DEFAULT}'
  button-ghost:
    background: 'transparent'
    color: '{colors.accent-700}'
    border: 'none'
  tag-neutral:
    background: '{colors.neutral-100}'
    color: '{colors.text}'
    radius: '{rounded.tag}'
    padding: '3px 10px'
    fontSize: 11px
  tag-accent:
    background: '{colors.accent-100}'
    color: '{colors.accent-800}'
    radius: '{rounded.tag}'
  approval-card:
    extends: '{components.blueprint-panel}'
    ariaLive: assertive
    pulseDot: true
---

## Brand & Style

Portwatch Console is a **precision instrument panel** — the visual language of an engineering schematic or blueprint, not a consumer dashboard. Square corners, crosshair registration marks, tight tracked labels, and a single restrained accent color communicate "this is a deterministic, auditable system." That's the product's core trust argument: the policy engine sits outside LLM authority, and every decision is traceable. This is the team's existing, deliberately-chosen design — this document formalizes it exactly as built, not a reinterpretation of it.

## Colors

- **`bg` (#f2f2f3)** — the page canvas, a flat light neutral.
- **`surface` (#e9e9ea)** — secondary surface, slightly darker than `bg`, used for subordinate containers.
- **`divider`** (`#1d1f20` at 16% opacity) — every panel border and hairline separator.
- **`text` (#1d1f20)** — the single text color; weight and size carry hierarchy, not additional colors.
- **Accent ramp (`accent-100`–`accent-900`, steel blue `#5980a6` family)** — the only hue in the system. Carries brand identity, links, active state, and severity. There is **no red/amber/green vocabulary**: `accent-900` marks both the kill-switch alert bar and error markers in the trace log; lighter steps mark normal/lower-urgency elements (status dots, progress fill, tags). Severity reads through position, iconography (pulsing dot, corner marks), and label text first — color intensity second.
- **`accent-2` (#728fab)** — secondary accent, parallel ramp, for elements that need visual distinction from the primary accent without introducing a new hue family (e.g. distinguishing two simultaneous incidents).
- **Neutral ramp (`neutral-100`–`neutral-900`)** — backgrounds for tags, progress-bar tracks, and disabled states.
- **Never** add a second hue family for "success" or "danger" — this is a hard rule carried from the canvas, not a stylistic default.

## Typography

- **Barlow Condensed (600)** — every heading, tag, numeric display (confidence score, clock), and button. Uppercase micro-labels use 11px with 0.14em letter-spacing — tight and technical by design.
- **Barlow (400)** — all body copy: incident descriptions, trace log entries, chat text.
- Scale runs from 10px micro-captions up to the 38px confidence readout and 29px incident title (`h2`) as the largest elements on screen — numbers and titles dominate, chrome stays small.
- Uppercase + wide tracking on every category label is a consistent, deliberate "engineering/blueprint" typographic voice — not an oversight to soften.

## Layout & Spacing

Fixed 54px header + 3-column grid body: **296px | flex | 400px** (left incident feed, center incident detail, right execution trace + chat) — the canvas's exact proportions. Base spacing unit is 3.4px (`--space-1` through `--space-8`, ×2/×3/×4/×6/×8 multiples); panel padding runs 10–18px, deliberately tight and dense — this is a control-room density, not a breathing-room editorial layout. `min-width: 1280px` enforced; no responsive breakpoints, desktop-only.

## Elevation & Depth

Flat design — no drop shadows. Depth and grouping are communicated entirely through the `divider` border and the crosshair corner marks (see Shapes), not shadow layering.

## Shapes

**Everything is square** — `border-radius: 0` on buttons, tags (except the intentionally pill-shaped tag radius of 3px, effectively still sharp), cards, and inputs. Every `blueprint-panel` (the core card component) carries four **crosshair corner marks** — 11×11px registration-mark glyphs drawn at each corner, offset 6px outside the panel edge — reinforcing the technical-drawing aesthetic. No icon library: all iconography is hand-drawn primitives (solid-square status dots, thin crosshair marks) and custom inline SVG (ship rectangles, crane line-groups, berth/yard boxes in the map views).

## Components

- **Blueprint panel** — the universal card: 1px `divider` border, zero radius, four corner crosshair marks. Every incident card, the approval card, trace log, and map panels use this exact component.
- **Incident feed row** — left-aligned button-like row inside a blueprint panel; a 7×7px accent-colored status dot plus a 2px progress bar beneath (`neutral-300` track, `accent-600` fill) shows resolution-in-progress state.
- **Approval card** — a blueprint panel with `aria-live="assertive"`, a pulsing status dot (opacity 1↔0.25 keyframe), 2-column situation/recommendation/why + predicted-impact layout, and Approve/Reject buttons.
- **Execution trace log** — `role="log" aria-live="polite"`, scrolling list inside a blueprint panel; each entry a 2-column grid (timestamp | stage badge + text) with 1px bottom dividers; `accent-900` dot marker on error entries.
- **Map/plan panels** — blueprint-framed map views, captioned below the frame. The strait view uses a real, bundled vector basemap (Singapore Strait coastline, d3-geo) driven by mock incident state; the yard/plan view stays a hand-drawn schematic. Both carry incident-driven, token-coloured primitive markers. Zero-radius / token-colour discipline applies to all panel chrome; the only exemption is vendored basemap geometry. (Revised 2026-08-28, sprint-change-proposal-2026-08-28.md.)
- **Ask Portwatch (chat) panel** — text input + primary button + `button-ghost` suggestion chips; answer renders in an `accent-100`-background bubble.
- **Kill switch** — a `role="switch"` toggle styled as a circular dot control; `accent-900` when engaged.
- **Buttons** — `button-primary` (solid `accent-700`), `button-secondary` (outlined), `button-ghost` (text-only) — all square, 44–48px minimum height.
- **Tags** — `tag-neutral` / `tag-accent` / `tag-outline`, 3px radius, 11px Barlow Condensed text, 3px/10px padding.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Square corners everywhere, crosshair marks on every blueprint panel | Round any corner beyond the 3px tag radius |
| Barlow Condensed uppercase, tracked labels for all chrome | Switch to a plain/humanist typeface or mixed-case labels |
| One accent hue (steel blue) for identity, links, and severity | Add a second hue for "success"/"danger" |
| Convey severity via `accent-900` + position + label + pulsing dot | Rely on color alone, or introduce traffic-light red/amber/green |
| Tight, dense panel spacing (10–18px) — control-room density | Add generous editorial whitespace |
| Flat design; borders and corner marks carry all grouping | Introduce drop shadows for default depth |
