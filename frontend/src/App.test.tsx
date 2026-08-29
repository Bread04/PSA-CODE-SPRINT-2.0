import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from './App';
import { readCollapsed } from './lib/railCollapse';
import * as client from './api/client';
import {
  allIncidents,
  tier3WithAlternatives,
} from './test/fixtures/incidents';

/**
 * App-level integration (epic-2 retro item 1).
 *
 * The real shell is wired to the live data layer. Here `../api/client` is
 * stubbed so `useIncidents` / `useApproval` / `useKillSwitch` / `useAskPortwatch`
 * exercise their real code paths against deterministic data — no network.
 */

beforeEach(() => {
  vi.spyOn(client, 'fetchIncidents').mockResolvedValue(allIncidents);
  vi.spyOn(client, 'postApproval').mockResolvedValue({ ok: true });
  vi.spyOn(client, 'postKillSwitch').mockResolvedValue({ enabled: true });
  vi.spyOn(client, 'fetchQuery').mockResolvedValue({ answer: 'stub answer' });
  vi.spyOn(client, 'postDemoTrigger').mockResolvedValue({
    started: true,
    primary_incident_id: tier3WithAlternatives.incident_id,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
  try {
    sessionStorage.clear();
  } catch {
    /* noop */
  }
});

describe('App routing', () => {
  it('renders the Live Console (not the archive) for an empty hash', async () => {
    window.location.hash = '';
    render(<App />);
    expect(await screen.findByRole('main')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Incident Archive' }),
    ).not.toBeInTheDocument();
  });

  it('renders the IncidentArchive (not the Live Console) for #/archive', async () => {
    window.location.hash = '#/archive';
    render(<App />);
    expect(
      await screen.findByRole('region', { name: 'Incident Archive' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('keeps the header and the Primary nav on both routes', () => {
    window.location.hash = '';
    const { unmount } = render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    unmount();

    window.location.hash = '#/archive';
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('nav anchors have the exact hrefs and aria-current sits on the active route', () => {
    window.location.hash = '';
    const { unmount } = render(<App />);
    let live = screen.getByRole('link', { name: 'Live Console' });
    let archive = screen.getByRole('link', { name: 'Archive' });
    expect(live).toHaveAttribute('href', '#/');
    expect(archive).toHaveAttribute('href', '#/archive');
    expect(live).toHaveAttribute('aria-current', 'page');
    expect(archive).not.toHaveAttribute('aria-current');
    unmount();

    window.location.hash = '#/archive';
    render(<App />);
    live = screen.getByRole('link', { name: 'Live Console' });
    archive = screen.getByRole('link', { name: 'Archive' });
    expect(archive).toHaveAttribute('aria-current', 'page');
    expect(live).not.toHaveAttribute('aria-current');
  });

  it('swaps the view live on a hashchange', async () => {
    window.location.hash = '';
    render(<App />);
    expect(await screen.findByRole('main')).toBeInTheDocument();

    window.location.hash = '#/archive';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(
      await screen.findByRole('region', { name: 'Incident Archive' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('moves focus to the route container on a route change (not on first load)', async () => {
    window.location.hash = '';
    const { container } = render(<App />);
    await screen.findByRole('main');
    // First load must not steal focus.
    expect(document.activeElement).toBe(document.body);

    window.location.hash = '#/archive';
    fireEvent(window, new HashChangeEvent('hashchange'));
    await screen.findByRole('region', { name: 'Incident Archive' });

    expect(document.activeElement).toBe(container.querySelector('.app-route'));
  });
});

describe('App live data wiring', () => {
  it('polls GET /incidents and renders the feed rows', async () => {
    render(<App />);
    expect(client.fetchIncidents).toHaveBeenCalled();
    const feed = await screen.findByRole('region', { name: 'Incidents' });
    await waitFor(() =>
      expect(within(feed).getAllByRole('button').length).toBeGreaterThan(0),
    );
  });

  it('selecting a feed row loads that incident into the detail + trace columns', async () => {
    const user = userEvent.setup();
    render(<App />);

    const feed = await screen.findByRole('region', { name: 'Incidents' });
    const row = await within(feed).findByText(
      /reroute affected yard moves through Crane #6/i,
    );
    await user.click(row.closest('button')!);

    // The approval banner for the Tier-3-with-alternatives fixture appears.
    expect(
      await screen.findByRole('heading', { name: /approval needed/i }),
    ).toBeInTheDocument();
    // Its trace is now in the right column.
    const trace = screen.getByRole('log');
    expect(
      within(trace).getAllByText(/CORRELATE|POLICY|EXECUTE|DG_CHECK/).length,
    ).toBeGreaterThan(0);
  });

  it('approving the selected incident calls postApproval with the AD-11 body and refetches', async () => {
    const user = userEvent.setup();
    render(<App />);

    const feed = await screen.findByRole('region', { name: 'Incidents' });
    const row = await within(feed).findByText(
      /reroute affected yard moves through Crane #6/i,
    );
    await user.click(row.closest('button')!);

    const approve = await screen.findByRole('button', { name: /^approve$/i });
    (client.fetchIncidents as ReturnType<typeof vi.fn>).mockClear();
    await user.click(approve);

    await waitFor(() =>
      expect(client.postApproval).toHaveBeenCalledWith(
        tier3WithAlternatives.incident_id,
        { action: 'approve' },
        expect.anything(),
      ),
    );
    // useApproval's onSuccess is wired to refetch.
    await waitFor(() => expect(client.fetchIncidents).toHaveBeenCalled());
  });

  const mapLabel = () =>
    screen
      .getByRole('region', { name: 'Strait Map' })
      .querySelector('svg[role="img"]')!
      .getAttribute('aria-label') ?? '';

  it('the map is degraded-safe with no incident and names the selection once one is picked', async () => {
    const user = userEvent.setup();
    render(<App />);

    // No incident selected: the map still renders (Story 2.7 fallback), no markers.
    const map = await screen.findByRole('region', { name: 'Strait Map' });
    expect(within(map).getAllByRole('img')).toHaveLength(1);
    expect(map.querySelectorAll('.geo-map__marker')).toHaveLength(0);

    const feed = await screen.findByRole('region', { name: 'Incidents' });
    const first = await within(feed).findByText(
      /reroute affected yard moves through Crane #6/i,
    );
    await user.click(first.closest('button')!);

    await waitFor(() => expect(mapLabel()).toContain('MSC-ANNA'));

    const second = await within(feed).findByText(/Vessel CMA CGM TITAN/i);
    await user.click(second.closest('button')!);

    await waitFor(() => {
      const label = mapLabel();
      expect(label).toContain('CMA-CGM-TITAN');
      expect(label).not.toContain('MSC-ANNA');
    });
  });

  it('composes the Pipeline stage rail + the map, and both update on selection change', async () => {
    const user = userEvent.setup();
    render(<App />);

    const feed = await screen.findByRole('region', { name: 'Incidents' });

    const clickRow = async (el: HTMLElement) => {
      const btn = el.closest('button');
      if (!btn) throw new Error('feed row has no <button> ancestor');
      await user.click(btn);
    };

    // tier3WithAlternatives — its trace reaches APPROVAL, so early rail stages
    // read as reached. The rail sits alongside the Strait Map in the centre.
    const first = await within(feed).findByText(
      /reroute affected yard moves through Crane #6/i,
    );
    await clickRow(first);

    const rail = await screen.findByRole('region', { name: 'Pipeline' });
    expect(screen.getByRole('region', { name: 'Strait Map' })).toBeInTheDocument();

    const items = within(rail).getAllByRole('listitem');
    expect(items).toHaveLength(10);
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'Pipeline' })).getAllByRole(
          'listitem',
        )[0],
      ).toHaveClass('stage-rail__item--done');
    });
    // The map names this incident's affected vessel.
    await waitFor(() => expect(mapLabel()).toContain('MSC-ANNA'));

    // openInProgress has an empty trace — selecting it resets the rail to
    // all-pending AND repoints the map at CMA-CGM-TITAN.
    const second = await within(feed).findByText(/Vessel CMA CGM TITAN/i);
    await clickRow(second);

    await waitFor(() => {
      const resetItems = within(
        screen.getByRole('region', { name: 'Pipeline' }),
      ).getAllByRole('listitem');
      expect(
        resetItems.every((li) =>
          li.classList.contains('stage-rail__item--pending'),
        ),
      ).toBe(true);
    });
    await waitFor(() => {
      const label = mapLabel();
      expect(label).toContain('CMA-CGM-TITAN');
      expect(label).not.toContain('MSC-ANNA');
    });
  });

  it('shows the AgentRoster for a selected incident on #/ and hides it on #/archive', async () => {
    const user = userEvent.setup();
    window.location.hash = '';
    render(<App />);

    const feed = await screen.findByRole('region', { name: 'Incidents' });
    const row = await within(feed).findByText(
      /reroute affected yard moves through Crane #6/i,
    );
    await user.click(row.closest('button')!);

    const roster = await screen.findByRole('region', { name: 'Agent Roster' });
    // tier3WithAlternatives: crane AGENT_CALL carries error.fallback_used.
    const crane = roster.querySelectorAll('.agent-roster__chip')[1];
    expect(crane).toHaveClass('agent-roster__chip--fallback');
    expect(within(crane as HTMLElement).getByText('FALLBACK')).toBeInTheDocument();

    window.location.hash = '#/archive';
    fireEvent(window, new HashChangeEvent('hashchange'));
    await screen.findByRole('region', { name: 'Incident Archive' });
    expect(
      screen.queryByRole('region', { name: 'Agent Roster' }),
    ).not.toBeInTheDocument();
  });

  it('the rail collapse toggle flips state, persists it, and is storage-failure safe', async () => {
    const user = userEvent.setup();
    window.location.hash = '';
    const { container, unmount } = render(<App />);
    await screen.findByRole('main');

    const shell = container.querySelector('.app-shell')!;
    const toggle = screen.getByRole('button', { name: /collapse navigation rail/i });
    expect(shell).not.toHaveClass('app-shell--rail-collapsed');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(shell).toHaveClass('app-shell--rail-collapsed');
    expect(
      screen.getByRole('button', { name: /expand navigation rail/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(readCollapsed()).toBe(true);

    // Persists across a re-mount (sessionStorage).
    unmount();
    const remount = render(<App />);
    expect(remount.container.querySelector('.app-shell')).toHaveClass(
      'app-shell--rail-collapsed',
    );

    // readCollapsed() never throws when sessionStorage access throws.
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage denied');
      });
    expect(() => readCollapsed()).not.toThrow();
    expect(readCollapsed()).toBe(false);
    spy.mockRestore();
  });

  it('renders the Harbor Signal chrome: grid + grain shell, translucent rail, a topbar with breadcrumb + LIVE chip + ticking SGT clock', async () => {
    const { container } = render(<App />);
    await screen.findByRole('main');

    // Shell: the grid + grain pseudo-element rules ship in App.css.
    const here = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
    const appCss = readFileSync(join(here, 'App.css'), 'utf8');
    expect(appCss).toMatch(/\.app-shell::before\s*\{[^}]*background-image:/);
    expect(appCss).toMatch(/\.app-shell::after\s*\{[^}]*feTurbulence/i);
    expect(appCss).toMatch(/\.app-rail\s*\{[^}]*backdrop-filter:\s*blur\(/);

    // Rail: brand lockup + OPERATIONS eyebrow + foot status.
    expect(container.querySelector('.app-rail__brand')).toBeInTheDocument();
    expect(
      container.querySelector('.app-rail__eyebrow')?.textContent,
    ).toMatch(/operations/i);
    expect(
      container.querySelector('.app-rail__status')?.textContent,
    ).toMatch(/all systems nominal/i);

    // Topbar: one .topbar with a breadcrumb, a .live-chip with a pulsing dot,
    // and a mono SGT clock.
    const topbar = container.querySelector('header.topbar')!;
    expect(topbar).toBeInTheDocument();
    expect(topbar.querySelector('.breadcrumb strong')?.textContent).toBe(
      'Dashboard',
    );
    const chip = topbar.querySelector('.live-chip')!;
    expect(chip.querySelector('.status-dot.pulse')).toBeInTheDocument();
    expect(topbar.querySelector('.topbar-time')?.textContent).toMatch(
      /^SGT \d{2}:\d{2}:\d{2}$/,
    );

    // Nav is still two <a> links with the exact names + hrefs.
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#/', '#/archive']);
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Live Console',
      'Archive',
    ]);
  });

  it('the topbar breadcrumb names the selected incident once one is picked', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const topbar = container.querySelector('header.topbar') as HTMLElement;

    const feed = await screen.findByRole('region', { name: 'Incidents' });
    const row = await within(feed).findByText(
      /reroute affected yard moves through Crane #6/i,
    );
    await user.click(row.closest('button')!);

    await waitFor(() =>
      expect(
        within(topbar).getByText(/MSC[ -]?ANNA/i, { selector: '.breadcrumb strong' }),
      ).toBeInTheDocument(),
    );
  });

  it('the topbar clock re-renders each second and stays in the SGT HH:MM:SS format', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { container } = render(<App />);
      const time = () =>
        container.querySelector('.topbar-time')?.textContent ?? '';

      await vi.waitFor(() =>
        expect(time()).toMatch(/^SGT \d{2}:\d{2}:\d{2}$/),
      );
      const before = time();

      await act(async () => {
        vi.setSystemTime(new Date(Date.now() + 1000));
        vi.advanceTimersByTime(1000);
      });

      expect(time()).toMatch(/^SGT \d{2}:\d{2}:\d{2}$/);
      expect(time()).not.toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the dev-only "Run demo" button; a click posts once, auto-selects the primary incident, and refetches (FE_TRIGGER)', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByRole('main');

    const topbar = container.querySelector('header.topbar') as HTMLElement;
    const btn = within(topbar).getByRole('button', { name: /run demo/i });
    expect(btn).toBeInTheDocument();

    vi.mocked(client.fetchIncidents).mockClear();
    await user.click(btn);

    // (1) exactly one POST
    await waitFor(() =>
      expect(client.postDemoTrigger).toHaveBeenCalledTimes(1),
    );
    // (2) onTriggered selected the mocked primary incident — breadcrumb names it
    await waitFor(() =>
      expect(
        within(topbar).getByText(/MSC[ -]?ANNA/i, { selector: '.breadcrumb strong' }),
      ).toBeInTheDocument(),
    );
    // (3) refetch() fired after the trigger resolved
    await waitFor(() => expect(client.fetchIncidents).toHaveBeenCalled());
  });

  it('the kill switch control posts to /kill-switch and shows the global banner', async () => {
    const user = userEvent.setup();
    render(<App />);

    const sw = screen.getByRole('switch', { name: /autonomous execution/i });
    await user.click(sw); // step 1: arm confirm
    await user.click(await screen.findByRole('button', { name: /^confirm$/i })); // step 2

    await waitFor(() =>
      expect(client.postKillSwitch).toHaveBeenCalledWith(true, expect.anything()),
    );
    expect(
      await screen.findByText('Autonomous execution disabled'),
    ).toBeInTheDocument();
  });
});
