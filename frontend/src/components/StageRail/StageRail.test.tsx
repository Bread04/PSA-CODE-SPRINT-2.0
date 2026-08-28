import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StageRail } from './StageRail';
import type { Incident, TraceEntry } from '../../types/incident';

/**
 * Story 4.2 — StageRail component.
 *
 * Covers KEYBOARD_SR + the render rows called out in the spec and the 4-2
 * review patches. Token-driven visual values are verified by a static scan of
 * StageRail.css (jsdom does not resolve stylesheet var() cascades), mirroring
 * MapPanel.test.tsx.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'StageRail.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

function trace(...steps: Array<[string, TraceEntry['error']?]>): TraceEntry[] {
  return steps.map(([stage, error], i) => ({
    stage,
    timestamp: new Date(Date.parse('2026-08-28T00:00:00Z') + i * 1000).toISOString(),
    detail: {},
    error: error ?? null,
  }));
}

const FULL_TRACE = trace(
  ['INGEST'],
  ['CORRELATE'],
  ['AGENT_CALL'],
  ['SYNTHESIZE'],
  ['CONFIDENCE'],
  ['POLICY_DECISION'],
  ['DG_CHECK'],
  ['APPROVAL'],
  ['EXECUTE'],
  ['VERIFY'],
);

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    incident_id: 'inc-rail-test',
    status: 'open',
    entity_refs: [],
    tier: 3,
    confidence: 100,
    recommended_option_id: null,
    options: [],
    approval_status: 'pending',
    blocked_by_kill_switch: false,
    trace: trace(['CORRELATE'], ['AGENT_CALL']),
    created_at: '2026-08-28T00:00:00Z',
    last_signal_at: '2026-08-28T00:00:00Z',
    ...overrides,
  };
}

function getRail(): HTMLElement {
  return screen.getByRole('region', { name: 'Pipeline' });
}

describe('StageRail — structure & accessibility', () => {
  it('renders one region named by its <h3>, inside the BlueprintPanel', () => {
    render(<StageRail incident={makeIncident()} />);
    const rail = getRail();

    expect(rail.tagName).toBe('SECTION');
    expect(rail).toHaveClass('blueprint-panel');
    expect(rail).toHaveClass('stage-rail');

    const heading = within(rail).getByRole('heading', { level: 3, name: 'Pipeline' });
    expect(rail.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(rail).not.toHaveAttribute('aria-label');
  });

  it('renders exactly 10 list items', () => {
    render(<StageRail incident={makeIncident()} />);
    expect(within(getRail()).getAllByRole('listitem')).toHaveLength(10);
  });

  it('KEYBOARD_SR: adds no focusable / interactive element', () => {
    render(<StageRail incident={makeIncident()} />);
    const rail = getRail();

    expect(rail.querySelectorAll('button')).toHaveLength(0);
    expect(within(rail).queryByRole('button')).toBeNull();

    const positiveTabIndex = Array.from(rail.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > -1,
    );
    expect(positiveTabIndex).toHaveLength(0);

    for (const el of rail.querySelectorAll('*')) {
      for (const attr of el.getAttributeNames()) {
        expect(attr.startsWith('on')).toBe(false);
      }
    }
  });

  it('KEYBOARD_SR: each <li> accessible name states its label and state', () => {
    render(<StageRail incident={makeIncident()} />);
    const items = within(getRail()).getAllByRole('listitem');
    for (const li of items) {
      const name = li.getAttribute('aria-label') ?? '';
      expect(name).toMatch(/^[A-Z_]+: (done|current|attention|pending|complete)/);
    }
    // Spot-check the mid-pipeline fixture (CORRELATE + AGENT_CALL).
    expect(items[0]).toHaveAttribute('aria-label', 'INGEST: done');
    expect(items[2]).toHaveAttribute('aria-label', 'AGENT_CALL: current');
    expect(items[9]).toHaveAttribute('aria-label', 'VERIFY: pending');
  });

  it('aria-current="step" sits on the active <li> only', () => {
    render(<StageRail incident={makeIncident()} />);
    const items = within(getRail()).getAllByRole('listitem');
    const current = items.filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveClass('stage-rail__item--active');
    expect(current[0]).toHaveTextContent('AGENT_CALL');
  });

  it('no <li> carries aria-current when nothing is active (all pending)', () => {
    render(<StageRail incident={null} />);
    for (const li of within(getRail()).getAllByRole('listitem')) {
      expect(li).not.toHaveAttribute('aria-current');
    }
  });
});

describe('StageRail — state projection', () => {
  it('MID_PIPELINE fixture: the right items carry --done / --active / --pending', () => {
    render(<StageRail incident={makeIncident()} />);
    const items = within(getRail()).getAllByRole('listitem');

    expect(items[0]).toHaveClass('stage-rail__item--done'); // INGEST
    expect(items[1]).toHaveClass('stage-rail__item--done'); // CORRELATE
    expect(items[2]).toHaveClass('stage-rail__item--active'); // AGENT_CALL
    for (const li of items.slice(3)) {
      expect(li).toHaveClass('stage-rail__item--pending');
    }
  });

  it('an error / retry fixture shows the flag text in the item and the --error class', () => {
    render(
      <StageRail
        incident={makeIncident({
          trace: [
            {
              stage: 'AGENT_CALL',
              timestamp: '2026-08-28T00:00:01Z',
              detail: { retried: true },
              error: null,
            },
            {
              stage: 'EXECUTE',
              timestamp: '2026-08-28T00:00:02Z',
              detail: {},
              error: { stage: 'EXECUTE', error: 'boom', retried: false, fallback_used: false },
            },
          ],
        })}
      />,
    );
    const items = within(getRail()).getAllByRole('listitem');

    expect(items[2]).toHaveClass('stage-rail__item--error'); // AGENT_CALL (retry)
    expect(items[2]).toHaveTextContent(/RETRY/);
    expect(items[2].getAttribute('aria-label')).toContain('(RETRY)');

    expect(items[8]).toHaveClass('stage-rail__item--error'); // EXECUTE (error)
    expect(items[8]).toHaveTextContent(/ERROR/);
    expect(items[8].getAttribute('aria-label')).toContain('attention');
  });

  it('NO_INCIDENT: incident={null} -> 10 --pending items, no --error', () => {
    render(<StageRail incident={null} />);
    const items = within(getRail()).getAllByRole('listitem');
    expect(items).toHaveLength(10);
    for (const li of items) {
      expect(li).toHaveClass('stage-rail__item--pending');
    }
    expect(getRail().querySelectorAll('.stage-rail__item--error')).toHaveLength(0);
  });

  it('COMPLETE: a full trace through VERIFY -> VERIFY reads "complete", the rest "done"', () => {
    render(<StageRail incident={makeIncident({ trace: FULL_TRACE })} />);
    const items = within(getRail()).getAllByRole('listitem');

    for (const li of items.slice(0, 9)) {
      expect(li).toHaveClass('stage-rail__item--done');
      expect(li.querySelector('.stage-rail__state')).toHaveTextContent(/^done$/);
    }
    expect(items[9]).toHaveClass('stage-rail__item--complete');
    expect(items[9].querySelector('.stage-rail__state')).toHaveTextContent(/^complete$/);
    expect(items[9]).toHaveAttribute('aria-label', 'VERIFY: complete');
    expect(items[9]).not.toHaveAttribute('aria-current');
  });

  it('passes an extra className through; whitespace-only className emits no blank token', () => {
    const { rerender } = render(<StageRail incident={makeIncident()} className="x" />);
    expect(getRail()).toHaveClass('blueprint-panel', 'stage-rail', 'x');

    rerender(<StageRail incident={makeIncident()} className="   " />);
    expect(getRail().className).toBe('blueprint-panel stage-rail');
  });
});

// ---------------------------------------------------------------------------
// Static scan of StageRail.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('StageRail.css routes visual values through Story 2.1 tokens', () => {
  it('contains no raw hex colour and no named CSS colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/:\s*(?:red|blue|green|black|white|gray|grey)\b/);
  });

  it('every colour value is a var(--*) token, currentColor, or none', () => {
    const colourProps = [
      ...css.matchAll(
        /(?:^|[;{])\s*(?:color|fill|stroke|background(?:-color)?)\s*:\s*([^;}]+)/g,
      ),
    ].map((m) => m[1].trim());
    expect(colourProps.length).toBeGreaterThan(0);
    for (const value of colourProps) {
      expect(
        value === 'none' ||
          value === 'currentColor' ||
          /^var\(--[a-z0-9-]+\)$/.test(value),
      ).toBe(true);
    }
  });

  it('the state text routes font-size through --font-size-caption and colour through --text', () => {
    expect(css).toMatch(
      /\.stage-rail__state\s*\{[^}]*font-size\s*:\s*var\(\s*--font-size-caption\s*\)/,
    );
    expect(css).toMatch(/\.stage-rail__state\s*\{[^}]*color\s*:\s*var\(\s*--text\s*\)/);
  });

  it('every border-radius is 0 or a var(--radius-*) token', () => {
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) {
      expect(r === '0' || /^var\(--radius-[a-z-]+\)$/.test(r)).toBe(true);
    }
  });

  it('gives every state a distinguishing marker rule (shape, not hue alone)', () => {
    for (const state of ['pending', 'done', 'complete', 'active', 'error']) {
      expect(css).toMatch(
        new RegExp(`\\.stage-rail__item--${state} \\.stage-rail__marker\\b`),
      );
    }
  });
});
