import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AgentRoster } from './index';
import {
  tier3WithAlternatives,
  tier3PendingNewer,
  openInProgress,
  demoRoster,
} from '../../test/fixtures/incidents';

/**
 * Harbor Signal AgentRoster — read-only "Orchestra" panel
 * (spec-harbor-signal-reskin).
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, 'AgentRoster.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('AgentRoster — render', () => {
  it('renders one chip per agent in berth -> crane -> yard order', () => {
    const { container } = render(<AgentRoster incident={tier3WithAlternatives} />);
    expect(
      screen.getByRole('region', { name: 'Agent Roster' }),
    ).toBeInTheDocument();
    const chips = [...container.querySelectorAll('.agent-roster__chip')];
    expect(chips).toHaveLength(3);
    expect(
      chips.map((li) => li.querySelector('.agent-roster__agent')?.textContent),
    ).toEqual(['Berth / Vessel', 'Crane', 'Yard']);
  });

  it('shows the run state as a text token AND a state class (never colour-only)', () => {
    const { container } = render(<AgentRoster incident={tier3WithAlternatives} />);
    const [berth, crane, yard] = [
      ...container.querySelectorAll<HTMLElement>('.agent-roster__chip'),
    ];

    // tier3WithAlternatives: crane AGENT_CALL carries error.fallback_used.
    expect(crane).toHaveClass('agent-roster__chip--fallback');
    expect(within(crane).getByText('FALLBACK')).toBeInTheDocument();

    expect(berth).toHaveClass('agent-roster__chip--complete');
    expect(yard).toHaveClass('agent-roster__chip--complete');
    expect(within(berth).getByText('COMPLETE')).toBeInTheDocument();
  });

  it('exposes each agent summary and an expandable actions / constraints disclosure', () => {
    const { container } = render(<AgentRoster incident={tier3WithAlternatives} />);
    const crane = container.querySelectorAll<HTMLElement>('.agent-roster__chip')[1];
    expect(
      within(crane).getByText(/Crane #7 telemetry timed out/i),
    ).toBeInTheDocument();

    const disclosure = within(crane).getByText(/Recommendation & constraints/i);
    expect(disclosure.tagName).toBe('SUMMARY');
    // Details content is present in the DOM (native disclosure).
    expect(within(crane).getByText('Actions')).toBeInTheDocument();
    expect(within(crane).getByText('Constraints')).toBeInTheDocument();
    // rationale is carried through deriveRoster and surfaced (patch 10).
    expect(within(crane).getByText('Rationale')).toBeInTheDocument();
    expect(
      within(crane).getByText(/#7 unknown so it is excluded/i),
    ).toBeInTheDocument();
  });

  it('renders a chip for every agent even with an empty trace (all COMPLETE)', () => {
    const { container } = render(<AgentRoster incident={tier3PendingNewer} />);
    const chips = [...container.querySelectorAll('.agent-roster__chip')];
    expect(chips).toHaveLength(3);
    expect(
      chips.every((li) => li.classList.contains('agent-roster__chip--complete')),
    ).toBe(true);
  });

  it('is not a decision surface — no buttons, no positive tabindex', () => {
    const { container } = render(<AgentRoster incident={tier3WithAlternatives} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelector('[tabindex]:not([tabindex="-1"])')).toBeNull();
  });
});

describe('AgentRoster — empty / null', () => {
  it('renders nothing when no incident is selected', () => {
    const { container } = render(<AgentRoster incident={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the incident has no specialist bundle', () => {
    const { container } = render(<AgentRoster incident={openInProgress} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AgentRoster.css routes visual values through tokens', () => {
  it('contains no raw hex colour and no CSS named colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/:\s*(?:red|blue|green|black|white|gray|grey)\b/);
  });

  it('every border-radius is 0 or a var(--radius-*) token', () => {
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map((m) =>
      m[1].trim(),
    );
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) {
      expect(r === '0' || /^var\(--radius-[a-z-]+\)$/.test(r)).toBe(true);
    }
  });

  it('each run-state colour routes through a signal accent token', () => {
    expect(css).toMatch(
      /\.agent-roster__state--complete\s*\{[^}]*color\s*:\s*var\(\s*--accent-500\s*\)/,
    );
    expect(css).toMatch(
      /\.agent-roster__state--timeout\s*\{[^}]*color\s*:\s*var\(\s*--accent-900\s*\)/,
    );
    expect(css).toMatch(
      /\.agent-roster__state--fallback\s*\{[^}]*color\s*:\s*var\(\s*--accent-2\s*\)/,
    );
  });
});

describe('demoRoster fixture', () => {
  it('is a frozen 3-tuple in berth -> crane -> yard order', () => {
    expect(demoRoster().map((r) => r.agent)).toEqual(['berth', 'crane', 'yard']);
  });
});
