---
title: Portwatch Tuas Experience
type: experience
status: final
updated: 2026-08-29
owner: product-ux
foundation:
  formFactor: "desktop-first command surface with responsive collapse for narrower laptop widths"
  uiSystem: "shadcn/ui + custom operations patterns"
  designReference: "DESIGN.md"
---

# Foundation

Portwatch-Tuas is a live port operations control surface for berth, yard, and vessel coordination. The experience is built for a duty manager or terminal operations lead who needs to understand disruption context quickly, compare response options, and decide when automation should act versus when a human should approve.

The product is desktop-first, but it should gracefully collapse for narrower laptop or tablet widths without losing the command hierarchy. The core pattern remains a persistent left rail, a dominant operational workspace, and a focused decision/event panel. The foundation inherits the visual identity established in DESIGN.md; this document describes the behavioral system, not the visual style.

The product should make confidence, policy, and execution visible at the same time. That is the core operational promise.

## Information Architecture

The information architecture is organized around a single operating rhythm: detect, interpret, decide, act, confirm.

1. Command rail and portfolio views
   - Dashboard / Home
   - Active incidents
   - Audit trail
   - Settings (only where operations-critical; otherwise hidden from the main flow)

2. Primary operations workspace
   - Fleet and vessel overview
   - Port maps for berths, yards, and route context
   - Live event log and state progression
   - Human-in-the-loop action surface

3. Decision support layer
   - Disruption classification
   - Recommended staffing or recovery option
   - Tier-based approval logic
   - Impact summary and fallback state

4. Accountability layer
   - Approval history
   - Event chronology
   - Execution trail and final outcome

The information architecture closes when every user need maps to a surface and every surface is linked to a decision journey. This is especially important for vessel recovery, yard balancing, and weather-driven disruptions.

## Voice and Tone

Voice and tone are deliberately sober, practical, and candid. The product should speak like an experienced operations lead, not a product marketing dashboard.

- Headlines are concise and directional: “Keep the handoff moving.”
- Status language is plain and honest: “watch”, “degraded”, “manual approval required”, “safe fallback engaged”
- Calls to action read as operational commands: “Approve”, “Reject”, “Reinforce lane”, “Run drill”
- Microcopy should always explain the source of uncertainty or risk, not hide it

The service should make confidence visible without overselling certainty. In ambiguous states, the product should prefer precise language like “projected”, “watch threshold”, or “pending validation.”

## Component Patterns

### Command rail
The rail stays visible and persistent. It supports fast switching between the dashboard, active incidents, and audit views without taking focus away from the operational content.

### Live status strip
Status elements should be compact, clear, and immediately comprehensible. They help explain whether the system is normal, degraded, or requiring attention.

### Vessel and fleet cards
Each vessel card describes route, status, berth timing, and operational risk. Users should be able to inspect the vessel context without leaving the main workspace. Selected cards should update related map and log states.

### Human-in-the-loop action card
This is the centerpiece of the product. It should include:

- plain-English summary of the disruption
- clear recommendation or action set
- tier classification
- operator actions for approve / reject / escalate
- visible policy boundary between automation and human decision

### Audit trail
This is not a generic event list. It should read chronologically with enough context to explain what happened, why, and who acted. Each entry should preserve an operational narrative.

## State Patterns

The product will spend most of its time in a small number of highly legible states:

- Normal / live: stable operational conditions; no immediate action required
- Watch / degraded: risk or confidence loss; action may be recommended but not yet required
- Decision required: policy threshold reached; user must choose or confirm
- Executing: action is in progress and consequences are being visible in the system
- Resolved: issue cleared and audit trail preserved
- Locked down / safety-stop: safety threshold breached; human or automation must suspend a dangerous path

State transitions should be explicit and visible. The system should show both the current status and the operational reason for it, rather than relying on color alone.

## Interaction Primitives

The experience is built around a small set of procedural interactions:

- Select a vessel or berth to focus the map and timeline
- Toggle between fleet views or disruption types
- Inspect a recommendation before approving or rejecting it
- Compare option paths through a compact decision card
- Accept a system-generated action with clear accountability
- Trace actions through the audit timeline after resolution

Every interaction should reveal one more layer of decision context instead of hiding it. Hover and focus states should expose supplementary details, but the core narrative should remain visible without interaction.

## Accessibility Floor

The product must work for operators under time pressure, in dim lighting, and with a high cognitive load.

- Maintain high contrast between text and background, with the palette from {colors.textPrimary} and {colors.background.ink} as the default readable combination
- Use not just color but labels, shapes, and labels to differentiate states
- Keep status text explicit and not dependent on color alone
- Ensure focus rings are visible for keyboard users
- Preserve a clear motion reduction path for users with reduced motion preferences
- Avoid dense, hidden tables when the user needs to resolve a live incident quickly

The accessibility requirement is not supplemental; it is operationally necessary.

## Key Flows

### 1. Mary monitors the vessel handoff on a live dashboard
Mary is the duty manager on the evening shift, watching the harbor from a wide command station. She sees a vessel approaching a berth while multiple shoreline dependencies converge. The system highlights a small risk window, recommends a berth smoothing response, and lets Mary inspect the proposed action before approving it.

Flow:
1. Mary opens the dashboard and sees the active incident queue.
2. She selects the affected vessel and reviews the route and berth interlock.
3. The system presents the guiding recommendation and its confidence signal.
4. Mary approves or rejects the action with a clear explanation preserved in the audit trail.
5. The dashboard updates the affected map and log while the operational state remains visible.

Climax beat: Mary approves the recovery path and the system logs both the decision and the resulting state change.

### 2. Noor responds to a weather-driven safety threshold
Noor is the weather watch lead monitoring a developing squall near the western berths. A projected wind threshold exceeds the safe operating band, and the system recommends staged action across berths, AGV lanes, and workload balancing.

Flow:
1. Noor sees the safety threshold breach in the weather monitor.
2. The system highlights impacted berths and route lanes.
3. Noor inspects the maintenance of safety boundaries and the recommended sequence.
4. The system enforces a policy-aware, tiered response path and logs each action.
5. Noor confirms the clear-all conditions once it is safe to resume.

Climax beat: the system shifts into a controlled safety state and then returns to normal monitoring only after the clear condition is validated.

### 3. Ajan balances yard pressure during a crane fault
Ajan is the yard coordinator balancing export stack pressure after a crane fault introduces a short gap in planned flow. He needs to know which blocks have capacity and which support staff should move to keep the handoff moving.

Flow:
1. Ajan opens the active incident surface and sees the affected area.
2. The system suggests a limited workforce reallocation and projected impact.
3. Ajan compares options and approves the lowest-risk route.
4. The system updates the yard plan and notifies the relevant teams.
5. The timeline records the action and resulting load redistribution.

Climax beat: the yard pressure is absorbed without destabilizing the downstream berth sequence.

## Inspiration & Anti-patterns

### Inspiration
- Operational observability dashboards that make confidence visible
- Maritime bridge instrumentation and signal-labeled displays
- Safe decision surfaces that show both automation and human approval boundaries
- Low-noise status hierarchies that keep the user oriented in high-stakes contexts

### Anti-patterns
- Over-designed marketing dashboards with decorative chrome
- Hidden rationale behind automation or policy decisions
- Approval surfaces that rely on vague language or emotional urgency
- “One-click everything” patterns that obscure sequencing or accountability

## Responsive & Platform

The experience is primarily optimized for a large desktop or wide laptop display, where operators need to scan multiple layers at once: fleet, map, incident context, and action trail.

For narrower displays, the experience should preserve key priorities:
- keep the command rail accessible
- collapse secondary surfaces into drawers or stacked sections
- preserve the active incident and decision card as the dominant focus
- maintain the same state semantics, labels, and audit flow

The interface should support a calm operational rhythm across all surfaces. It should not degrade into an information-dense but unreadable stack.

# Portwatch-Tuas is designed to help operators understand the disruption, choose the right response, and retain accountability without losing speed.
