# Reconciliation — `imports/portwatch-tuas-src/`

Input: `frontend/portwatch-tuas/` — a complete, externally generated (Manus) full-stack prototype with its own `DESIGN.md`, `EXPERIENCE.md`, `ideas.md`, a React client (`client/src/pages/Home.tsx` + `PortwatchPrimitives.tsx` + `index.css`), an Express server, and a `shared/domain.ts` model.

**User decision (2026-08-29, AskUserQuestion):** the UI/UX follows **entirely** from this source — full replacement of the 2026-08-26 "Portwatch Console" blueprint direction, not a blend. The real PRD (`prd-PSA-CODE-SPRINT-2026-08-24`) is unchanged; `portwatch-tuas/PRD.md` is **not** adopted. Backend is reconciled to the new frontend in a later pass.

## Kept exactly (visual identity → `DESIGN.md`)

- **"Harbor Signal" palette**: ink grounds `#07141B / #0D1C26 / #122833 / #183243`, border `#214459`, text `#EAF7F9 / #A4B8C0`, signal seafoam `#66E0D2` / amber `#F7B267` / red `#E8695A`. Rendered-CSS desaturated text variants (`#79D8C7 / #EDB15C / #F2746D`) noted as acceptable equivalents.
- **Typography**: Space Grotesk (display 600 + body 400) + IBM Plex Mono for all values/IDs/timestamps/status tokens. Mono eyebrows, 10px, 0.17em, uppercase, seafoam. Large tight view titles `clamp(28px,3.1vw,44px)` / `-0.045em`.
- **Rounded scale** 4 / 8 / 16 / 22 (8px = default panel).
- **Layout**: fixed left command rail (214 expanded / 74 collapsed), 72px top bar, asymmetric wide workspace + narrow decision/event band, first-row 3-column grid ≈ 24% / 52% / 24%, responsive collapse.
- **Panel treatment**: 1px border, seafoam L-bracket top-left, seafoam corner mark bottom-right on active panels, ambient soft shadow + inner top highlight, no glow.
- **Motif**: faint masked harbor grid + ~2.5% grain overlay behind workspaces; `lucide-react` line icons only; inline SVG for map + confidence dial.
- **Signal-not-decoration discipline**, no-purple / no-gradient / no-sci-fi-glow, calm persistent (no-audio) escalation.
- **Primitives** carried into Component specs: `Panel`, `SectionHeading`, `StatusPill`, `MetricCard`, `SignalTag`, `TinySparkline`, `CornerMark`, `RailButton`, `CountdownBar`, `EmptyState`.
- **Confidence tween** (~950ms ease-out), status-dot breathing only when live, error pulse-once-then-settle — all gated behind `prefers-reduced-motion`.

## Changed (behavioral / scope — not visual)

- **Feature scope re-anchored to the real PRD.** The Harbor Signal *look* is adopted wholesale; the *feature set and data contract* stay on the real PRD.
- **Stage vocabulary**: portwatch-tuas's prose scenario steps (`"Vessel ETA shift"`, `"Policy engine trace"`, …) → the architecture spine's SCREAMING_SNAKE stages (`INGEST · CORRELATE · AGENT_CALL · SYNTHESIZE · CONFIDENCE · POLICY_DECISION · DG_CHECK · APPROVAL · EXECUTE · VERIFY`), shared with the trace log and backend contract.
- **Scenario step-rail → live stage rail + agent roster.** portwatch-tuas renders the pipeline as a scripted 6-step timeline for two named marketing scenarios (`nexus`, `squall`). Re-specified as a *live, per-incident* stage rail driven by polled trace state, plus a parallel **agent roster** (`AGENT_CALL` expands to side-by-side Berth/Vessel, Crane, Yard chips with run state + structured output) — this is the "show the whole orchestra" requirement.
- **Confidence / policy / DG gate** are genuinely computed/deterministic per PRD FR6/FR7/FR9 (not the prototype's hardcoded constants). DG gate re-specified as an explicit labeled boundary that can loop the rail back to `SYNTHESIZE`.
- **Ask Portwatch**: backend resolves the entity from free text (PRD FR12 / architecture AD-2); selecting an incident is only an optional hint.
- **Kill switch**: blocked Tier 1/2 incidents get a `blocked_by_kill_switch` flag + feed tag, resolved via the normal Approve action — not a tier reclassification.

## Dropped (portwatch-tuas features not in the real PRD)

- **Frontline workforce / staffing reallocation card** (`workforceRecommendations`, headcount moves between blocks, approval-history drawer, projected yard-efficiency chart) — no FR in the real PRD; explicitly out.
- **Fleet tabs + 6 mock vessels** (`vesselData`, `fleetTabs`, vessel detail inspector) — replaced by incident-driven map/vessel emphasis. The map keeps geographic berth/yard/route context but is not a fleet browser.
- **Live `gov.sg` weather-radar fetch** (`useWeatherRadar`, external CDN call) — PRD §6a + Out-of-Scope: all signal sources are mocked; no live external calls. FR18's Weather agent (Day-5 stretch) uses a mocked radar feed.
- **The two named marketing scenarios as first-class UI** (`"Singapore Nexus Disruption"`, `"Sumatra Squall"` as pickable demo buttons) — the golden-path scenario is driven by the backend demo seed, not a UI scenario switcher. Their *incident content* maps onto PRD UJ-1 (Priya) and FR18.
- **portwatch-tuas/PRD.md** entirely — different requirement numbering, different scope; the real PRD stands.

## Added (not in portwatch-tuas, from the real PRD)

- **Agent roster** with parallel fan-out and per-agent recommendation + constraints (FR3).
- **DG hard-gate boundary block** with visible re-plan loop (FR9).
- **Confidence breakdown** (staleness / missing-data / disagreement / variance, FR6).
- **Concurrent-incident model** — independent stage rail + roster per incident (FR16).
- **MPA** as a named notification recipient in `EXECUTE` (FR13).
- **Session-scoped Audit Trail** as a chronological execution timeline (FR14/FR15), plus an **Active Incidents** filtered view.

## Open notes

- **Backend contract divergence** — see `handoff-backend-delta.md`. This spine assumes the real PRD's `/incidents` contract, restyled; the portwatch-tuas Express server and `shared/domain.ts` are not the target.
- **Contrast check** — Harbor Signal secondary-text and desaturated signal-text variants on panel surfaces need an AA verification pass (flagged `[ASSUMPTION]` in `EXPERIENCE.md` Accessibility Floor).
- The current `frontend/src` (built to the retired blueprint spine: `theme/tokens.css`, `BlueprintPanel`, greyscale, zero-radius) needs a re-skin pass to Harbor Signal — a `bmad-build` task, tracked separately.
