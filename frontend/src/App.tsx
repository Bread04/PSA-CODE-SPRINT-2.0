import { useState } from 'react';

import { AskPortwatch } from './components/AskPortwatch';
import { ExecutionTrace } from './components/ExecutionTrace';
import { IncidentDetail } from './components/IncidentDetail';
import { IncidentFeed } from './components/IncidentFeed';
import { KillSwitchBanner, KillSwitchControl } from './components/KillSwitchControl';
import { MapPanel } from './components/MapPanel';
import { useAskPortwatch } from './hooks/useAskPortwatch';
import { useKillSwitch } from './hooks/useKillSwitch';
import { allIncidents } from './test/fixtures/incidents';

/*
 * Minimal app shell for Stories 2.1–2.8 — NOT a real layout.
 * It exists only to visually exercise the token system, the BlueprintPanel
 * primitive, the IncidentFeed, the IncidentDetail + ApprovalBanner, the
 * ExecutionTrace, the AskPortwatch natural-language query panel (with
 * fixture data and a local selection), and the Story 2.8 KillSwitchControl /
 * KillSwitchBanner (one live `useKillSwitch()` instance, no backend here) end
 * to end. The MapPanel below is a
 * static, dataless illustrative schematic — it takes no incident/selection
 * input and is mounted here only to show it in place. The real Live Console
 * layout, the polling wiring (useIncidents / useApproval), and the router
 * arrive in later stories — here `onApprovalAction` is an inert stub and there
 * is no live backend. `useAskPortwatch` is wired for real (a single GET per
 * submit) but has no backend to reach in this demo shell.
 */
function App() {
  const [selectedId, setSelectedId] = useState<string | null>('inc-tier3-with-alts');
  const selected =
    allIncidents.find((i) => i.incident_id === selectedId) ?? null;
  const ask = useAskPortwatch();
  const kill = useKillSwitch();

  return (
    <div>
      <KillSwitchBanner engaged={kill.engaged} />
      <header
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-6)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--divider)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 'var(--font-weight-heading)',
            fontSize: 'var(--font-size-micro-label)',
            letterSpacing: 'var(--letter-spacing-micro-label)',
            textTransform: 'uppercase',
          }}
        >
          Portwatch Console
        </h1>
        <div style={{ marginLeft: 'auto' }}>
          <KillSwitchControl
            engaged={kill.engaged}
            pending={kill.pending}
            error={kill.error}
            onChange={kill.setEngaged}
          />
        </div>
      </header>

      <main
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          padding: 'var(--space-6)',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ width: 'var(--col-left)', flex: 'none' }}>
          <IncidentFeed
            incidents={allIncidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            lastUpdatedAt={Date.now()}
            isStale={false}
            error={null}
          />
        </div>

        <section style={{ flex: 1 }}>
          <IncidentDetail
            incident={selected}
            submitting={false}
            error={null}
            onApprovalAction={() => {}}
          />
          <MapPanel />
        </section>

        <aside
          style={{
            width: 'var(--col-right)',
            flex: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
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
    </div>
  );
}

export default App;
