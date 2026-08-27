import { useState } from 'react';

import { ExecutionTrace } from './components/ExecutionTrace';
import { IncidentDetail } from './components/IncidentDetail';
import { IncidentFeed } from './components/IncidentFeed';
import { allIncidents } from './test/fixtures/incidents';

/*
 * Minimal app shell for Stories 2.1–2.4 — NOT a real layout.
 * It exists only to visually exercise the token system, the BlueprintPanel
 * primitive, the IncidentFeed, and now the IncidentDetail + ApprovalBanner
 * (with fixture data and a local selection) end to end. The real Live Console
 * layout, the polling wiring (useIncidents / useApproval), and the router
 * arrive in later stories — here `onApprovalAction` is an inert stub and there
 * is no live backend.
 */
function App() {
  const [selectedId, setSelectedId] = useState<string | null>('inc-tier3-with-alts');
  const selected =
    allIncidents.find((i) => i.incident_id === selectedId) ?? null;

  return (
    <div>
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
        </section>

        <aside style={{ width: 'var(--col-right)', flex: 'none' }}>
          <ExecutionTrace trace={selected?.trace ?? []} />
        </aside>
      </main>
    </div>
  );
}

export default App;
