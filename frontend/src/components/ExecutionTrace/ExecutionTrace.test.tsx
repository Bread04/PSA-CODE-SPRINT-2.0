import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ExecutionTrace } from './ExecutionTrace';
import type { TraceEntry } from '../../types/incident';

function makeEntry(
  over: Partial<TraceEntry> & Pick<TraceEntry, 'stage' | 'timestamp'>,
): TraceEntry {
  return { detail: {}, error: null, ...over };
}

function getRows(): HTMLElement[] {
  const log = screen.getByRole('log');
  return Array.from(log.querySelectorAll('.execution-trace__row'));
}

describe('ExecutionTrace', () => {
  it('renders a polite live log region and an empty state when there are no entries', () => {
    render(<ExecutionTrace trace={[]} />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions');
    expect(screen.getByText('No trace entries yet.')).toBeInTheDocument();
  });

  it('renders entries newest-at-top (reverse chronological by timestamp)', () => {
    const trace = [
      makeEntry({ stage: 'INGEST', timestamp: '2026-08-27T08:00:00Z' }),
      makeEntry({ stage: 'CORRELATE', timestamp: '2026-08-27T08:05:00Z' }),
      makeEntry({ stage: 'AGENT_CALL', timestamp: '2026-08-27T08:10:00Z' }),
    ];

    render(<ExecutionTrace trace={trace} />);

    const stages = getRows().map(
      (r) => r.querySelector('.execution-trace__stage')?.textContent,
    );
    expect(stages).toEqual(['AGENT_CALL', 'CORRELATE', 'INGEST']);
  });

  it('flags an error stage with ERROR, a dot, and the error message', () => {
    const trace = [
      makeEntry({
        stage: 'AGENT_CALL',
        timestamp: '2026-08-27T08:10:00Z',
        error: { stage: 'AGENT_CALL', error: 'provider timeout', retried: false, fallback_used: false },
      }),
    ];

    render(<ExecutionTrace trace={trace} />);

    const row = screen.getByText('AGENT_CALL').closest('.execution-trace__row') as HTMLElement;
    expect(row.className).toContain('execution-trace__row--error');
    expect(within(row).getByText('ERROR')).toBeInTheDocument();
    expect(row.querySelector('.execution-trace__dot')).toBeInTheDocument();
    expect(within(row).getByText('provider timeout')).toBeInTheDocument();
  });

  it('prefers FALLBACK then RETRY labels when both are set on the error', () => {
    const trace = [
      makeEntry({
        stage: 'AGENT_CALL',
        timestamp: '2026-08-27T08:10:00Z',
        error: { stage: 'AGENT_CALL', error: 'boom', retried: true, fallback_used: true },
      }),
    ];

    render(<ExecutionTrace trace={trace} />);

    const row = screen.getByText('AGENT_CALL').closest('.execution-trace__row') as HTMLElement;
    expect(within(row).getByText('FALLBACK')).toBeInTheDocument();
    expect(within(row).queryByText('RETRY')).not.toBeInTheDocument();
  });

  it('labels a retried (non-fallback) error as RETRY', () => {
    const trace = [
      makeEntry({
        stage: 'DG_CHECK',
        timestamp: '2026-08-27T08:10:00Z',
        error: { stage: 'DG_CHECK', error: 'rate limited', retried: true, fallback_used: false },
      }),
    ];

    render(<ExecutionTrace trace={trace} />);

    const row = screen.getByText('DG_CHECK').closest('.execution-trace__row') as HTMLElement;
    expect(within(row).getByText('RETRY')).toBeInTheDocument();
  });

  it('renders the mock annotation when detail.mock_forced is true', () => {
    const trace = [
      makeEntry({
        stage: 'AGENT_CALL',
        timestamp: '2026-08-27T08:10:00Z',
        detail: { mock_forced: true },
      }),
    ];

    render(<ExecutionTrace trace={trace} />);

    expect(
      screen.getByText('response mocked for demo stability', { selector: '.execution-trace__mock' }),
    ).toBeInTheDocument();
  });

  it('makes every row focusable with a descriptive aria-label', () => {
    const trace = [
      makeEntry({ stage: 'INGEST', timestamp: '2026-08-27T08:00:00Z' }),
      makeEntry({
        stage: 'AGENT_CALL',
        timestamp: '2026-08-27T08:10:00Z',
        error: { stage: 'AGENT_CALL', error: 'boom', retried: true, fallback_used: false },
      }),
    ];

    render(<ExecutionTrace trace={trace} />);

    for (const row of getRows()) {
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(row.getAttribute('aria-label')).toBeTruthy();
    }

    const errorRow = screen.getByText('AGENT_CALL').closest('.execution-trace__row') as HTMLElement;
    expect(errorRow.getAttribute('aria-label')).toContain('AGENT_CALL');
    expect(errorRow.getAttribute('aria-label')).toContain('RETRY');
  });

  it('renders unknown (non-vocabulary) stages without throwing', () => {
    const trace = [makeEntry({ stage: 'WIDGET_SPIN', timestamp: '2026-08-27T08:10:00Z' })];

    render(<ExecutionTrace trace={trace} />);

    expect(screen.getByText('WIDGET_SPIN')).toBeInTheDocument();
  });
});
