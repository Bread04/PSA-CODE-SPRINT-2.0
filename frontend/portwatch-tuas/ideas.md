# Portwatch-Tuas Design Direction

## Three Directions

### Theme Name: Harbor Signal
Very dark maritime mission-control surfaces with sea-glass telemetry accents, warm warning orange, and a calm industrial rhythm. The feeling is precise, watchful, and capable under pressure.

**Probability:** 0.07

### Theme Name: Monsoon Ledger
A paper-meets-console operations language: foggy blue-grey panels, utilitarian serif headlines, red-pencil alert marks, and visual references to shipping manifests and port diagrams. The feeling is considered, human, and operationally literate.

**Probability:** 0.03

### Theme Name: Meridian Relay
A high-contrast night navigation system with luminous route traces, sparse cartographic geometry, and soft spectral cyan. The feeling is alert, futuristic, and networked without becoming theatrical.

**Probability:** 0.09

## Chosen Approach: Harbor Signal

### Design Movement
Neo-industrial wayfinding, borrowing from maritime bridge instrumentation, Swiss information design, and modern observability dashboards. It should feel like a serious prototype used by a port operations team, not a sci-fi game HUD.

### Core Principles
1. **Instrument, not decoration:** every accent, divider, and animation should help reveal state, sequence, confidence, or consequence.
2. **Quiet hierarchy:** use restrained surfaces and a small set of high-signal colors so critical moments feel earned.
3. **Operational asymmetry:** favor a persistent left rail, wide primary workspace, and narrow decision feed over centered SaaS cards.
4. **Human-readable automation:** show what is being proposed, what policy allows, and when a person must approve.

### Color Philosophy
The base is near-black blue ink rather than flat black, giving the interface the low-light depth of a control room. A pale sea-glass cyan is reserved for healthy telemetry and active routes; oxidized amber marks degraded confidence and caution; signal red is used only for failed hardware or safety threshold breaches. A muted paper-white keeps dense data legible without making the dashboard feel clinical. The emotional intent is calm competence: urgency appears as a signal, not as a permanent mood.

### Layout Paradigm
A fixed command rail anchors the left edge. The main canvas uses an asymmetric split: a broad operational map or simulator workspace on the left, and a narrow event/decision ledger on the right. Reference views break into horizontal bands with offset headers and edge labels rather than evenly centered tile grids. Important flows travel left-to-right like a port handoff.

### Signature Elements
- **Harbor grid:** a faint technical grid with coordinate ticks and one thin cyan route line behind major workspaces.
- **Signal corner marks:** small L-shaped brackets on key panels and active map regions, echoing bridge instrumentation.
- **Stamped state labels:** compact uppercase labels such as `LIVE`, `DEGRADED`, `TIER 3`, and `RESOLVED` with monospaced numerals.

### Interaction Philosophy
Interactions should feel like operating a trusted instrument. Hover states expose a little more context; buttons respond with a firm press and a short signal sweep; state changes propagate visibly through the map, KPI strip, and log. The app should never hide the reason for an escalation. For demo scenarios, each step is replayable and the reset action is always nearby.

### Animation
Use 180–260ms ease-out transitions for panels, nav states, and hover affordances. Reserve slower motion for scenario playback: a 1.6s confidence count, 2–4s scripted log cadence, and subtle looping radar movement. Status dots breathe slowly only when live; errors pulse once on entry, then settle. Keep animations transform/opacity-first and gate decorative motion behind `prefers-reduced-motion`.

### Typography System
Use **Space Grotesk** for UI labels, section titles, and headlines: compact, technical, and distinctive without feeling futuristic. Use **IBM Plex Mono** for timestamps, confidence values, route IDs, and event log text. Use a 12px uppercase overline for context, 14–16px dense body copy, 28–36px section titles, and 48–72px KPI numerals with tabular figures.

### Brand Essence
Portwatch-Tuas is a visual command layer for port teams who need to coordinate disruptions without losing the human decision boundary; it is different because it makes confidence, policy, and execution visible in one operational surface.

**Personality:** vigilant, grounded, candid.

### Brand Voice
Headlines are concise and directional. CTAs sound like deliberate operating commands, never marketing slogans. Microcopy names uncertainty plainly and avoids overclaiming.

Example lines:
- **Headline:** “Keep the handoff moving.”
- **CTA:** “Run a disruption drill”

### Wordmark & Logo
The mark is a compact harbor beacon: three vertical signal bars rising from a single berth line, with the tallest bar offset like a crane boom. It is a bold graphic symbol without text, designed to work as both a header emblem and favicon. The wordmark pairs a custom-spaced `PORTWATCH` with a smaller `TUAS` block tucked beneath the final two letters.

### Signature Brand Color
**Signal Seafoam — `#66E0D2`**. It is a pale green-blue that reads as healthy telemetry against ink, feels native to the maritime setting, and remains distinct from standard SaaS cyan.

## Style Decisions

- The interface is intentionally dark and low-glare, but not cyberpunk: no purple gradients, no excessive glow, and no decorative sci-fi effects.
- Use generated custom art only for the subtle maritime radar/map atmosphere; keep operational surfaces crisp and data-first.
- Every static/reference view should retain the same signal vocabulary as the interactive simulator so the whole pitch reads as one product.

## Style Decisions

- The primary page chrome must always include the compact harbor beacon mark plus the custom `PORTWATCH` / `TUAS` wordmark, treated as product identity rather than small breadcrumb text.
- The first screen should read as an active command state, not a marketing hero: headline, live status, KPI strip, map, and decision ledger must feel like one operational instrument.
- The Harbor Signal motif set — faint harbor grid, coordinate ticks, seafoam route trace, L-shaped signal brackets, and stamped uppercase state labels — should appear across every major surface, but only where it clarifies state, sequence, or consequence.
