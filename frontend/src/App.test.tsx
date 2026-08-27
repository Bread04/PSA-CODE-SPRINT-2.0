import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import App from './App';

/**
 * Story 2.9 — App-level hash-route swap.
 *
 * `#/archive` renders the session-scoped IncidentArchive in place of the Live
 * Console `<main>`; anything else renders the Live Console. The global
 * KillSwitchBanner, the header, and the route nav are present on both routes.
 */

afterEach(() => {
  window.location.hash = '';
});

describe('App routing', () => {
  it('renders the Live Console (not the archive) for an empty hash', () => {
    window.location.hash = '';
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Incident Archive' }),
    ).not.toBeInTheDocument();
  });

  it('renders the IncidentArchive (not the Live Console) for #/archive', () => {
    window.location.hash = '#/archive';
    render(<App />);

    expect(
      screen.getByRole('region', { name: 'Incident Archive' }),
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

  it('swaps the view live on a hashchange without a re-render from the caller', () => {
    window.location.hash = '';
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();

    fireEvent(window, new HashChangeEvent('hashchange', { newURL: '#/archive' }));
    // The event alone is not enough — jsdom's location must reflect the change.
    window.location.hash = '#/archive';
    fireEvent(window, new HashChangeEvent('hashchange'));

    expect(
      screen.getByRole('region', { name: 'Incident Archive' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
