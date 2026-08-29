import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { IncidentDetail } from './index';
import { ApiError } from '../../api/client';
import {
  killSwitchBlocked,
  openApproved,
  tier1Resolved,
  tier3DgRejected,
  tier3WithAlternatives,
} from '../../test/fixtures/incidents';

/**
 * Story 2.4 — IncidentDetail + ApprovalBanner + IncidentSummary.
 * (Retro item 3: the story shipped with no component test.)
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, 'IncidentDetail.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

const noop = () => {};

function renderDetail(
  incident: Parameters<typeof IncidentDetail>[0]['incident'],
  extra: Partial<Parameters<typeof IncidentDetail>[0]> = {},
) {
  return render(
    <IncidentDetail
      incident={incident}
      submitting={false}
      error={null}
      onApprovalAction={noop}
      {...extra}
    />,
  );
}

describe('placeholder / non-actionable routing', () => {
  it('null incident → a plain "Select an incident" line, no banner', () => {
    renderDetail(null);
    expect(screen.getByText(/select an incident/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
  });

  it('resolved incident → IncidentSummary with a status line, no action controls', () => {
    renderDetail(tier1Resolved);
    expect(screen.getByText('Auto-resolved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve|reject/i })).toBeNull();
  });

  it('approved-and-executing incident states its status even with no options', () => {
    renderDetail(openApproved);
    expect(screen.getByText('Approved — executing')).toBeInTheDocument();
  });
});

describe('IncidentSummary — Yard load row (Spec 3.2 / FR17)', () => {
  const withYardUtil = (util: unknown) => ({
    ...tier1Resolved,
    trace: [
      {
        stage: 'CORRELATE',
        timestamp: '2026-08-27T10:00:00Z',
        detail: { signal_type: 'yard_congestion', payload: { yard_utilization: util } },
        error: null,
      },
    ],
  });

  it('shows both blocks’ rounded percentages when the CORRELATE payload carries yard_utilization', () => {
    renderDetail(withYardUtil({ tuas_c7: 0.93, pasir_panjang_p2: 0.44 }));
    expect(screen.getByText('Yard load')).toBeInTheDocument();
    expect(
      screen.getByText('Tuas C7 93% · Pasir Panjang P2 44%'),
    ).toBeInTheDocument();
  });

  it('omits the row entirely when no utilization payload is present', () => {
    renderDetail(tier1Resolved);
    expect(screen.queryByText('Yard load')).toBeNull();
  });

  it('omits the row (no throw) when the payload is malformed', () => {
    renderDetail(withYardUtil({ tuas_c7: 'high' }));
    expect(screen.queryByText('Yard load')).toBeNull();
  });
});

describe('ApprovalBanner — Tier 3 pending', () => {
  it('shows situation, recommendation, predicted impact, confidence + degradation reason', () => {
    renderDetail(tier3WithAlternatives);
    expect(screen.getByText('Situation')).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(screen.getByText('Predicted impact')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('using last known state')).toBeInTheDocument();
  });

  it('Approve / Reject fire the exact AD-11 payloads', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderDetail(tier3WithAlternatives, { onApprovalAction: onAction });

    await user.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(onAction).toHaveBeenLastCalledWith({ action: 'approve' });

    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    expect(onAction).toHaveBeenLastCalledWith({ action: 'reject' });
  });

  it('an alternative fires select_alternative with that option_id', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderDetail(tier3WithAlternatives, { onApprovalAction: onAction });

    await user.click(
      screen.getByRole('button', { name: /Hold MSC Anna at anchorage/i }),
    );
    expect(onAction).toHaveBeenLastCalledWith({
      action: 'select_alternative',
      option_id: 'opt-2',
    });
  });

  it('submitting disables every action control', () => {
    renderDetail(tier3WithAlternatives, { submitting: true });
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('a submit error renders one plain retry line', () => {
    renderDetail(tier3WithAlternatives, { error: new ApiError('boom') });
    expect(screen.getByText(/didn.t go through — try again/i)).toBeInTheDocument();
  });

  it('a DG-gate-rejected option is shown struck through, not hidden', () => {
    const { container } = renderDetail(tier3DgRejected);
    expect(screen.getByText('Considered, rejected')).toBeInTheDocument();
    const struck = container.querySelector('.approval-banner__struck');
    expect(struck).not.toBeNull();
    expect(struck?.textContent).toMatch(/DG\/IMDG/i);
  });

  it('the banner is one portwatch .panel (one L-bracket + one corner mark)', () => {
    const { container } = renderDetail(tier3WithAlternatives);
    const panel = container.querySelector('.blueprint-panel.panel.approval-banner');
    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll('.blueprint-panel__corner')).toHaveLength(0);
    expect(panel?.querySelectorAll('.corner-mark')).toHaveLength(1);
  });
});

describe('ApprovalBanner — kill-switch-blocked (any tier, NOT reclassified to 3)', () => {
  it('shows the manual-action heading and Approve only — no Reject, no alternatives', () => {
    renderDetail(killSwitchBlocked);
    const bannerHeading = screen.getByRole('heading', {
      level: 4,
      name: 'Needs manual action — kill switch engaged',
    });
    expect(bannerHeading).toHaveClass(
      'panel-header__title',
      'approval-banner__heading',
    );
    // the 7px pulsing attention dot rides inside the header
    expect(
      bannerHeading.querySelector('.approval-banner__dot'),
    ).toBeInTheDocument();
    expect(screen.getByText('Kill Switch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).toBeNull();
    expect(screen.queryByText('Other options')).toBeNull();
  });
});

describe('first-appearance announce', () => {
  it('the banner region starts aria-live="assertive" and relaxes after first paint', async () => {
    const { container } = renderDetail(tier3WithAlternatives);
    const region = container.querySelector('.approval-banner') as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('assertive');
    await vi.waitFor(() =>
      expect(region.getAttribute('aria-live')).toBe('off'),
    );
  });
});

describe('IncidentDetail.css token discipline', () => {
  it('no raw hex, and the pulse keyframe + primary button route through tokens', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).toMatch(/@keyframes approval-banner-pulse/);
    expect(css).toMatch(
      /\.approval-banner__btn--primary\s*\{[^}]*background:\s*var\(--accent-700\)/,
    );
  });

  it('every font-size routes through a --font-size-* token', () => {
    const bare = [...css.matchAll(/font-size:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((v) => !/^var\(--font-size-[a-z-]+\)$/.test(v));
    expect(bare).toEqual([]);
  });
});
