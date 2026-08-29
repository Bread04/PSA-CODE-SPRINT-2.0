import { createRef } from 'react';
import type { CSSProperties, ComponentPropsWithoutRef, ElementType } from 'react';
import { describe, it, expect, vi, expectTypeOf } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import the VALUE from the public barrel (the entry stories 2.3–2.9 consume),
// so the re-export is exercised too.
import { BlueprintPanel } from './index';
import type { BlueprintPanelProps } from './index';

/**
 * BlueprintPanel — re-implemented to portwatch-tuas's `.panel`
 * (spec-portwatch-tuas-chrome).
 *
 * The DOM/behaviour contract is preserved (the `as` prop, ref forwarding,
 * className / style merge, arbitrary-prop + onClick forwarding, the padding
 * override hook, empty render). The static CSS-scan assertions are rewritten to
 * the new treatment: ONE `::before` seafoam L-bracket + ONE `.corner-mark` ⌐
 * (not four `.blueprint-panel__corner` spans).
 */

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const cssText = readFileSync(join(HERE, 'BlueprintPanel.css'), 'utf8');
const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');

const designMdPath = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
  '_bmad-output',
  'planning-artifacts',
  'ux-designs',
  'ux-PSA CODE SPRINT-2026-08-29',
  'DESIGN.md',
);

/** Extract the `components.panel` map from the Harbor Signal DESIGN.md. */
function parsePanelSpec(md: string): Record<string, string> {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) throw new Error(`DESIGN.md front-matter not found at ${designMdPath}`);
  const lines = fm[1].split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s{2,}panel:\s*$/.test(l));
  if (start === -1) {
    throw new Error('components.panel not found in DESIGN.md front-matter');
  }
  const baseIndent = lines[start].length - lines[start].trimStart().length;
  const spec: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const indent = lines[i].length - lines[i].trimStart().length;
    if (indent <= baseIndent) break;
    const m = lines[i].trim().match(/^([\w-]+):\s*(.+?)\s*$/);
    if (m) spec[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return spec;
}

const dmSpec = parsePanelSpec(readFileSync(designMdPath, 'utf8'));

// ---------------------------------------------------------------------------
// Row: Default render
// ---------------------------------------------------------------------------
describe('default render', () => {
  it('renders children inside a root <div> carrying the blueprint-panel + panel classes', () => {
    render(<BlueprintPanel>hello</BlueprintPanel>);
    const child = screen.getByText('hello');
    expect(child.tagName).toBe('DIV');
    expect(child).toHaveClass('blueprint-panel');
    expect(child).toHaveClass('panel');
  });

  it('renders exactly one corner mark — the bottom-right ⌐ — aria-hidden, and no legacy corner spans', () => {
    const { container } = render(<BlueprintPanel>x</BlueprintPanel>);
    const marks = container.querySelectorAll('.corner-mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.blueprint-panel__corner')).toHaveLength(0);
  });

  it('renders the corner mark AFTER children in DOM order', () => {
    const { container } = render(
      <BlueprintPanel>
        <span data-testid="kid">kid</span>
      </BlueprintPanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    const kids = [...root.children];
    const kidIndex = kids.findIndex(
      (el) => el.getAttribute('data-testid') === 'kid',
    );
    const markIndex = kids.findIndex((el) =>
      el.classList.contains('corner-mark'),
    );
    expect(kidIndex).toBe(0);
    expect(markIndex).toBeGreaterThan(kidIndex);
    expect(kids.at(-1)?.className).toBe('corner-mark');
  });

  it('the corner mark and the ::before bracket declare pointer-events:none in the stylesheet', () => {
    expect(css).toMatch(/\.corner-mark\s*\{[^}]*pointer-events\s*:\s*none/);
    expect(css).toMatch(
      /\.blueprint-panel::before,\s*\.panel::before\s*\{[^}]*pointer-events\s*:\s*none/,
    );
  });

  it('a click on panel content still reaches the content handler', async () => {
    const user = userEvent.setup();
    const onContent = vi.fn();
    render(
      <BlueprintPanel>
        <button type="button" onClick={onContent}>
          act
        </button>
      </BlueprintPanel>,
    );
    await user.click(screen.getByRole('button', { name: 'act' }));
    expect(onContent).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Row: Token-driven styling — static assertions over BlueprintPanel.css,
// rewritten to portwatch's `.panel` treatment.
// ---------------------------------------------------------------------------
describe('token-driven styling (static scan of BlueprintPanel.css)', () => {
  it('the panel box routes border / radius / background / overflow through tokens', () => {
    expect(css).toMatch(
      /\.blueprint-panel,\s*\.panel\s*\{[^}]*background:\s*var\(\s*--panel-bg\s*\)/,
    );
    expect(css).toMatch(
      /\.blueprint-panel,\s*\.panel\s*\{[^}]*border:\s*1px\s+solid\s+var\(\s*--panel-border\s*\)/,
    );
    expect(css).toMatch(
      /\.blueprint-panel,\s*\.panel\s*\{[^}]*border-radius:\s*var\(\s*--radius-md\s*\)/,
    );
    expect(css).toMatch(
      /\.blueprint-panel,\s*\.panel\s*\{[^}]*overflow:\s*hidden/,
    );
    expect(css).toMatch(/position:\s*relative/);
  });

  it('keeps the caller padding override hook with the --space-4 default', () => {
    expect(css).toMatch(
      /padding\s*:\s*var\(\s*--blueprint-panel-padding\s*,\s*var\(\s*--space-4\s*\)\s*\)\s*;/,
    );
  });

  it('draws ONE 18px seafoam L-bracket on ::before via --panel-bracket', () => {
    expect(css).toMatch(
      /::before\s*\{[^}]*width\s*:\s*18px\s*;[^}]*height\s*:\s*18px\s*;/,
    );
    expect(css).toMatch(
      /::before\s*\{[^}]*border-top\s*:\s*1px\s+solid\s+var\(\s*--panel-bracket\s*\)/,
    );
    expect(css).toMatch(
      /::before\s*\{[^}]*border-left\s*:\s*1px\s+solid\s+var\(\s*--panel-bracket\s*\)/,
    );
  });

  it('the single .corner-mark is a 9px seafoam ⌐ via --corner-mark-border', () => {
    expect(css).toMatch(
      /\.corner-mark\s*\{[^}]*width\s*:\s*9px\s*;[^}]*height\s*:\s*9px\s*;/,
    );
    expect(css).toMatch(
      /\.corner-mark\s*\{[^}]*border-right\s*:\s*1px\s+solid\s+var\(\s*--corner-mark-border\s*\)/,
    );
    expect(css).toMatch(
      /\.corner-mark\s*\{[^}]*border-bottom\s*:\s*1px\s+solid\s+var\(\s*--corner-mark-border\s*\)/,
    );
    // The 4-corner crosshair treatment is gone.
    expect(css).not.toMatch(/\.blueprint-panel__corner/);
  });

  it('contains no ad hoc hex color; every border-radius routes through a radius token', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)].map((m) =>
      m[1].trim(),
    );
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) expect(r).toMatch(/^var\(--radius-[a-z-]+\)$/);
  });
});

// ---------------------------------------------------------------------------
// DESIGN.md conformance: BlueprintPanel.css implements components.panel.
// ---------------------------------------------------------------------------
describe('BlueprintPanel.css conforms to Harbor Signal DESIGN.md components.panel', () => {
  it('DESIGN.md declares the panel contract this CSS implements', () => {
    expect(dmSpec.radius).toBe('8');
    expect(dmSpec.border).toBe('1px solid {colors.border}');
    expect(dmSpec.cornerBracket).toMatch(/seafoam L-bracket, top-left, 18px/);
    expect(dmSpec.cornerMark).toMatch(/seafoam corner, bottom-right, 9px/);
  });

  it('radius resolves to the DESIGN.md panel radius (8px) via --radius-md', () => {
    expect(dmSpec.radius).toBe('8');
    expect(css).toMatch(/border-radius\s*:\s*var\(\s*--radius-md\s*\)\s*;/);
  });

  it('the corner bracket is 18px, matching DESIGN.md cornerBracket', () => {
    const size = dmSpec.cornerBracket.match(/(\d+)px\s*$/)![1];
    expect(size).toBe('18');
    expect(css).toMatch(new RegExp(`::before\\s*\\{[^}]*width\\s*:\\s*${size}px\\s*;`));
  });

  it('the corner mark is 9px, matching DESIGN.md cornerMark', () => {
    const size = dmSpec.cornerMark.match(/bottom-right,\s*(\d+)px/)![1];
    expect(size).toBe('9');
    expect(css).toMatch(
      new RegExp(`\\.corner-mark\\s*\\{[^}]*width\\s*:\\s*${size}px\\s*;`),
    );
  });
});

// ---------------------------------------------------------------------------
// Row: `as` override
// ---------------------------------------------------------------------------
describe('`as` override', () => {
  it('selects the root element and keeps the classes + spread props', () => {
    render(
      <BlueprintPanel as="section" aria-label="Trace">
        body
      </BlueprintPanel>,
    );
    const root = screen.getByLabelText('Trace');
    expect(root.tagName).toBe('SECTION');
    expect(root).toHaveClass('blueprint-panel');
    expect(root).toHaveClass('panel');
    expect(root.querySelectorAll('.corner-mark')).toHaveLength(1);
  });

  it('forwards the ref to the root even when `as` overrides the tag', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <BlueprintPanel as="section" ref={ref}>
        r
      </BlueprintPanel>,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('SECTION');
  });
});

// ---------------------------------------------------------------------------
// Row: className / style merge
// ---------------------------------------------------------------------------
describe('className / style merge', () => {
  it('root carries blueprint-panel, panel, and the caller className', () => {
    const { container } = render(
      <BlueprintPanel className="feed-row">c</BlueprintPanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('blueprint-panel');
    expect(root).toHaveClass('panel');
    expect(root).toHaveClass('feed-row');
  });

  it('caller inline style is applied to the root', () => {
    const { container } = render(
      <BlueprintPanel style={{ marginTop: 4 }}>c</BlueprintPanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.marginTop).toBe('4px');
  });
});

// ---------------------------------------------------------------------------
// Row: Prop forwarding
// ---------------------------------------------------------------------------
describe('prop forwarding', () => {
  it('spreads role / data-* onto the root and fires onClick exactly once', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <BlueprintPanel role="log" data-incident="x" onClick={onClick}>
        hit
      </BlueprintPanel>,
    );
    const root = screen.getByRole('log');
    expect(root).toHaveAttribute('data-incident', 'x');
    await user.click(root);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Row: Ref forwarding
// ---------------------------------------------------------------------------
describe('ref forwarding', () => {
  it('resolves the ref to the rendered root DOM node', () => {
    const ref = createRef<HTMLDivElement>();
    render(<BlueprintPanel ref={ref}>r</BlueprintPanel>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current).toHaveClass('blueprint-panel');
  });
});

// ---------------------------------------------------------------------------
// Row: Padding override
// ---------------------------------------------------------------------------
describe('padding override', () => {
  it('accepts the --blueprint-panel-padding custom property on the root', () => {
    const { container } = render(
      <BlueprintPanel
        style={{ '--blueprint-panel-padding': '2px' } as CSSProperties}
      >
        p
      </BlueprintPanel>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--blueprint-panel-padding')).toBe('2px');
  });

  it('the stylesheet consumes the override with the --space-4 default as fallback', () => {
    expect(css).toMatch(
      /padding\s*:\s*var\(\s*--blueprint-panel-padding\s*,\s*var\(\s*--space-4\s*\)\s*\)\s*;/,
    );
  });
});

// ---------------------------------------------------------------------------
// Row: No children
// ---------------------------------------------------------------------------
describe('no children', () => {
  it('renders the bordered box with one corner mark and no content, without throwing', () => {
    const { container } = render(<BlueprintPanel />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('blueprint-panel');
    expect(root.querySelectorAll('.corner-mark')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Type surface
// ---------------------------------------------------------------------------
describe('props type', () => {
  it('makes `as` optional and accepts intrinsic div props', () => {
    expectTypeOf<BlueprintPanelProps>().toHaveProperty('as');
    expectTypeOf<BlueprintPanelProps['as']>().toEqualTypeOf<
      ElementType | undefined
    >();
    expectTypeOf<ComponentPropsWithoutRef<'div'>>().toExtend<BlueprintPanelProps>();
  });
});
