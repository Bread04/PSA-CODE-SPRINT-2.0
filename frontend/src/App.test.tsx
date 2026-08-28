import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from './App';
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
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
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
