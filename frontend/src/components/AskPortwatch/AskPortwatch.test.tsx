import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AskPortwatch, DEFAULT_SUGGESTIONS } from './AskPortwatch';
import { ApiError } from '../../api/client';

/**
 * Story 2.6 — AskPortwatch component.
 *
 * Covers every I/O & Edge-Case Matrix row that concerns rendering or
 * interaction. Token-driven visual values (focus ring, primary-button colour,
 * answer-bubble colour) are verified by DOM structure + a static scan of
 * AskPortwatch.css — jsdom does not resolve stylesheet var() cascades.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'AskPortwatch.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const baseProps = {
  onSubmit: () => {},
  answer: null,
  submitting: false,
  error: null as ApiError | null,
};

describe('AskPortwatch', () => {
  it('renders inside a BlueprintPanel with the "Ask Portwatch" heading', () => {
    render(<AskPortwatch {...baseProps} />);

    const panel = screen.getByRole('region', { name: 'Ask Portwatch' });
    expect(panel).toHaveClass('blueprint-panel');
    expect(panel).toHaveClass('panel');
    expect(panel).toHaveClass('ask-portwatch');
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Ask Portwatch',
    });
    expect(heading).toHaveClass('panel-header__title', 'ask-portwatch__heading');
    // region is named by the heading (no duplicate aria-label)
    expect(panel).not.toHaveAttribute('aria-label');
    expect(panel.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(panel.querySelector('.panel-header .eyebrow')?.textContent).toBe(
      'Query',
    );
  });

  it('renders the default suggestion chips when the prop is omitted', () => {
    render(<AskPortwatch {...baseProps} />);
    for (const chip of DEFAULT_SUGGESTIONS) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
    expect(DEFAULT_SUGGESTIONS).toEqual([
      "Where's MSC Anna?",
      'Any incidents awaiting approval?',
      "What's blocked by the kill switch?",
    ]);
  });

  it('clicking a chip populates the input and submits once with the chip text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AskPortwatch
        {...baseProps}
        onSubmit={onSubmit}
        selectedIncidentId="inc-42"
      />,
    );

    await user.click(screen.getByRole('button', { name: "Where's MSC Anna?" }));

    expect(screen.getByLabelText('Ask about any incident')).toHaveValue(
      "Where's MSC Anna?",
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Where's MSC Anna?", 'inc-42');
  });

  it('pressing Enter in the input submits once with the trimmed text', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AskPortwatch {...baseProps} onSubmit={onSubmit} />);

    const input = screen.getByLabelText('Ask about any incident');
    await user.type(input, '  where is MSC Anna  {Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('where is MSC Anna', undefined);
  });

  it('clicking "Ask" submits the same way as Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AskPortwatch {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Ask about any incident'), 'status?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('status?', undefined);
  });

  it('does not call onSubmit when the input is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AskPortwatch {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.type(screen.getByLabelText('Ask about any incident'), '   {Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is a no-op and shows "Asking…" while submitting is true', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AskPortwatch {...baseProps} onSubmit={onSubmit} submitting={true} />,
    );

    expect(screen.getByText('Asking…')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Ask about any incident'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(
      screen.getByRole('button', { name: "Where's MSC Anna?" }),
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the input and submit button while submitting, and marks the form aria-busy', () => {
    const { container } = render(
      <AskPortwatch {...baseProps} submitting={true} />,
    );

    expect(screen.getByLabelText('Ask about any incident')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
  });

  it('a chip click while submitting leaves the input value unchanged', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <AskPortwatch {...baseProps} onSubmit={onSubmit} />,
    );

    await user.type(
      screen.getByLabelText('Ask about any incident'),
      'my typed text',
    );

    rerender(
      <AskPortwatch {...baseProps} onSubmit={onSubmit} submitting={true} />,
    );

    await user.click(screen.getByRole('button', { name: "Where's MSC Anna?" }));

    expect(screen.getByLabelText('Ask about any incident')).toHaveValue(
      'my typed text',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders the answer string verbatim in an accent-100 bubble inside an aria-live polite region', () => {
    const answer = 'MSC Anna: berth B3, ETA +90m, awaiting approval.';
    const { container } = render(
      <AskPortwatch {...baseProps} answer={answer} />,
    );

    const region = container.querySelector('.ask-portwatch__answer-region')!;
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');

    const bubble = region.querySelector('.ask-portwatch__answer')!;
    expect(bubble).toHaveTextContent(answer);
  });

  it('renders a no-confident-match answer identically to any other answer', () => {
    const answer = 'No incident matches that vessel.';
    const { container } = render(
      <AskPortwatch {...baseProps} answer={answer} />,
    );

    const bubble = container.querySelector('.ask-portwatch__answer')!;
    expect(bubble).toHaveTextContent(answer);
    expect(container.querySelector('.ask-portwatch__error')).toBeNull();
  });

  it('shows the plain failure line on error and does not present a stale answer as current', () => {
    const { container } = render(
      <AskPortwatch
        {...baseProps}
        answer="stale answer text"
        error={new ApiError('boom')}
      />,
    );

    expect(
      screen.getByText("Couldn't reach Portwatch — try again."),
    ).toBeInTheDocument();
    expect(container.querySelector('.ask-portwatch__answer')).toBeNull();
    expect(screen.queryByText('stale answer text')).not.toBeInTheDocument();
  });

  it('renders nothing in the answer region before the first ask', () => {
    const { container } = render(<AskPortwatch {...baseProps} />);
    const region = container.querySelector('.ask-portwatch__answer-region')!;
    expect(region.textContent).toBe('');
  });

  it('input, submit button, and every chip are focusable via Tab', async () => {
    const user = userEvent.setup();
    render(<AskPortwatch {...baseProps} />);

    await user.tab();
    expect(screen.getByLabelText('Ask about any incident')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Ask' })).toHaveFocus();
    for (const chip of DEFAULT_SUGGESTIONS) {
      await user.tab();
      expect(screen.getByRole('button', { name: chip })).toHaveFocus();
    }
  });
});

// ---------------------------------------------------------------------------
// Static scan of AskPortwatch.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('AskPortwatch.css routes visual values through Story 2.1 tokens', () => {
  it('focus ring: 2px solid var(--accent-700) with an offset, on :focus-visible', () => {
    expect(css).toMatch(
      /:focus-visible\s*\{[^}]*outline\s*:\s*2px\s+solid\s+var\(\s*--accent-700\s*\)/,
    );
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline-offset\s*:/);
  });

  it('answer bubble background is var(--accent-100)', () => {
    expect(css).toMatch(
      /\.ask-portwatch__answer\s*\{[^}]*background\s*:\s*var\(\s*--accent-100\s*\)/,
    );
  });

  it('primary submit button uses var(--accent-700)', () => {
    expect(css).toMatch(
      /\.ask-portwatch__submit\s*\{[^}]*background\s*:\s*var\(\s*--accent-700\s*\)/,
    );
  });

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
});
