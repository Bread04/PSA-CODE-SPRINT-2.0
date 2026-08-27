# Portwatch Console (frontend)

Greenfield React 19 + TypeScript + Vite operator console for Tuas Port disruption
orchestration (Epic 2). This is Story 2.1: it ships the design token system and a
minimal app shell only — no incident UI yet. Run `npm install`, then `npm run dev`
to start the dev server, `npm run build` to typecheck and produce a production
build, and `npm test` to run the token contract suite.

`src/theme/` is the canonical DESIGN.md token system: `tokens.css` declares every
color, spacing, radius, layout, and typography value as a `:root` custom property
(the only place literal hex/px values may live), and `tokens.ts` is the typed
mirror of those same values. `src/theme/tokens.test.ts` fails loudly if the two
ever disagree or drift from DESIGN.md.
