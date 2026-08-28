import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GeoMapPanel } from './GeoMapPanel';
import type { Incident, TraceEntry } from '../../types/incident';

/**
 * Story 4.1 — GeoMapPanel component.
 *
 * Covers every I/O & Edge-Case Matrix row. The caption-honesty and SVG-safety
 * assertions are carried verbatim from MapPanel.test.tsx. Token-driven visual
 * values are verified by a static scan of GeoMapPanel.css.
 *
 * With no incident selected, GeoMapPanel falls back to Story 2.7's MapPanel
 * strait schematic (epic-4 context: "retained as the no-incident-selected
 * fallback"), so the NO_INCIDENT cases assert that schematic, not the geo
 * basemap.
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'GeoMapPanel.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

function trace(...stages: Array<[string, TraceEntry['error']?]>): TraceEntry[] {
  return stages.map(([stage, error]) => ({
    stage,
    timestamp: '2026-08-28T00:00:00Z',
    detail: {},
    error: error ?? null,
  }));
}

const EXECUTE_ERROR: TraceEntry['error'] = {
  stage: 'EXECUTE',
  error: 'downstream write failed',
  retried: false,
  fallback_used: false,
};

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    incident_id: 'inc-geo-test',
    status: 'open',
    entity_refs: ['vessel:MSC-ANNA', 'berth:C7', 'crane:CRANE-4'],
    tier: 3,
    confidence: 100,
    recommended_option_id: null,
    options: [],
    approval_status: 'pending',
    blocked_by_kill_switch: false,
    trace: trace(['AGENT_CALL']),
    created_at: '2026-08-28T00:00:00Z',
    last_signal_at: '2026-08-28T00:00:00Z',
    ...overrides,
  };
}

function getPanel(): HTMLElement {
  return screen.getByRole('region', { name: 'Strait Map' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GeoMapPanel — structure & accessibility (incident selected)', () => {
  it('renders one region, heading, exactly one img svg, and the caption in order', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const panel = getPanel();

    expect(panel.tagName).toBe('SECTION');
    expect(panel).toHaveClass('blueprint-panel');
    expect(panel).toHaveClass('geo-map-panel');

    expect(
      within(panel).getByRole('heading', { level: 3, name: 'Strait Map' }),
    ).toBeInTheDocument();

    expect(within(panel).getAllByRole('img')).toHaveLength(1);
    const svg = within(panel).getByRole('img');
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 320 180');
    expect(svg).toHaveAttribute('focusable', 'false');

    const tags = Array.from(panel.children)
      .filter((el) => !el.classList.contains('blueprint-panel__corner'))
      .map((el) => el.tagName.toLowerCase());
    expect(tags).toEqual(['h3', 'svg', 'p']);
  });

  it('the region is named by its own <h3> and carries no aria-label', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const panel = getPanel();
    expect(panel).not.toHaveAttribute('aria-label');
    const labelId = panel.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(within(panel).getByRole('heading', { level: 3 }).id).toBe(labelId);
  });

  it('the svg is described by the caption via aria-describedby', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const panel = getPanel();
    const svg = within(panel).getByRole('img');
    const descId = svg.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    expect(panel.querySelector(`[id="${descId}"]`)).toBe(
      panel.querySelector('.geo-map__caption'),
    );
  });

  it('exposes exactly one img node; decorative shapes are not in the a11y tree', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const svg = getPanel().querySelector('svg') as SVGSVGElement;
    for (const shape of svg.querySelectorAll(
      'rect, line, polyline, polygon, path, circle, g, text',
    )) {
      expect(shape.hasAttribute('aria-label')).toBe(false);
      expect(shape.getAttribute('role')).not.toBe('img');
      expect(Number(shape.getAttribute('tabindex') ?? '-1')).toBeLessThan(0);
    }
  });
});

describe('GeoMapPanel — aria-label sentence', () => {
  it('INCIDENT_SELECTED: full sentence naming each shown entity and its state', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const label = getPanel().querySelector('svg')!.getAttribute('aria-label')!;

    expect(label.endsWith('.')).toBe(true);
    expect(label).toContain('Illustrative');
    expect(label).toContain('not live AIS');
    expect(label).toContain('3 of 3 shown entities');
    expect(label).toContain('vessel:MSC-ANNA (analysing)');
    expect(label).toContain('berth:C7 (analysing)');
  });

  it('unresolvable refs are omitted and counted as "N of M"', () => {
    render(
      <GeoMapPanel
        incident={makeIncident({
          entity_refs: ['vessel:MSC-ANNA', 'berth:C7', 'ghost:NOWHERE'],
        })}
      />,
    );
    const label = getPanel().querySelector('svg')!.getAttribute('aria-label')!;
    expect(label).toContain('2 of 3 shown entities');
    expect(label).not.toContain('ghost:NOWHERE');
    expect(getPanel().querySelectorAll('.geo-map__marker')).toHaveLength(2);
  });

  it('zero resolvable refs: no trailing ": ." — the list is omitted entirely', () => {
    render(
      <GeoMapPanel incident={makeIncident({ entity_refs: ['nope:x'] })} />,
    );
    const label = getPanel().querySelector('svg')!.getAttribute('aria-label')!;
    expect(label).toBe(
      'Illustrative map of the Singapore Strait. Selected incident affects 0 of 1 shown entities. Positions are mock incident state, not live AIS.',
    );
    expect(label).not.toContain(': .');
    expect(getPanel().querySelectorAll('.geo-map__marker')).toHaveLength(0);
  });

  it('empty entity_refs: "0 of 0 shown entities", no throw', () => {
    render(<GeoMapPanel incident={makeIncident({ entity_refs: [] })} />);
    const label = getPanel().querySelector('svg')!.getAttribute('aria-label')!;
    expect(label).toBe(
      'Illustrative map of the Singapore Strait. Selected incident affects 0 of 0 shown entities. Positions are mock incident state, not live AIS.',
    );
  });

  it('a repeated entity ref yields a single marker group and is counted once', () => {
    render(
      <GeoMapPanel
        incident={makeIncident({
          entity_refs: ['vessel:MSC-ANNA', 'vessel:MSC-ANNA'],
        })}
      />,
    );
    expect(getPanel().querySelectorAll('.geo-map__marker')).toHaveLength(1);
    expect(
      getPanel().querySelector('svg')!.getAttribute('aria-label'),
    ).toContain('1 of 1 shown entities');
  });

  it('a bare-colon ref does not throw and is treated as unresolvable', () => {
    render(<GeoMapPanel incident={makeIncident({ entity_refs: ['vessel:'] })} />);
    expect(
      getPanel().querySelector('svg')!.getAttribute('aria-label'),
    ).toContain('0 of 1 shown entities');
  });
});

describe('GeoMapPanel — caption honesty (carried from MapPanel.test.tsx)', () => {
  it('incident-selected caption: illustrative + not live AIS + mock incident state, no real-time wording', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const text = getPanel().querySelector('.geo-map__caption')!.textContent ?? '';

    expect(text.toLowerCase()).toContain('illustrative');
    expect(text.toLowerCase()).toContain('not live ais');
    expect(text.toLowerCase()).toContain('mock incident state');
    expect(text).not.toMatch(/real-time|live positions|tracking|current location/i);
    expect(text).not.toMatch(/[!]|\p{Extended_Pictographic}/u);
  });

  it('no-incident fallback caption: illustrative + not live AIS, no real-time wording', () => {
    render(<GeoMapPanel incident={null} />);
    const text =
      getPanel().querySelector('.map-panel__caption')!.textContent ?? '';

    expect(text.toLowerCase()).toContain('illustrative');
    expect(text.toLowerCase()).toContain('not live ais');
    expect(text).not.toMatch(/real-time|live positions|tracking|current location/i);
    expect(text).not.toMatch(/[!]|\p{Extended_Pictographic}/u);
  });
});

describe('GeoMapPanel — markers', () => {
  it('INCIDENT_SELECTED: one marker group per resolvable ref, each with a <text>, shapes differ by kind', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    const markers = getPanel().querySelectorAll('.geo-map__marker');
    expect(markers).toHaveLength(3);

    const shapeTags = new Set<string>();
    for (const marker of markers) {
      expect(marker.querySelector('text.geo-map__label')).toBeTruthy();
      const shape = marker.querySelector('.geo-map__shape');
      expect(shape).toBeTruthy();
      shapeTags.add(shape!.tagName.toLowerCase());
    }
    // vessel -> circle, berth -> rect, crane -> polygon
    expect(shapeTags.size).toBeGreaterThan(1);
    expect(shapeTags.has('circle')).toBe(true);
    expect(shapeTags.has('polygon')).toBe(true);
  });

  it('never emits a NaN coordinate on any marker shape', () => {
    render(<GeoMapPanel incident={makeIncident()} />);
    for (const el of getPanel().querySelectorAll('.geo-map__shape')) {
      for (const name of ['cx', 'cy', 'x', 'y', 'width', 'height', 'points']) {
        const v = el.getAttribute(name);
        if (v != null) expect(v).not.toMatch(/NaN/i);
      }
    }
  });

  it('TRACE_ADVANCES: a later stage changes the marker state label; coordinates unchanged', () => {
    const { rerender } = render(
      <GeoMapPanel incident={makeIncident({ trace: trace(['AGENT_CALL']) })} />,
    );
    const labelBefore = getPanel().querySelector('text.geo-map__label')!.textContent;
    expect(labelBefore).toMatch(/analysing$/);
    const cxBefore = (
      getPanel().querySelector('.geo-map__marker circle') as SVGCircleElement
    ).getAttribute('cx');

    rerender(
      <GeoMapPanel incident={makeIncident({ trace: trace(['EXECUTE']) })} />,
    );
    const labelAfter = getPanel().querySelector('text.geo-map__label')!.textContent;
    expect(labelAfter).toMatch(/action applied$/);
    expect(labelAfter).not.toBe(labelBefore);
    expect(
      (getPanel().querySelector('.geo-map__marker circle') as SVGCircleElement).getAttribute(
        'cx',
      ),
    ).toBe(cxBefore);
  });

  it.each([
    { name: 'AGENT_CALL', tr: trace(['AGENT_CALL']), word: 'analysing' },
    { name: 'SYNTHESIZE', tr: trace(['SYNTHESIZE']), word: 'analysing' },
    { name: 'CONFIDENCE', tr: trace(['CONFIDENCE']), word: 'deciding' },
    { name: 'POLICY_DECISION', tr: trace(['POLICY_DECISION']), word: 'deciding' },
    { name: 'DG_CHECK', tr: trace(['DG_CHECK']), word: 'deciding' },
    { name: 'APPROVAL', tr: trace(['APPROVAL']), word: 'blocked' },
    { name: 'EXECUTE ok', tr: trace(['EXECUTE']), word: 'action applied' },
    { name: 'EXECUTE error', tr: trace(['EXECUTE', EXECUTE_ERROR]), word: 'blocked' },
    { name: 'VERIFY', tr: trace(['VERIFY']), word: 'done' },
    { name: 'CORRELATE', tr: trace(['CORRELATE']), word: 'pending' },
    { name: 'empty trace', tr: [] as TraceEntry[], word: 'pending' },
  ])('stage $name maps the marker state to "$word"', ({ tr, word }) => {
    render(<GeoMapPanel incident={makeIncident({ trace: tr })} />);
    const label = getPanel().querySelector('text.geo-map__label')!.textContent ?? '';
    expect(label.endsWith(word)).toBe(true);
    expect(
      getPanel().querySelector('svg')!.getAttribute('aria-label'),
    ).toContain(`(${word})`);
  });

  it('EXECUTE with an error also flips the marker state class to --blocked', () => {
    render(
      <GeoMapPanel
        incident={makeIncident({ trace: trace(['EXECUTE', EXECUTE_ERROR]) })}
      />,
    );
    for (const marker of getPanel().querySelectorAll('.geo-map__marker')) {
      expect(marker.classList.contains('geo-map__marker--blocked')).toBe(true);
    }
  });
});

describe('GeoMapPanel — NO_INCIDENT falls back to the MapPanel schematic', () => {
  it('renders the Story 2.7 strait schematic: heading, its caption, zero geo markers', () => {
    render(<GeoMapPanel incident={null} />);
    const panel = getPanel();

    expect(panel).toHaveClass('map-panel');
    expect(panel).not.toHaveClass('geo-map-panel');
    expect(
      within(panel).getByRole('heading', { level: 3, name: 'Strait Map' }),
    ).toBeInTheDocument();
    expect(panel.querySelector('.map-panel__caption')).toBeInTheDocument();

    // Degraded-safe: a map with no incident markers, still exactly one img.
    expect(panel.querySelectorAll('.geo-map__land')).toHaveLength(0);
    expect(panel.querySelectorAll('.geo-map__marker')).toHaveLength(0);
    expect(within(panel).getAllByRole('img')).toHaveLength(1);
    expect(within(panel).queryByRole('button')).toBeNull();
  });

  it('passes an extra className through to the fallback', () => {
    render(<GeoMapPanel incident={null} className="x" />);
    expect(getPanel()).toHaveClass('map-panel', 'x');
  });
});

describe('GeoMapPanel — NETWORK_SILENT', () => {
  it('never calls fetch on mount', () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch');
    const windowFetch = vi.spyOn(window, 'fetch');
    render(<GeoMapPanel incident={makeIncident()} />);

    expect(getPanel().querySelectorAll('.geo-map__land').length).toBeGreaterThan(0);
    expect(globalFetch).not.toHaveBeenCalled();
    expect(windowFetch).not.toHaveBeenCalled();
  });
});

describe('GeoMapPanel — read-only SVG safety (carried from MapPanel.test.tsx)', () => {
  it('no script/image/use, no href, no on* attribute, no button, no positive tabindex', () => {
    const { container } = render(<GeoMapPanel incident={makeIncident()} />);
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

    const panel = getPanel();
    expect(panel.querySelectorAll('button')).toHaveLength(0);
    expect(within(panel).queryByRole('button')).toBeNull();
    const focusables = Array.from(panel.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > -1,
    );
    expect(focusables).toHaveLength(0);
  });

  it('passes an extra className through; whitespace-only className emits no blank token', () => {
    const { rerender } = render(
      <GeoMapPanel incident={makeIncident()} className="x" />,
    );
    expect(getPanel()).toHaveClass('blueprint-panel', 'geo-map-panel', 'x');

    rerender(<GeoMapPanel incident={makeIncident()} className="   " />);
    expect(getPanel().className).toBe('blueprint-panel geo-map-panel');
  });
});

// ---------------------------------------------------------------------------
// Static scan of GeoMapPanel.css — token-driven visual values
// ---------------------------------------------------------------------------
describe('GeoMapPanel.css routes visual values through Story 2.1 tokens', () => {
  it('contains no raw hex colour and no named CSS colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/:\s*(?:red|blue|green|black|white|gray|grey)\b/);
  });

  it('every colour value is a var(--*) token, currentColor, or none', () => {
    const colourProps = [
      ...css.matchAll(
        /(?:^|[;{])\s*(?:color|fill|stroke|background(?:-color)?)\s*:\s*([^;}]+)/g,
      ),
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

  it('gives every marker state a distinguishing stroke rule (not hue alone)', () => {
    for (const state of [
      'pending',
      'analysing',
      'deciding',
      'applied',
      'blocked',
      'done',
    ]) {
      expect(css).toMatch(
        new RegExp(`\\.geo-map__marker--${state} \\.geo-map__shape\\s*\\{`),
      );
    }
  });

  it('the caption font-size routes through a token, not a raw px literal', () => {
    expect(css).toMatch(
      /\.geo-map__caption\s*\{[^}]*font-size\s*:\s*var\(\s*--font-size-micro-label\s*\)/,
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
