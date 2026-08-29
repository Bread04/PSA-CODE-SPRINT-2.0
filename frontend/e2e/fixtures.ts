/**
 * Single source of truth for e2e config + the backend demo-seed fixtures the
 * specs assert against. Nothing port- or seed-specific should be re-typed in a
 * spec file — import from here.
 *
 * - `API_BASE` comes from `E2E_API_BASE_URL`, which `playwright.config.ts` sets
 *   from its port constants; the literal fallback only matters when a spec is
 *   run through a runner that bypasses the config.
 * - `SEED` mirrors `backend/api/demo_seed.py`. If the seed changes, change it
 *   here once.
 */

/** Base URL of the throwaway FastAPI instance booted by playwright.config.ts. */
export const API_BASE: string =
  process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8123';

/** `useIncidents` STALE_AFTER_MS (frontend/src/hooks/useIncidents.ts). */
export const STALE_AFTER_MS = 8_000;

/** Fixtures from `backend/api/demo_seed.py::demo_incidents()`. */
export const SEED = {
  /** Total incidents `seed_demo()` inserts. */
  count: 7,

  /** Ids. */
  inProgressId: 'demo-in-progress',
  tier3AltsId: 'demo-tier3-alts',
  ksBlockedId: 'demo-ks-blocked',

  /** Row accessible-name fragments (entity refs + recommended option text). */
  row: {
    /** demo-tier3-alts, recommended opt-2. */
    tier3Alts: /Reassign MSC Anna to Berth C7/i,
    /** demo-tier3-alts, ranked alternative opt-1 (also the post-resolve label). */
    tier3AltOption: /Hold MSC Anna at anchorage for 2h/i,
    /** demo-ks-blocked, opt-1. */
    ksBlocked: /Refresh gate appointment schedule/i,
    /** demo-load-balancing — never mutated by any spec, a stable anchor. */
    loadBalancing: /Pasir Panjang P2/i,
    /** demo-auto-resolved, opt-1. */
    autoResolved: /Adjust appointment slots for block Y4/i,
    /** demo-approved, opt-1. */
    approved: /Reassign Crane #4 workload to Crane #6/i,
    /** demo-rejected, opt-1. */
    rejected: /Delay TITAN departure by 90 minutes/i,
  },

  /** A question AskPortwatch / the query endpoint can resolve to a seed incident. */
  query: 'What is happening with MSC Anna?',
} as const;

/** Matches a feed row that has reached a resolved phrase. */
export const RESOLVED_PHRASE = /(Auto-resolved|Approved)/i;

/** `<rowFragment> … <resolved phrase>` — a row that has resolved. */
export function resolvedRow(rowFragment: RegExp): RegExp {
  return new RegExp(`${rowFragment.source}.*${RESOLVED_PHRASE.source}`, 'i');
}
