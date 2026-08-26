# Reconciliation — `imports/portwatch-console-design/Portwatch Console.dc.html`

Input: a Claude Design canvas export (single artboard), the team's existing Portwatch Console prototype. **User decision: this canvas IS the design to build — DESIGN.md matches it exactly, not a reinterpretation.** (Superseded an earlier draft that softened the aesthetic for a "friendlier/minimalist" direction; that draft was explicitly reverted.)

## Kept exactly (visual)

- **Barlow Condensed (600) for headings/labels/data + Barlow (400) for body**, including uppercase, 0.14em-tracked micro-labels.
- **Zero-radius square shapes** across buttons, tags, cards, inputs, plus the **crosshair corner marks** on every blueprint panel.
- **Full extracted palette**: `bg #f2f2f3`, `surface #e9e9ea`, `text #1d1f20`, accent ramp (`#5980a6` family, 100–900), `accent-2 #728fab`, neutral ramp `#f5f5f8`–`#2b2b2d`.
- **No-traffic-light severity model** — `accent-900` used for both the kill-switch alert and error markers; no red/amber/green.
- **Tight canvas spacing** (10–18px panel padding, 3.4px base spacing unit) and the exact 296px | flex | 400px 3-column layout, `min-width: 1280px`.
- **No icon library** — hand-drawn primitives and inline SVG only, exactly as built.
- **Approval card content model** (situation, recommendation, predicted impact, confidence, alternatives) — matches PRD FR8 exactly.
- **Execution trace log pattern** (`aria-live="polite"`, timestamp + stage + description rows) — stage vocabulary aligned to the architecture spine's SCREAMING_SNAKE values instead of the canvas's own labels, since that's a data-contract detail, not a visual one.
- **Kill switch, Ask Portwatch panel, map/plan panels** — kept as designed.

## Changed (behavioral only, not visual)

- **Confidence, DG gate, and chat answers**: the canvas's demo shortcuts (hardcoded confidence constants, DG rejection scripted regardless of input, keyword-matched chat) are specified in `EXPERIENCE.md` as genuinely computed/grounded per PRD FR6/FR9/FR12 — this was never a visual change and the reversal to "match exactly" doesn't affect it.
- **Trace stage vocabulary** — canvas's own labels replaced with the architecture spine's SCREAMING_SNAKE stage names for consistency with the backend contract.

## Dropped

- **The unused "Option C" recovery path** in the canvas — not carried forward as a spec commitment; alternatives in `EXPERIENCE.md` are whatever the arbiter actually returns (2–3 per FR4).
- **Login/shift-handoff and settings/tiering-configuration screens** — not in the canvas either; user explicitly scoped them out.

## Added (not in canvas, user-requested)

- **Incident Archive surface** — a second, session-scoped screen listing resolved incidents, styled identically to the Live Console (same blueprint-panel, same tokens) since it didn't exist in the single-artboard canvas but needs to inherit its visual language exactly.

## Open note

The canvas's strait-map component fetches a live external CDN topojson file at runtime — an implementation detail below this spine's altitude, flagged for whoever builds the map panel given the architecture spine's offline/localhost-demo constraints.
