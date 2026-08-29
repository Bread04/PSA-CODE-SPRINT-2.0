import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import './components/PortwatchPrimitives/PortwatchPrimitives.css';
import { AgentRoster } from './components/AgentRoster';
import { AskPortwatch } from './components/AskPortwatch';
import { DemoTrigger } from './components/DemoTrigger';
import { ExecutionTrace } from './components/ExecutionTrace';
import { IncidentArchive } from './components/IncidentArchive';
import { IncidentDetail } from './components/IncidentDetail';
import { IncidentFeed } from './components/IncidentFeed';
import { GeoMapPanel } from './components/GeoMapPanel';
import { KillSwitchBanner, KillSwitchControl } from './components/KillSwitchControl';
import { StageRail } from './components/StageRail';
import { useApproval } from './hooks/useApproval';
import { useAskPortwatch } from './hooks/useAskPortwatch';
import { useDemoTrigger } from './hooks/useDemoTrigger';
import { useHashRoute } from './hooks/useHashRoute';
import { useIncidents } from './hooks/useIncidents';
import { useKillSwitch } from './hooks/useKillSwitch';
import { formatIncidentLabel } from './lib/incident';
import { readCollapsed, writeCollapsed } from './lib/railCollapse';
import type { ApprovalAction } from './api/client';

import './App.css';

/** `SGT HH:MM:SS`, Singapore wall-clock, 24-hour (h23 avoids `24:00:00`). */
function formatSgtClock(now: Date): string {
  return now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Singapore',
    hourCycle: 'h23',
  });
}

/**
 * Topbar live clock — its own component so the 1s state tick re-renders only
 * this node, not the whole app tree. The tick is a state update (allowed under
 * `prefers-reduced-motion`), not a looping animation; the interval is cleared
 * on unmount.
 */
function TopbarClock() {
  const [clock, setClock] = useState<string>(() => formatSgtClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatSgtClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="topbar-time">SGT {clock}</span>;
}

/** 14px line icons — decorative, `aria-hidden`; safe glyphs are tofu-prone. */
const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  'aria-hidden': true,
} as const;

function LiveConsoleIcon() {
  return (
    <svg {...iconProps}>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1" />
      <line x1="7" y1="1.5" x2="7" y2="12.5" />
      <line x1="1.5" y1="7" x2="12.5" y2="7" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg {...iconProps}>
      <rect x="1.5" y="2" width="11" height="3" rx="0.5" />
      <rect x="1.5" y="6" width="11" height="3" rx="0.5" />
      <rect x="1.5" y="10" width="11" height="2.5" rx="0.5" />
    </svg>
  );
}

function BeaconMark() {
  return (
    <svg {...iconProps} width={16} height={16} viewBox="0 0 16 16">
      <path d="M8 1.5 L14 8 L8 14.5 L2 8 Z" />
      <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg {...iconProps} width={12} height={12} viewBox="0 0 12 12">
      {direction === 'left' ? (
        <path d="M7.5 2.5 L4 6 L7.5 9.5" />
      ) : (
        <path d="M4.5 2.5 L8 6 L4.5 9.5" />
      )}
    </svg>
  );
}

/**
 * Portwatch Console — the Live Console shell, re-skinned to "Harbor Signal"
 * (spec-harbor-signal-reskin).
 *
 * Wiring is unchanged: `useIncidents` polls `GET /incidents` every 2-3s and
 * drives the feed / detail / roster / trace / archive; `useApproval` owns the
 * one write path and refetches on success; `useKillSwitch` and `useAskPortwatch`
 * own their own POST/GET. `useHashRoute` swaps between the Live Console and the
 * session-scoped Incident Archive.
 *
 * Chrome follows DESIGN.md: a persistent left command rail (214 / 74px
 * collapsed, a 2px seafoam active-edge bar) carrying Dashboard (`#/`) +
 * Archive (`#/archive`), a 72px topbar (brand lockup + kill switch), and the
 * 296 | flex | 400 three-column body with the parallel agent roster on a
 * full-width row beneath it. All chrome styling lives in App.css via Story 2.1
 * tokens. The KillSwitchBanner is fixed to the viewport top; while engaged the
 * rail + body are offset by --banner-height so it is never covered.
 */
function App() {
  const route = useHashRoute();
  const { incidents, lastUpdatedAt, isStale, error, refetch } = useIncidents();
  const approval = useApproval(refetch);
  const ask = useAskPortwatch();
  const kill = useKillSwitch();
  const demo = useDemoTrigger();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => incidents.find((i) => i.incident_id === selectedId) ?? null,
    [incidents, selectedId],
  );

  const [railCollapsed, setRailCollapsed] = useState<boolean>(readCollapsed);
  const toggleRail = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  const onApprovalAction = useCallback(
    (body: ApprovalAction) => {
      if (selectedId) approval.submit(selectedId, body);
    },
    [approval, selectedId],
  );

  const onRunDemo = useCallback(() => {
    demo.trigger((primaryIncidentId) => {
      if (primaryIncidentId) setSelectedId(primaryIncidentId);
      refetch();
    });
  }, [demo.trigger, refetch]);

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

  const shellClassName = [
    'app-shell',
    railCollapsed ? 'app-shell--rail-collapsed' : '',
    kill.engaged ? 'app-shell--kill-engaged' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <KillSwitchBanner engaged={kill.engaged} />

      <div className={shellClassName}>
        <div className="app-rail" id="app-rail">
          <div className="app-rail__brand">
            <span className="app-rail__mark" aria-hidden="true">
              <BeaconMark />
            </span>
            <h1 className="app-rail__wordmark">
              PORTWATCH
              <small>TUAS</small>
            </h1>
          </div>

          <button
            type="button"
            className="app-rail__collapse"
            aria-expanded={!railCollapsed}
            aria-controls="app-rail"
            aria-label={
              railCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'
            }
            onClick={toggleRail}
          >
            <Chevron direction={railCollapsed ? 'right' : 'left'} />
          </button>

          <p className="app-rail__eyebrow">Operations</p>

          <nav className="app-nav" aria-label="Primary">
            <a
              className={`app-nav__link rail-button${route === 'live' ? ' active' : ''}`}
              href="#/"
              aria-label="Live Console"
              aria-current={route === 'live' ? 'page' : undefined}
            >
              <LiveConsoleIcon />
              <span className="app-nav__text">Live Console</span>
            </a>
            <a
              className={`app-nav__link rail-button${route === 'archive' ? ' active' : ''}`}
              href="#/archive"
              aria-label="Archive"
              aria-current={route === 'archive' ? 'page' : undefined}
            >
              <ArchiveIcon />
              <span className="app-nav__text">Archive</span>
            </a>
          </nav>

          <div className="app-rail__foot">
            <div className="app-rail__status">
              <span className="status-dot pulse" aria-hidden="true" />
              All systems nominal
            </div>
            <span>
              Portwatch <strong>Tuas Port</strong> · disruption orchestration
            </span>
          </div>
        </div>

        <div className="app-body">
          <header className="topbar">
            <div className="breadcrumb">
              <span>Portwatch</span>
              <ChevronRight size={12} aria-hidden="true" />
              <strong>
                {route === 'archive'
                  ? 'Archive'
                  : selected
                    ? formatIncidentLabel(selected)
                    : 'Dashboard'}
              </strong>
            </div>
            <div className="topbar__actions">
              <span className="live-chip">
                <span className="status-dot pulse" aria-hidden="true" />
                Live feed connected
              </span>
              <TopbarClock />
              <DemoTrigger
                running={demo.running}
                pending={demo.pending}
                error={demo.error}
                onTrigger={onRunDemo}
              />
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
              <div className="app-live">
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

                {/* Parallel specialist fan-out — full-width row beneath the
                    three columns so the chips sit side by side even at the
                    1280px floor (DESIGN.md "parallel fan-out"). */}
                <AgentRoster incident={selected} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
