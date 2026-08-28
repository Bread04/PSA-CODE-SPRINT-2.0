import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AskPortwatch } from './components/AskPortwatch';
import { ExecutionTrace } from './components/ExecutionTrace';
import { IncidentArchive } from './components/IncidentArchive';
import { IncidentDetail } from './components/IncidentDetail';
import { IncidentFeed } from './components/IncidentFeed';
import { GeoMapPanel } from './components/GeoMapPanel';
import { KillSwitchBanner, KillSwitchControl } from './components/KillSwitchControl';
import { StageRail } from './components/StageRail';
import { useApproval } from './hooks/useApproval';
import { useAskPortwatch } from './hooks/useAskPortwatch';
import { useHashRoute } from './hooks/useHashRoute';
import { useIncidents } from './hooks/useIncidents';
import { useKillSwitch } from './hooks/useKillSwitch';
import type { ApprovalAction } from './api/client';

import './App.css';

/**
 * Portwatch Console — the real Live Console shell (epic-2 retro item 1).
 *
 * Wires the live data layer end to end: `useIncidents` polls `GET /incidents`
 * every 2-3s and drives the feed / detail / trace / archive; `useApproval`
 * owns the one write path and refetches on success; `useKillSwitch` and
 * `useAskPortwatch` own their own POST/GET. `useHashRoute` swaps between the
 * Live Console and the session-scoped Incident Archive.
 *
 * Layout follows DESIGN.md: a fixed 54px header + a 296 | flex | 400 three-
 * column body. All chrome styling lives in App.css via Story 2.1 tokens.
 */
function App() {
  const route = useHashRoute();
  const { incidents, lastUpdatedAt, isStale, error, refetch } = useIncidents();
  const approval = useApproval(refetch);
  const ask = useAskPortwatch();
  const kill = useKillSwitch();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => incidents.find((i) => i.incident_id === selectedId) ?? null,
    [incidents, selectedId],
  );

  const onApprovalAction = useCallback(
    (body: ApprovalAction) => {
      if (selectedId) approval.submit(selectedId, body);
    },
    [approval, selectedId],
  );

  // Move focus to the route container on a route change (not on first load) so
  // keyboard / screen-reader users land in the new view instead of staying on
  // the nav link they just activated.
  const routeRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    routeRef.current?.focus();
  }, [route]);

  return (
    <div className="app">
      <KillSwitchBanner engaged={kill.engaged} />

      <header className="app-header">
        <h1 className="app-header__brand">Portwatch Console</h1>
        <nav className="app-nav" aria-label="Primary">
          <a
            className="app-nav__link"
            href="#/"
            aria-current={route === 'live' ? 'page' : undefined}
          >
            Live Console
          </a>
          <a
            className="app-nav__link"
            href="#/archive"
            aria-current={route === 'archive' ? 'page' : undefined}
          >
            Archive
          </a>
        </nav>
        <div className="app-header__kill">
          <KillSwitchControl
            engaged={kill.engaged}
            pending={kill.pending}
            error={kill.error}
            onChange={kill.setEngaged}
          />
        </div>
      </header>

      <div className="app-route" tabIndex={-1} ref={routeRef}>
      {route === 'archive' ? (
        <IncidentArchive incidents={incidents} />
      ) : (
        <main className="app-main">
          <div className="app-col app-col--left">
            <IncidentFeed
              incidents={incidents}
              selectedId={selectedId}
              onSelect={setSelectedId}
              lastUpdatedAt={lastUpdatedAt}
              isStale={isStale}
              error={error}
            />
          </div>

          <section className="app-col app-col--center">
            <IncidentDetail
              incident={selected}
              submitting={approval.submitting}
              error={approval.error}
              onApprovalAction={onApprovalAction}
            />
            <GeoMapPanel incident={selected} />
            <StageRail incident={selected} />
          </section>

          <aside className="app-col app-col--right">
            <ExecutionTrace trace={selected?.trace ?? []} />
            <AskPortwatch
              onSubmit={ask.submit}
              answer={ask.answer}
              submitting={ask.submitting}
              error={ask.error}
              selectedIncidentId={selectedId}
            />
          </aside>
        </main>
      )}
      </div>
    </div>
  );
}

export default App;
