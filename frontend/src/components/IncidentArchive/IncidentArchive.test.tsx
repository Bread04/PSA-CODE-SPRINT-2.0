import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IncidentArchive, IncidentArchiveList } from './index';
import {
  openInProgress,
  resolvedApproved,
  resolvedRejected,
  tier1Resolved,
  tier2Resolved,
  tier3PendingNewer,
} from '../../test/fixtures/incidents';
import type { Incident } from '../../types/incident';

/**
 * Story 2.9 — IncidentArchive + IncidentArchiveList.
 *
 * Covers every I/O & Edge-Case Matrix row for the list + view: filter, order,
 * the three outcome tags, the empty line, opening an archived trace (no
 * approval controls), and the nothing-selected prompt. Token-driven visual
 * values are verified by a static scan of IncidentArchive.css.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'IncidentArchive.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const noop = () => {};

describe('IncidentArchiveList', () => {
  it('renders inside a BlueprintPanel with the "Incident Archive" heading', () => {
    render(
      <IncidentArchiveList
        incidents={[tier1Resolved]}
        selectedId={null}
        onSelect={noop}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Incident Archive' });
    expect(panel).toHaveClass('blueprint-panel');
    expect(panel).toHaveClass('panel');
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Incident Archive',
    });
    expect(heading).toHaveClass('panel-header__title', 'incident-archive__title');
    expect(panel.querySelector('.panel-header .eyebrow')?.textContent).toBe(
      'Session',
    );
  });

  it('shows only resolved incidents and does not mutate the input array', () => {
    const input: Incident[] = [
      tier3PendingNewer,
      tier1Resolved,
      openInProgress,
      tier2Resolved,
    ];
    const snapshot = JSON.stringify(input);

    render(
      <IncidentArchiveList
        incidents={input}
        selectedId={null}
        onSelect={noop}
      />,
    );

    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(2); // only the two resolved incidents
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('orders most-recently-resolved first (last_signal_at descending)', () => {
    // resolvedApproved last_signal 09:12 (newer) vs resolvedRejected 08:59 (older)
    render(
      <IncidentArchiveList
        incidents={[resolvedRejected, resolvedApproved]}
        selectedId={null}
        onSelect={noop}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Approved')).toBeInTheDocument();
    expect(within(items[1]).getByText('Rejected')).toBeInTheDocument();
  });

  it('renders the correct outcome tag per row, outside the IncidentRow button', () => {
    const { container } = render(
      <IncidentArchiveList
        incidents={[resolvedApproved, resolvedRejected, tier1Resolved]}
        selectedId={null}
        onSelect={noop}
      />,
    );

    const tags = [
      ...container.querySelectorAll<HTMLElement>('.incident-archive__outcome'),
    ];
    expect(tags.map((t) => t.textContent)).toEqual([
      'Approved', // resolvedApproved  — last_signal 09:12
      'Auto-resolved', // tier1Resolved     — last_signal 09:00
      'Rejected', // resolvedRejected  — last_signal 08:59
    ]);
    for (const tag of tags) {
      // The tag is a sibling of the row button, never nested inside it.
      expect(tag.closest('button')).toBeNull();
    }
  });

  it('wires each row to its outcome tag via aria-describedby', () => {
    render(
      <IncidentArchiveList
        incidents={[resolvedApproved]}
        selectedId={null}
        onSelect={noop}
      />,
    );

    const row = screen.getByRole('button');
    const describedById = row.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const target = document.getElementById(describedById!.split(' ').pop()!);
    expect(target).toHaveClass('incident-archive__outcome');
    expect(target).toHaveTextContent('Approved');
  });

  it('empty archive shows exactly one plain line and no rows, no role="alert"', () => {
    render(
      <IncidentArchiveList
        incidents={[tier3PendingNewer, openInProgress]}
        selectedId={null}
        onSelect={noop}
      />,
    );

    expect(
      screen.getByText('No resolved incidents yet this session.'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('IncidentArchive view', () => {
  it('with nothing selected, shows the plain prompt and no trace', () => {
    render(<IncidentArchive incidents={[resolvedApproved]} />);

    expect(
      screen.getByText('Select a resolved incident to view its trace.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Execution Trace' }),
    ).not.toBeInTheDocument();
  });

  it('opening a resolved row renders its ExecutionTrace read-only, with no approval controls', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <IncidentArchive
        incidents={[resolvedApproved, resolvedRejected, tier3PendingNewer]}
      />,
    );

    const row = screen.getByRole('button', {
      name: /Vessel MSC ANNA/i,
    });
    await user.click(row);

    // Trace is shown.
    expect(
      screen.getByRole('heading', { name: 'Execution Trace' }),
    ).toBeInTheDocument();
    expect(screen.getByText('EXECUTE')).toBeInTheDocument();

    // No Approve / Reject / Modify controls, no ApprovalBanner anywhere.
    expect(
      screen.queryByRole('button', { name: /approve|reject|modify/i }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.approval-banner')).toBeNull();
    expect(container.querySelector('.incident-detail')).toBeNull();
  });

  it('the detail heading carries the incident label and its resolution outcome', async () => {
    const user = userEvent.setup();
    render(<IncidentArchive incidents={[resolvedRejected]} />);

    await user.click(screen.getByRole('button'));

    const heading = screen.getByRole('heading', { level: 2, name: /EVER GIVEN/i });
    expect(within(heading).getByText('Rejected')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Static scan of IncidentArchive.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('IncidentArchive.css routes visual values through Story 2.1 tokens', () => {
  it('contains no raw hex colour and no named CSS colours', () => {
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

  it('the outcome tag routes colour, radius and micro-label type through tokens', () => {
    // The grouped .incident-archive__outcome, .incident-archive__detail-outcome rule.
    const rule = css.match(
      /\.incident-archive__outcome\s*,\s*\.incident-archive__detail-outcome\s*\{([^}]*)\}/,
    );
    expect(rule).not.toBeNull();
    const body = rule![1];
    expect(body).toMatch(/background\s*:\s*var\(\s*--neutral-100\s*\)/);
    expect(body).toMatch(/border-radius\s*:\s*var\(\s*--radius-tag\s*\)/);
    expect(body).toMatch(/font-size\s*:\s*var\(\s*--font-size-micro-label\s*\)/);
    expect(body).toMatch(
      /letter-spacing\s*:\s*var\(\s*--letter-spacing-micro-label\s*\)/,
    );
  });

  it('the active nav link is perceptible beyond colour (weight + underline)', () => {
    const appCss = readFileSync(join(HERE, '..', '..', 'App.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const rule = appCss.match(
      /\.app-nav__link\[aria-current='page'\]\s*\{([^}]*)\}/,
    );
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(
      /font-weight\s*:\s*var\(\s*--font-weight-heading\s*\)/,
    );
    expect(rule![1]).toMatch(/text-decoration\s*:\s*underline/);
  });
});
