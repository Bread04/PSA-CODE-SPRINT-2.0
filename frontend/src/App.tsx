import { useState } from 'react';

import { BlueprintPanel } from './components/BlueprintPanel';
import { IncidentFeed } from './components/IncidentFeed';
import { allIncidents } from './test/fixtures/incidents';

/*
 * Minimal app shell for Stories 2.1–2.3 — NOT a real layout.
 * It exists only to visually exercise the token system, the BlueprintPanel
 * primitive, and now the IncidentFeed (with fixture data and a local
 * selection) end to end. The real Live Console layout, the polling wiring, and
 * the router arrive in later stories.
 */
function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

        <BlueprintPanel as="section" style={{ flex: 1 }}>
          <p>
            Design token system initialized. Selected incident:{' '}
            <code>{selectedId ?? 'none'}</code>. This shell renders body text
            through <code> --font-body </code> and chrome through{' '}
            <code> --font-heading </code>, inside the shared BlueprintPanel
            primitive.
          </p>
        </BlueprintPanel>
      </main>
    </div>
  );
}

export default App;
