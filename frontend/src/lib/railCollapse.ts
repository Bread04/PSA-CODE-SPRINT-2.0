/**
 * Command-rail collapse persistence (spec-portwatch-tuas-chrome).
 *
 * Split out of App.tsx so the shell file only exports a component (clears the
 * `react-refresh/only-export-components` warning). The collapse state lives in
 * `sessionStorage` and every access is guarded — a storage-denied environment
 * (private mode, disabled cookies) still gets a working, uncollapsed rail.
 */
export const RAIL_COLLAPSE_KEY = 'portwatch.rail.collapsed';

/** `true` when the rail was left collapsed this session; storage-throw safe. */
export function readCollapsed(): boolean {
  try {
    return sessionStorage.getItem(RAIL_COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist the collapse state; a storage throw is swallowed (collapse still works for the view). */
export function writeCollapsed(collapsed: boolean): void {
  try {
    sessionStorage.setItem(RAIL_COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    /* session storage unavailable — collapse still works for this view */
  }
}
