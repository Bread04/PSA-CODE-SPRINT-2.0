/**
 * Portwatch Console — minimal dependency-free hash route (Story 2.9).
 *
 * Two views only: the Live Console (default) and the session-scoped Incident
 * Archive. A hash of `#/archive` or `#archive` (case-insensitive, a trailing
 * slash tolerated) selects `'archive'`; everything else — including an empty
 * hash — is `'live'`. The hook subscribes to `hashchange` while mounted and
 * unsubscribes on unmount. No routing library, no history manipulation, no
 * persistence beyond the URL fragment itself.
 */

import { useEffect, useState } from 'react';

export type HashRoute = 'live' | 'archive';

/**
 * Normalise a raw `window.location.hash` to a route name. Tolerant of the
 * shapes a real URL fragment takes: a leading `#`, extra leading/trailing
 * slashes, a query string, and a deeper path segment
 * (`#//archive`, `#/archive//`, `#/archive?x=1`, `#/archive/detail`).
 */
export function parseHashRoute(hash: string): HashRoute {
  const firstSegment = hash
    .trim()
    .replace(/^#/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split(/[/?]/, 1)[0]
    .toLowerCase();
  return firstSegment === 'archive' ? 'archive' : 'live';
}

const readHash = (): string =>
  typeof window === 'undefined' ? '' : window.location.hash;

/** Current hash route, kept in sync with the `hashchange` event. */
export function useHashRoute(): HashRoute {
  const [route, setRoute] = useState<HashRoute>(() => parseHashRoute(readHash()));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => setRoute(parseHashRoute(window.location.hash));
    // Re-sync once in case the hash changed between the initial render and the
    // effect running.
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

export default useHashRoute;
