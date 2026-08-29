import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DemoTrigger } from './index';
import { ApiError } from '../../api/client';

/**
 * spec-demo-three-way-disruption-trigger — DemoTrigger.
 *
 * Token-driven visual values are verified by a static scan of DemoTrigger.css
 * (the spec's CSS token / hex / radius guardrail) — jsdom does not resolve
 * stylesheet var() cascades.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'DemoTrigger.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const baseProps = {
  running: false,
  pending: false,
  error: null as ApiError | null,
  onTrigger: () => {},
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DemoTrigger', () => {
  it('renders the "Run demo" button under a dev build', () => {
    render(<DemoTrigger {...baseProps} />);
    expect(
      screen.getByRole('button', { name: /run demo/i }),
    ).toBeInTheDocument();
  });

  it('calls onTrigger on click', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    render(<DemoTrigger {...baseProps} onTrigger={onTrigger} />);

    await user.click(screen.getByRole('button', { name: /run demo/i }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('while pending: the button is disabled', () => {
    render(<DemoTrigger {...baseProps} pending={true} />);
    expect(screen.getByRole('button', { name: /run demo/i })).toBeDisabled();
  });

  it('while running: the button reads "Demo running…" and is disabled', () => {
    render(<DemoTrigger {...baseProps} running={true} />);
    const btn = screen.getByRole('button', { name: /demo running/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Demo running…');
  });

  it('shows an inline retry line on error', () => {
    render(<DemoTrigger {...baseProps} error={new ApiError('boom')} />);
    expect(
      screen.getByText("Couldn't start the demo — try again."),
    ).toBeInTheDocument();
  });

  it('renders nothing in a production build (import.meta.env.DEV false)', () => {
    vi.stubEnv('DEV', false);
    const { container } = render(<DemoTrigger {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DemoTrigger.css routes visual values through Story 2.1 tokens', () => {
  it('the button uses var(--accent-700) background and var(--neutral-100) text', () => {
    expect(css).toMatch(
      /\.demo-trigger__button\s*\{[^}]*background\s*:\s*var\(\s*--accent-700\s*\)/,
    );
    expect(css).toMatch(
      /\.demo-trigger__button\s*\{[^}]*color\s*:\s*var\(\s*--neutral-100\s*\)/,
    );
  });

  it('contains no raw hex colour and no named CSS colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/:\s*(?:red|blue|green|black|white|gray|grey)\b/);
  });

  it('every border-radius is 0', () => {
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map((m) =>
      m[1].trim(),
    );
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) expect(r).toBe('0');
  });

  it('every font-size routes through a var(--font-size-*) token', () => {
    const sizes = [...css.matchAll(/font-size\s*:\s*([^;}]+)/g)].map((m) =>
      m[1].trim(),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const s of sizes) expect(s).toMatch(/^var\(--font-size-[a-z-]+\)$/);
  });
});
