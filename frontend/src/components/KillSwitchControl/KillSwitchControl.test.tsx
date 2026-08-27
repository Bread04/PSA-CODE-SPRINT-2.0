import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KillSwitchControl, KillSwitchBanner } from './index';
import { ApiError } from '../../api/client';

/**
 * Story 2.8 — KillSwitchControl + KillSwitchBanner.
 *
 * Covers every I/O & Edge-Case Matrix row that concerns rendering or
 * interaction. Token-driven visual values (focus ring, engaged-dot colour,
 * confirm-button colour, banner colour, radius) are verified by a static scan
 * of KillSwitchControl.css — jsdom does not resolve stylesheet var() cascades.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'KillSwitchControl.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const baseProps = {
  engaged: false,
  pending: false,
  error: null as ApiError | null,
  onChange: () => {},
};

describe('KillSwitchControl', () => {
  it('renders a role="switch" control named by the visible label, with a visible ON label', () => {
    render(<KillSwitchControl {...baseProps} />);

    const sw = screen.getByRole('switch');
    expect(sw).toHaveAccessibleName('Autonomous execution: ON');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Autonomous execution: ON')).toBeInTheDocument();
  });

  it('when engaged, aria-checked is true and the accessible + visible label read DISABLED', () => {
    render(<KillSwitchControl {...baseProps} engaged={true} />);

    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAccessibleName('Autonomous execution: DISABLED');
    expect(
      screen.getByText('Autonomous execution: DISABLED'),
    ).toBeInTheDocument();
  });

  it('the switch is keyboard-focusable via Tab', async () => {
    const user = userEvent.setup();
    render(<KillSwitchControl {...baseProps} />);
    await user.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
  });

  it('engage step 1: first activation does NOT call onChange; reveals inline Confirm + prompt', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KillSwitchControl {...baseProps} onChange={onChange} />);

    await user.click(screen.getByRole('switch'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(
      screen.getByText('Disable all autonomous execution?'),
    ).toBeInTheDocument();
  });

  it('engage step 2: activating Confirm calls onChange(true) exactly once and clears the armed state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KillSwitchControl {...baseProps} onChange={onChange} />);

    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
  });

  it('engage cancel via Escape: confirm disappears, onChange not called', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KillSwitchControl {...baseProps} onChange={onChange} />);

    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('engage cancel via re-activating the switch: confirm disappears, onChange not called', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KillSwitchControl {...baseProps} onChange={onChange} />);

    const sw = screen.getByRole('switch');
    await user.click(sw);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    await user.click(sw);

    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('engage cancel when focus moves to a real node outside the group', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <KillSwitchControl {...baseProps} onChange={onChange} />
        <button type="button">outside</button>
      </>,
    );

    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));

    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a blur with relatedTarget === null does NOT tear down the armed Confirm before its click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <KillSwitchControl {...baseProps} onChange={onChange} />,
    );

    await user.click(screen.getByRole('switch'));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toBeInTheDocument();

    // Simulate a browser that reports no relatedTarget on mousedown-driven blur.
    fireEvent.blur(container.querySelector('.kill-switch')!, {
      relatedTarget: null,
    });

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('an external `engaged` change while armed drops the stale confirm without a fresh activation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <KillSwitchControl {...baseProps} onChange={onChange} />,
    );

    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    // Switch state flips externally (e.g. a successful POST) then flips back.
    rerender(<KillSwitchControl {...baseProps} engaged={true} onChange={onChange} />);
    rerender(<KillSwitchControl {...baseProps} engaged={false} onChange={onChange} />);

    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Disable all autonomous execution?'),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('engage → confirm → POST fails: no bare armed Confirm button lingers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <KillSwitchControl {...baseProps} onChange={onChange} />,
    );

    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onChange).toHaveBeenCalledWith(true);

    // The hook settles with an error and `engaged` unchanged (still false).
    rerender(
      <KillSwitchControl
        {...baseProps}
        engaged={false}
        error={new ApiError('boom')}
        onChange={onChange}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Couldn't reach the kill switch — try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('disengage: a single activation calls onChange(false) immediately, no confirm shown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <KillSwitchControl {...baseProps} engaged={true} onChange={onChange} />,
    );

    await user.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(
      screen.queryByRole('button', { name: /confirm/i }),
    ).not.toBeInTheDocument();
  });

  it('keyboard Enter and Space on the switch activate it (engage path)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KillSwitchControl {...baseProps} onChange={onChange} />);

    const sw = screen.getByRole('switch');
    sw.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();

    // Space toggles the confirm gate back off.
    await user.keyboard(' ');
    expect(
      screen.queryByRole('button', { name: 'Confirm' }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pending: switch is disabled, "Working…" shown, activation is a no-op', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <KillSwitchControl {...baseProps} pending={true} onChange={onChange} />,
    );

    const sw = screen.getByRole('switch');
    expect(sw).toBeDisabled();
    expect(screen.getByText('Working…')).toBeInTheDocument();

    await user.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('error: plain retry line shown and aria-checked still reflects the unchanged engaged state', () => {
    render(
      <KillSwitchControl
        {...baseProps}
        engaged={false}
        error={new ApiError('boom')}
      />,
    );

    expect(
      screen.getByText("Couldn't reach the kill switch — try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});

describe('KillSwitchBanner', () => {
  it('renders nothing when engaged is false', () => {
    const { container } = render(<KillSwitchBanner engaged={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a role="status" banner with the exact copy and no dismiss control when engaged', () => {
    render(<KillSwitchBanner engaged={true} />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Autonomous execution disabled');
    expect(banner).toHaveClass('kill-switch-banner');
    expect(banner.querySelector('button')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Static scan of KillSwitchControl.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('KillSwitchControl.css routes visual values through Story 2.1 tokens', () => {
  it('focus ring: 2px solid var(--accent-700) with an offset, on :focus-visible', () => {
    expect(css).toMatch(
      /:focus-visible[^{]*\{[^}]*outline\s*:\s*2px\s+solid\s+var\(\s*--accent-700\s*\)/,
    );
    expect(css).toMatch(/:focus-visible[^{]*\{[^}]*outline-offset\s*:/);
  });

  it('the dot is circular via var(--radius-full)', () => {
    expect(css).toMatch(
      /\.kill-switch__dot\s*\{[^}]*border-radius\s*:\s*var\(\s*--radius-full\s*\)/,
    );
  });

  it('the engaged dot fill is var(--accent-900)', () => {
    expect(css).toMatch(
      /\.kill-switch__dot--engaged\s*\{[^}]*background\s*:\s*var\(\s*--accent-900\s*\)/,
    );
  });

  it('the confirm button uses var(--accent-700) background and var(--neutral-100) text', () => {
    expect(css).toMatch(
      /\.kill-switch__confirm\s*\{[^}]*background\s*:\s*var\(\s*--accent-700\s*\)/,
    );
    expect(css).toMatch(
      /\.kill-switch__confirm\s*\{[^}]*color\s*:\s*var\(\s*--neutral-100\s*\)/,
    );
  });

  it('the banner background is var(--accent-900) with a light text token', () => {
    expect(css).toMatch(
      /\.kill-switch-banner\s*\{[^}]*background\s*:\s*var\(\s*--accent-900\s*\)/,
    );
    expect(css).toMatch(
      /\.kill-switch-banner\s*\{[^}]*color\s*:\s*var\(\s*--neutral-100\s*\)/,
    );
  });

  it('contains no raw hex colour and no named CSS colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/:\s*(?:red|blue|green|black|white|gray|grey)\b/);
  });

  it('every border-radius is 0 or a var(--radius-*) token, and only --radius-full is non-zero', () => {
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map((m) =>
      m[1].trim(),
    );
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) {
      expect(r === '0' || /^var\(--radius-[a-z-]+\)$/.test(r)).toBe(true);
    }
    const nonZero = radii.filter((r) => r !== '0');
    for (const r of nonZero) {
      expect(r).toBe('var(--radius-full)');
    }
  });
});
