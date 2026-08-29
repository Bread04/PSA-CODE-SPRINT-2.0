import { useState } from 'react';
import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IncidentFeed } from './index';
import { ApiError } from '../../api/client';
import type { Incident } from '../../types/incident';
import {
  degradedConfidenceFallback,
  degradedConfidenceNoHint,
  killSwitchBlocked,
  mockForced,
  openInProgress,
  tier1Resolved,
  tier2Resolved,
  tier3PendingNewer,
  tier3PendingOlder,
} from '../../test/fixtures/incidents';

/**
 * Story 2.3 — IncidentFeed / IncidentRow.
 *
 * Covers every I/O & Edge-Case Matrix row that concerns rendering or
 * interaction. Token-driven visual values (dot colour, progress-bar colours,
 * focus ring) are verified by DOM structure + a static scan of
 * IncidentFeed.css — jsdom does not resolve stylesheet `var()` cascades.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'IncidentFeed.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const noop = () => {};

function renderFeed(
  incidents: Incident[],
  extra: Partial<ComponentProps<typeof IncidentFeed>> = {},
) {
  return render(
    <IncidentFeed
      incidents={incidents}
      selectedId={null}
      onSelect={noop}
      lastUpdatedAt={null}
      isStale={false}
      {...extra}
    />,
  );
}

/** Controlled harness so selection round-trips like a real parent. */
function Harness({
  incidents,
  onSelectSpy,
}: {
  incidents: Incident[];
  onSelectSpy: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <IncidentFeed
      incidents={incidents}
      selectedId={selectedId}
      onSelect={(id) => {
        onSelectSpy(id);
        setSelectedId(id);
      }}
      lastUpdatedAt={null}
      isStale={false}
    />
  );
}

const rowButtons = () => screen.getAllByRole('button');

// ---------------------------------------------------------------------------
// Sort order
// ---------------------------------------------------------------------------
describe('sort order', () => {
  it('a Tier-3 pending row sorts above a more recent Tier-1 resolved row', () => {
    renderFeed([tier1Resolved, tier3PendingOlder]);
    const rows = rowButtons();
    expect(within(rows[0]).getByText(/EVER GIVEN/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/Gate G2/)).toBeInTheDocument();
  });

  it('multiple Tier-3 pending rows sit above all others, newest last_signal_at first', () => {
    renderFeed([tier1Resolved, tier3PendingOlder, tier3PendingNewer, openInProgress]);
    const rows = rowButtons();
    expect(within(rows[0]).getByText(/MSC ANNA/)).toBeInTheDocument(); // newer
    expect(within(rows[1]).getByText(/EVER GIVEN/)).toBeInTheDocument(); // older
    // non-pending rows follow
    expect(within(rows[2]).queryByText(/MSC ANNA|EVER GIVEN/)).toBeNull();
  });

  it('does not mutate the incoming array', () => {
    const input = [tier1Resolved, tier3PendingNewer];
    const snapshot = [...input];
    renderFeed(input);
    expect(input).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Dot + label pairing (severity never colour alone)
// ---------------------------------------------------------------------------
describe('status dot is always paired with a text label', () => {
  it('every row has both a dot element and a non-empty label', () => {
    const { container } = renderFeed([
      tier3PendingNewer,
      tier1Resolved,
      openInProgress,
      killSwitchBlocked,
    ]);
    const rows = container.querySelectorAll('.incident-row');
    expect(rows.length).toBe(4);
    for (const row of rows) {
      expect(row.querySelector('.incident-row__dot')).not.toBeNull();
      const label = row.querySelector('.incident-row__label');
      expect(label?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it('Tier-3 pending row: pending dot + "Needs approval" text together', () => {
    const { container } = renderFeed([tier3PendingNewer]);
    expect(container.querySelector('.incident-row__dot--pending')).not.toBeNull();
    expect(screen.getByText('Needs approval')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tags / badge / progress bar
// ---------------------------------------------------------------------------
describe('resolution + state markers', () => {
  it('Tier 1 resolved: "Auto-resolved", no badge, no progress bar', () => {
    const { container } = renderFeed([tier1Resolved]);
    expect(screen.getByText('Auto-resolved')).toBeInTheDocument();
    expect(container.querySelector('.incident-row__badge')).toBeNull();
    expect(container.querySelector('.incident-row__progress')).toBeNull();
  });

  it('Tier 2 resolved: "Auto-resolved" plus a small non-sound notification badge', () => {
    const { container } = renderFeed([tier2Resolved]);
    expect(screen.getByText('Auto-resolved')).toBeInTheDocument();
    expect(container.querySelector('.incident-row__badge')).not.toBeNull();
  });

  it('open, non-pending incident: 2px progress bar beneath the label (decorative)', () => {
    const { container } = renderFeed([openInProgress]);
    const track = container.querySelector('.incident-row__progress');
    expect(track).not.toBeNull();
    expect(track?.querySelector('.incident-row__progress-fill')).not.toBeNull();
    // the bar is a motif (fixed width), not a real value — decorative only
    expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('progressbar')).toBeNull();
    // meaning is carried by the visible status text
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('kill-switch blocked: manual-action tag, and NOT treated as Tier 3 pending', () => {
    const { container } = renderFeed([killSwitchBlocked]);
    expect(
      screen.getByText('Needs manual action — kill switch engaged'),
    ).toBeInTheDocument();
    expect(container.querySelector('.incident-row__dot--pending')).toBeNull();
    expect(container.querySelector('.incident-row__dot--blocked')).not.toBeNull();
    expect(container.querySelector('.incident-row__progress')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Confidence-degradation reason (plain language + the number)
// ---------------------------------------------------------------------------
describe('confidence < 100 shows a plain-language reason alongside the number', () => {
  it('fallback in trace → "using last known state" + the number', () => {
    renderFeed([degradedConfidenceFallback]);
    expect(screen.getByText('using last known state')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('mock-forced trace entry → "response mocked for demo stability"', () => {
    renderFeed([mockForced]);
    expect(
      screen.getByText('response mocked for demo stability'),
    ).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('no trace hint → "Confidence reduced from 100"', () => {
    renderFeed([degradedConfidenceNoHint]);
    expect(screen.getByText('Confidence reduced from 100')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('confidence 100 → no reason line', () => {
    const { container } = renderFeed([tier1Resolved]);
    expect(container.querySelector('.incident-row__confidence')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selection — independent, keyboard-operable
// ---------------------------------------------------------------------------
describe('row selection', () => {
  it('each row is a <button type=button> with aria-pressed reflecting selection', () => {
    renderFeed([tier1Resolved, openInProgress]);
    for (const btn of rowButtons()) {
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).toHaveAttribute('type', 'button');
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('selecting one row then another is independent; onSelect gets the clicked id', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <Harness
        incidents={[openInProgress, tier1Resolved]}
        onSelectSpy={spy}
      />,
    );
    const titanRow = () =>
      screen.getByText(/TITAN/).closest('button') as HTMLButtonElement;
    const gateRow = () =>
      screen.getByText(/Gate G2/).closest('button') as HTMLButtonElement;
    const titanText = titanRow().textContent;

    await user.click(titanRow());
    expect(spy).toHaveBeenLastCalledWith(openInProgress.incident_id);
    expect(titanRow()).toHaveAttribute('aria-pressed', 'true');

    await user.click(gateRow());
    expect(spy).toHaveBeenLastCalledWith(tier1Resolved.incident_id);
    // the TITAN row is unaffected by the Gate row's selection
    expect(titanRow()).toHaveAttribute('aria-pressed', 'false');
    expect(gateRow()).toHaveAttribute('aria-pressed', 'true');
    expect(titanRow().textContent).toBe(titanText);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('activates with Enter and Space — once per activation', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(
      <Harness
        incidents={[openInProgress, tier1Resolved]}
        onSelectSpy={spy}
      />,
    );

    await user.tab();
    expect((document.activeElement as HTMLElement).tagName).toBe('BUTTON');
    await user.keyboard('{Enter}');
    expect(spy).toHaveBeenCalledTimes(1);

    await user.tab();
    await user.keyboard(' ');
    expect(spy).toHaveBeenCalledTimes(2);

    const ids = spy.mock.calls.map((c) => c[0]);
    expect(new Set(ids)).toEqual(
      new Set([openInProgress.incident_id, tier1Resolved.incident_id]),
    );
  });

  it('marks the selected row via aria-pressed and a --selected class', () => {
    renderFeed([openInProgress], { selectedId: openInProgress.incident_id });
    const btn = rowButtons()[0];
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveClass('incident-row--selected');
  });
});

// ---------------------------------------------------------------------------
// Container, empty state, stale line
// ---------------------------------------------------------------------------
describe('feed container + non-row states', () => {
  it('renders the list inside one portwatch .panel (one L-bracket + one corner mark)', () => {
    const { container } = renderFeed([tier1Resolved]);
    const panel = container.querySelector('.blueprint-panel.panel');
    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll('.blueprint-panel__corner')).toHaveLength(0);
    expect(panel?.querySelectorAll('.corner-mark')).toHaveLength(1);
    expect(screen.getByText('Incidents')).toBeInTheDocument();
    expect(container.querySelector('.panel-header .eyebrow')?.textContent).toBe(
      'Feed',
    );
  });

  it('empty list → a plain "No incidents" line, not an error', () => {
    const { container } = renderFeed([]);
    expect(screen.getByText('No incidents')).toBeInTheDocument();
    expect(container.querySelector('.blueprint-panel')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('when stale: a small "Last updated Xs ago" line above the still-visible rows', () => {
    renderFeed([tier1Resolved], {
      isStale: true,
      lastUpdatedAt: Date.now() - 12_000,
    });
    expect(screen.getByText(/Last updated \d+[smh] ago/)).toBeInTheDocument();
    // last-known rows are NOT hidden
    expect(screen.getByText(/Gate G2/)).toBeInTheDocument();
  });

  it('when not stale: no "Last updated" line', () => {
    renderFeed([tier1Resolved], { isStale: false, lastUpdatedAt: Date.now() });
    expect(screen.queryByText(/Last updated/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Accessible semantics (P7 / P19)
// ---------------------------------------------------------------------------
describe('accessible semantics', () => {
  it('the panel is a region labelled by the "Incidents" heading', () => {
    renderFeed([tier1Resolved]);
    const heading = screen.getByRole('heading', { name: 'Incidents' });
    expect(heading.tagName).toBe('H3');
    const region = screen.getByRole('region', { name: 'Incidents' });
    expect(region).toHaveAttribute('aria-labelledby', heading.id);
    expect(region).not.toHaveAttribute('aria-label');
  });

  it('each row button has an explicit "<label> — <status>" accessible name', () => {
    renderFeed([tier3PendingOlder]);
    const btn = rowButtons()[0];
    expect(btn).toHaveAttribute(
      'aria-label',
      'Vessel EVER GIVEN — Needs approval — Needs approval',
    );
  });

  it('a row with a confidence reason wires aria-describedby to the reason line', () => {
    const { container } = renderFeed([degradedConfidenceFallback]);
    const btn = rowButtons()[0];
    const describedby = btn.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    expect(container.querySelector(`#${describedby}`)).toHaveClass(
      'incident-row__confidence',
    );
  });

  it('a row without a confidence reason has no aria-describedby', () => {
    renderFeed([tier1Resolved]);
    expect(rowButtons()[0]).not.toHaveAttribute('aria-describedby');
  });
});

// ---------------------------------------------------------------------------
// Cold-start unreachable vs empty port (P3)
// ---------------------------------------------------------------------------
describe('empty-state wording depends on whether the service has been reached', () => {
  it('error + never-updated + no incidents → a retry notice, not "No incidents"', () => {
    renderFeed([], {
      error: new ApiError('backend down', 503),
      lastUpdatedAt: null,
    });
    expect(
      screen.getByText("Can't reach the incident service — retrying."),
    ).toBeInTheDocument();
    expect(screen.queryByText('No incidents')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('error but a prior success → still shows "No incidents" (last poll returned [])', () => {
    renderFeed([], {
      error: new ApiError('blip'),
      lastUpdatedAt: Date.now(),
    });
    expect(screen.getByText('No incidents')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Static scan of IncidentFeed.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('IncidentFeed.css routes visual values through Story 2.1 tokens', () => {
  it('row focus ring: 2px solid var(--accent-700) with an offset, on :focus-visible', () => {
    expect(css).toMatch(
      /\.incident-row:focus-visible\s*\{[^}]*outline\s*:\s*2px\s+solid\s+var\(\s*--accent-700\s*\)/,
    );
    expect(css).toMatch(
      /\.incident-row:focus-visible\s*\{[^}]*outline-offset\s*:/,
    );
  });

  it('selected row is visually distinct via var(--accent-400) border', () => {
    expect(css).toMatch(/border-color\s*:\s*var\(\s*--accent-400\s*\)\s*;/);
  });

  it('pending + blocked dots are var(--accent-900); base dot is 7x7', () => {
    // grouped selector: `.incident-row__dot--pending, .incident-row__dot--blocked { … }`
    expect(css).toMatch(
      /\.incident-row__dot--pending[\s,][^{]*\{[^}]*background\s*:\s*var\(\s*--accent-900\s*\)/,
    );
    expect(css).toMatch(
      /\.incident-row__dot--blocked[^{]*\{[^}]*background\s*:\s*var\(\s*--accent-900\s*\)/,
    );
    expect(css).toMatch(
      /\.incident-row__dot\s*\{[^}]*width\s*:\s*7px\s*;[^}]*height\s*:\s*7px\s*;/,
    );
  });

  it('progress bar: 2px track var(--neutral-300), fill var(--accent-600)', () => {
    expect(css).toMatch(
      /\.incident-row__progress\s*\{[^}]*height\s*:\s*2px\s*;[^}]*background\s*:\s*var\(\s*--neutral-300\s*\)/,
    );
    expect(css).toMatch(
      /\.incident-row__progress-fill\s*\{[^}]*background\s*:\s*var\(\s*--accent-600\s*\)/,
    );
  });

  it('contains no raw hex colour and no disallowed border-radius', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map((m) =>
      m[1].trim(),
    );
    for (const r of radii) {
      expect(r === '0' || /^var\(--radius-[a-z-]+\)$/.test(r)).toBe(true);
    }
  });
});
