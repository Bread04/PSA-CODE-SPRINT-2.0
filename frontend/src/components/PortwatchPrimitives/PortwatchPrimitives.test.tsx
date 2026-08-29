import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Anchor } from 'lucide-react';

import {
  Panel,
  PanelHeader,
  SectionHeading,
  StatusPill,
  MetricCard,
  SignalTag,
  TinySparkline,
  CornerMark,
  RailButton,
  LinkButton,
  CountdownBar,
  EmptyState,
} from './index';

/**
 * PortwatchPrimitives — Harbor Signal instrument primitives ported verbatim
 * from `frontend/portwatch-tuas/client/src/components/PortwatchPrimitives.tsx`
 * (spec-portwatch-tuas-chrome).
 *
 * Each primitive renders with its portwatch class names; the `signal-{tone}`
 * tone classes set only `color` (static scan of PortwatchPrimitives.css).
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, 'PortwatchPrimitives.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('portwatch class names', () => {
  it('Panel renders a <section class="panel">; onClick makes it a button', () => {
    const { rerender, container } = render(<Panel>body</Panel>);
    const plain = container.querySelector('section.panel')!;
    expect(plain).toBeInTheDocument();
    expect(plain).not.toHaveClass('panel-interactive');
    expect(plain).not.toHaveAttribute('role');

    rerender(
      <Panel accent onClick={() => {}}>
        body
      </Panel>,
    );
    const interactive = container.querySelector('section.panel')!;
    expect(interactive).toHaveClass('panel-accent');
    expect(interactive).toHaveClass('panel-interactive');
    expect(interactive).toHaveAttribute('role', 'button');
    expect(interactive).toHaveAttribute('tabindex', '0');
  });

  it('PanelHeader emits <div.panel-header> > .eyebrow + <h{level} class="panel-header__title">', () => {
    const { rerender } = render(
      <PanelHeader
        eyebrow="FEED"
        title="Incidents"
        titleId="feed-h"
        titleClassName="incident-feed__title"
      />,
    );
    const header = document.querySelector('div.panel-header')!;
    expect(header).toBeInTheDocument();
    expect(header.querySelector('.eyebrow')?.textContent).toBe('FEED');
    const h3 = screen.getByRole('heading', { level: 3, name: 'Incidents' });
    expect(h3).toHaveClass('panel-header__title', 'incident-feed__title');
    expect(h3.id).toBe('feed-h');

    // level prop keeps the outline monotonic for a nested panel
    rerender(<PanelHeader eyebrow="DECISION" title="Approval needed" level={4} />);
    expect(
      screen.getByRole('heading', { level: 4, name: 'Approval needed' }),
    ).toHaveClass('panel-header__title');
  });

  it('SectionHeading emits .section-heading > .eyebrow + <h2 class="section-heading__title">', () => {
    render(
      <SectionHeading
        eyebrow="ORCHESTRA"
        title="Agent Roster"
        detail="Parallel specialist fan-out"
        titleClassName="agent-roster__heading"
      />,
    );
    const container = document.querySelector('.section-heading')!;
    expect(container).toBeInTheDocument();
    expect(container.querySelector('.eyebrow')?.textContent).toBe('ORCHESTRA');
    const h2 = screen.getByRole('heading', { level: 2, name: 'Agent Roster' });
    expect(h2).toHaveClass('section-heading__title');
    expect(h2).toHaveClass('agent-roster__heading');
    expect(
      container.querySelector('.section-heading__detail')?.textContent,
    ).toBe('Parallel specialist fan-out');
  });

  it('StatusPill renders .status-pill + .status-dot; pulse adds .pulse', () => {
    const { container } = render(
      <StatusPill tone="teal" pulse>
        LIVE
      </StatusPill>,
    );
    const pill = container.querySelector('.status-pill')!;
    expect(pill).toHaveClass('signal-teal');
    expect(pill.querySelector('.status-dot.pulse')).toBeInTheDocument();
  });

  it('MetricCard renders .metric-card / .metric-label / .metric-value-line', () => {
    const { container } = render(
      <MetricCard label="YARD UTIL" value="82" suffix="%" icon={Anchor} note="watch" />,
    );
    expect(container.querySelector('.metric-card')).toHaveClass('signal-teal');
    expect(container.querySelector('.metric-label')?.textContent).toBe('YARD UTIL');
    expect(container.querySelector('.metric-value-line strong')?.textContent).toBe('82');
  });

  it('SignalTag renders .signal-tag with a tone class', () => {
    const { container } = render(<SignalTag label="DEGRADED" tone="amber" icon="alert" />);
    expect(container.querySelector('.signal-tag')).toHaveClass('signal-amber');
    expect(container.querySelector('.signal-tag')?.textContent).toContain('DEGRADED');
  });

  it('TinySparkline renders an svg.tiny-sparkline with a .spark-fill polyline', () => {
    const { container } = render(<TinySparkline points={[1, 4, 2, 8, 3]} tone="green" />);
    const svg = container.querySelector('svg.tiny-sparkline')!;
    expect(svg).toHaveClass('signal-green');
    expect(svg.querySelector('polyline.spark-fill')).toBeInTheDocument();
  });

  it('CornerMark renders span.corner-mark, aria-hidden', () => {
    const { container } = render(<CornerMark />);
    const mark = container.querySelector('.corner-mark')!;
    expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  it('RailButton renders button.rail-button; active adds .active; badge renders <b>', () => {
    const { container } = render(
      <RailButton active icon={Anchor} label="Live Console" onClick={() => {}} badge="3" />,
    );
    const btn = container.querySelector('button.rail-button')!;
    expect(btn).toHaveClass('active');
    expect(btn).toHaveAttribute('aria-label', 'Live Console');
    expect(btn.querySelector('b')?.textContent).toBe('3');
  });

  it('LinkButton renders button.link-button with the tone class', () => {
    const { container } = render(<LinkButton tone="solid">Open</LinkButton>);
    expect(container.querySelector('button.link-button')).toHaveClass('solid');
  });

  it('CountdownBar renders .countdown-track > .countdown-fill with a clamped width', () => {
    const { container } = render(<CountdownBar percent={140} />);
    expect(container.querySelector('.countdown-track')).toHaveClass('signal-amber');
    const fill = container.querySelector('.countdown-fill') as HTMLElement;
    // clamped to 100% and carried on the --countdown-fill-width fallback slot
    expect(fill.getAttribute('style')).toContain('100%');
  });

  it('EmptyState renders .empty-state with the ∕∕ .empty-mark', () => {
    render(<EmptyState title="No active incidents" detail="Live feeds nominal" />);
    expect(document.querySelector('.empty-state .empty-mark')?.textContent).toBe('∕∕');
    expect(screen.getByText('No active incidents')).toBeInTheDocument();
  });
});

describe('tone classes set only color (static scan of PortwatchPrimitives.css)', () => {
  const toneRules = [
    ...css.matchAll(/\.signal-(teal|green|amber|red|slate)\s*(?:,\s*\.signal-\w+\s*)*\{([^}]*)\}/g),
  ];

  it('every signal-* rule declares color and nothing else', () => {
    expect(toneRules.length).toBeGreaterThan(0);
    for (const [, , bodyRaw] of toneRules) {
      const decls = bodyRaw
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean);
      for (const decl of decls) {
        expect(decl.split(':')[0].trim(), `tone rule declares "${decl}"`).toBe('color');
      }
    }
  });

  it('contains no raw hex color literal', () => {
    expect(css.match(/#[0-9a-f]{3,8}\b/i)).toBeNull();
  });
});
