import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MapPanel } from './MapPanel';

/**
 * Story 2.7 — MapPanel component.
 *
 * Covers every I/O & Edge-Case Matrix row. Token-driven visual values are
 * verified by a static scan of MapPanel.css — jsdom does not resolve stylesheet
 * var() cascades.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'MapPanel.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const VARIANTS = ['strait', 'yard'] as const;
const HEADING_TEXT = { strait: 'Strait Map', yard: 'Yard Plan' } as const;

function getPanelByHeading(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('MapPanel', () => {
  it('default variant renders the strait region, heading, one img svg, and the caption', () => {
    render(<MapPanel />);

    const panel = getPanelByHeading('Strait Map');
    expect(panel.tagName).toBe('SECTION');
    expect(panel).toHaveClass('blueprint-panel');
    expect(panel).toHaveClass('map-panel');

    expect(
      within(panel).getByRole('heading', { level: 3, name: 'Strait Map' }),
    ).toBeInTheDocument();

    const img = within(panel).getByRole('img');
    expect(img.tagName.toLowerCase()).toBe('svg');
    expect(img).toHaveAttribute('aria-label', 'Illustrative schematic of the strait approach');
    expect(img).toHaveAttribute('viewBox', '0 0 320 180');
    expect(img).toHaveAttribute('focusable', 'false');

    expect(panel.querySelector('.map-panel__caption')).toBeInTheDocument();
  });

  it('yard variant renders the "Yard Plan" heading and a yard-scene svg aria-label', () => {
    render(<MapPanel variant="yard" />);

    const panel = getPanelByHeading('Yard Plan');
    expect(
      within(panel).getByRole('heading', { level: 3, name: 'Yard Plan' }),
    ).toBeInTheDocument();

    const img = within(panel).getByRole('img');
    expect(img).toHaveAttribute('aria-label', 'Illustrative schematic of the terminal yard');
    expect(img.getAttribute('aria-label')).toMatch(/yard/i);
  });

  it.each(VARIANTS)(
    'the %s region is named by its own <h3> heading and carries no aria-label',
    (variant) => {
      render(<MapPanel variant={variant} />);
      const panel = getPanelByHeading(HEADING_TEXT[variant]);

      expect(panel).not.toHaveAttribute('aria-label');
      const labelId = panel.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const heading = within(panel).getByRole('heading', { level: 3 });
      expect(heading.id).toBe(labelId);
      expect(heading.textContent).toBe(HEADING_TEXT[variant]);
    },
  );

  it.each(VARIANTS)(
    'the %s svg is described by the caption element via aria-describedby',
    (variant) => {
      render(<MapPanel variant={variant} />);
      const panel = getPanelByHeading(HEADING_TEXT[variant]);
      const svg = within(panel).getByRole('img');

      const descId = svg.getAttribute('aria-describedby');
      expect(descId).toBeTruthy();
      const described = panel.querySelector(`[id="${descId}"]`);
      expect(described).toBe(panel.querySelector('.map-panel__caption'));
      expect((described as HTMLElement).textContent?.toLowerCase()).toContain('not live ais');
    },
  );

  it('renders children in order: heading, then svg, then caption', () => {
    render(<MapPanel />);
    const panel = getPanelByHeading('Strait Map');
    const tags = Array.from(panel.children)
      .filter((el) => !el.classList.contains('blueprint-panel__corner'))
      .map((el) => el.tagName.toLowerCase());
    expect(tags).toEqual(['h3', 'svg', 'p']);
  });

  it.each(VARIANTS)(
    'caption for the %s variant is honest: illustrative + not live AIS, no real-time wording',
    (variant) => {
      render(<MapPanel variant={variant} />);
      const caption = getPanelByHeading(HEADING_TEXT[variant]).querySelector(
        '.map-panel__caption',
      ) as HTMLElement;
      const text = caption.textContent ?? '';

      expect(text.toLowerCase()).toContain('illustrative');
      expect(text.toLowerCase()).toContain('not live ais');
      expect(text).not.toMatch(/real-time|live positions|tracking|current location/i);
      expect(text).not.toMatch(/[!]|\p{Extended_Pictographic}/u);
    },
  );

  it.each(VARIANTS)('the %s variant is read-only: no button, no positive tabindex', (variant) => {
    render(<MapPanel variant={variant} />);
    const panel = getPanelByHeading(HEADING_TEXT[variant]);

    expect(panel.querySelectorAll('button')).toHaveLength(0);
    expect(within(panel).queryByRole('button')).toBeNull();

    const focusables = Array.from(panel.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > -1,
    );
    expect(focusables).toHaveLength(0);

    expect(within(panel).getByRole('img')).toHaveAttribute('focusable', 'false');
  });

  it.each(VARIANTS)(
    'the %s variant exposes exactly one img node; decorative shapes are not in the a11y tree',
    (variant) => {
      render(<MapPanel variant={variant} />);
      const panel = getPanelByHeading(HEADING_TEXT[variant]);
      expect(within(panel).getAllByRole('img')).toHaveLength(1);

      const svg = within(panel).getByRole('img');
      for (const shape of svg.querySelectorAll(
        'rect, line, polyline, polygon, path, circle, g',
      )) {
        expect(shape.hasAttribute('aria-label')).toBe(false);
        expect(shape.getAttribute('role')).not.toBe('img');
        expect(Number(shape.getAttribute('tabindex') ?? '-1')).toBeLessThan(0);
      }
    },
  );

  it.each(VARIANTS)(
    'the %s svg markup has no external references or scripting',
    (variant) => {
      const { container } = render(<MapPanel variant={variant} />);
      const svg = container.querySelector('svg') as SVGSVGElement;
      const markup = svg.outerHTML;

      expect(markup).not.toMatch(/<script/i);
      expect(markup).not.toMatch(/href/i);
      expect(markup).not.toMatch(/<image/i);
      expect(markup).not.toMatch(/<use/i);
      expect(svg.querySelectorAll('script, image, use')).toHaveLength(0);
      for (const el of svg.querySelectorAll('*')) {
        for (const attr of el.getAttributeNames()) {
          expect(attr.startsWith('on')).toBe(false);
        }
      }
    },
  );

  it('the two variants draw distinguishing geometry', () => {
    const { unmount } = render(<MapPanel variant="strait" />);
    const straitSvg = screen.getByRole('img');
    expect(straitSvg.querySelectorAll('.map-panel__water').length).toBeGreaterThan(0);
    expect(straitSvg.querySelectorAll('.map-panel__ship').length).toBe(3);
    expect(straitSvg.querySelectorAll('.map-panel__yard-block').length).toBe(0);
    unmount();

    render(<MapPanel variant="yard" />);
    const yardSvg = screen.getByRole('img');
    // 5 columns x 3 rows of yard blocks
    expect(yardSvg.querySelectorAll('.map-panel__yard-block').length).toBe(15);
    expect(yardSvg.querySelectorAll('.map-panel__crane').length).toBe(3);
    expect(yardSvg.querySelectorAll('.map-panel__water').length).toBe(0);
    expect(yardSvg.querySelectorAll('.map-panel__ship').length).toBe(0);
  });

  it('passes an extra className through to the panel root', () => {
    render(<MapPanel className="x" />);
    const panel = getPanelByHeading('Strait Map');
    expect(panel).toHaveClass('blueprint-panel');
    expect(panel).toHaveClass('map-panel');
    expect(panel).toHaveClass('x');
  });

  it('a whitespace-only className does not emit blank class tokens', () => {
    render(<MapPanel className="   " />);
    const panel = getPanelByHeading('Strait Map');
    expect(panel.className).toBe('blueprint-panel map-panel');
  });
});

// ---------------------------------------------------------------------------
// Static scan of MapPanel.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('MapPanel.css routes visual values through Story 2.1 tokens', () => {
  it('contains no raw hex colour and no named CSS colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/:\s*(?:red|blue|green|black|white|gray|grey)\b/);
  });

  it('every colour value is a var(--*) token or currentColor', () => {
    const colourProps = [
      ...css.matchAll(/(?:^|[;{])\s*(?:color|fill|stroke|background(?:-color)?)\s*:\s*([^;}]+)/g),
    ].map((m) => m[1].trim());
    expect(colourProps.length).toBeGreaterThan(0);
    for (const value of colourProps) {
      expect(
        value === 'none' ||
          value === 'currentColor' ||
          /^var\(--[a-z0-9-]+\)$/.test(value),
      ).toBe(true);
    }
  });

  it('the caption font-size routes through a token, not a raw px literal', () => {
    expect(css).toMatch(
      /\.map-panel__caption\s*\{[^}]*font-size\s*:\s*var\(\s*--font-size-micro-label\s*\)/,
    );
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
