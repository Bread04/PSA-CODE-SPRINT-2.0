import { BlueprintPanel } from './components/BlueprintPanel';

/*
 * Minimal app shell for Stories 2.1–2.2 — NOT a real layout.
 * It exists only to visually exercise the heading, body, accent, and spacing
 * tokens plus the BlueprintPanel primitive end to end. The real Live Console
 * layout arrives in later stories.
 */
function App() {
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

      <main style={{ padding: 'var(--space-6)' }}>
        <BlueprintPanel as="section">
          <p style={{ marginBottom: 'var(--space-4)' }}>
            Design token system initialized. This shell renders body text through
            <code> --font-body </code> and chrome through <code> --font-heading </code>,
            inside the shared BlueprintPanel primitive.
          </p>
          <button
            type="button"
            style={{
              minHeight: '44px',
              padding: '0 var(--space-6)',
              background: 'var(--accent-700)',
              color: 'var(--neutral-100)',
              fontSize: 'var(--font-size-micro-label)',
              letterSpacing: 'var(--letter-spacing-micro-label)',
              textTransform: 'uppercase',
            }}
          >
            Accent button
          </button>
        </BlueprintPanel>
      </main>
    </div>
  );
}

export default App;
