import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from './tokens';

/**
 * Story 2.1 — Design Token System contract enforcer.
 *
 * The baseline is the REAL DESIGN.md front-matter (parsed at test time), not a
 * hand-transcribed copy — a transcription typo in tokens.ts / tokens.css now
 * fails instead of passing green.
 *
 *  1. tokens.ts leaf values equal the DESIGN.md front-matter values.
 *  2. Every token is declared in tokens.css with the DESIGN.md value.
 *  3. tokens.ts and parsed tokens.css agree on every shared key
 *     (the `--divider` color-mix / rgba pair is the one intentional exception).
 *  4. tokens.css radius hygiene: no value other than 0 / 3px / 9999px.
 *  5. Bidirectional exhaustiveness: no undocumented token in tokens.css, and
 *     every tokens.ts leaf maps to a tokens.css declaration.
 *  6. Consumer guardrails: index.css / App.tsx route all color + radius through
 *     tokens and reference only declared custom properties.
 */

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));

function readOrThrow(path: string, label: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(`${label} not found at ${path}`);
  }
}

const tokensCssPath = join(HERE, 'tokens.css');
const indexCssPath = join(HERE, '..', 'index.css');
const appTsxPath = join(HERE, '..', 'App.tsx');
const designMdPath = join(
  HERE,
  '..',
  '..',
  '..',
  '_bmad-output',
  'planning-artifacts',
  'ux-designs',
  'ux-PSA CODE SPRINT-2026-08-26',
  'DESIGN.md',
);

const cssText = readOrThrow(tokensCssPath, 'tokens.css');
const indexCssText = readOrThrow(indexCssPath, 'index.css');
const appTsxText = readOrThrow(appTsxPath, 'App.tsx');
const designMdText = readOrThrow(designMdPath, 'DESIGN.md');

// ---------------------------------------------------------------------------
// Minimal YAML front-matter parser (flat + 2-level nested maps only).
// ---------------------------------------------------------------------------
type FmNode = { [key: string]: string | FmNode };

function parseFrontMatter(md: string): FmNode {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('DESIGN.md front-matter block not found');
  const root: FmNode = {};
  const stack: Array<{ indent: number; node: FmNode }> = [
    { indent: -1, node: root },
  ];
  const unquote = (s: string): string => s.replace(/^['"]|['"]$/g, '');

  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = unquote(line.slice(0, ci).trim());
    const value = line.slice(ci + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;

    if (value === '') {
      const child: FmNode = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = unquote(value);
    }
  }
  return root;
}

const fm = parseFrontMatter(designMdText);
const fmColors = fm.colors as unknown as Record<string, string>;
const fmSpacing = fm.spacing as unknown as Record<string, string>;
const fmRounded = fm.rounded as unknown as Record<string, string>;
const fmTypography = fm.typography as unknown as Record<
  string,
  Record<string, string>
>;

// ---------------------------------------------------------------------------
// DESIGN.md -> expected `--custom-property` value map.
// `--font-heading` / `--font-body` are NOT here (stacks, checked by first family).
// ---------------------------------------------------------------------------
const normalizeRadius = (v: string): string => (v === '0px' ? '0' : v);

const expected: Record<string, string> = {};
for (const [k, v] of Object.entries(fmColors)) {
  expected[`--${k}`] = v;
}
for (const [k, v] of Object.entries(fmSpacing)) {
  expected[/^\d+$/.test(k) ? `--space-${k}` : `--${k}`] = v;
}
const roundedNameMap: Record<string, string> = {
  sm: 'sm',
  DEFAULT: 'default',
  md: 'md',
  lg: 'lg',
  tag: 'tag',
  full: 'full',
};
for (const [k, v] of Object.entries(fmRounded)) {
  expected[`--radius-${roundedNameMap[k]}`] = normalizeRadius(v);
}
expected['--font-weight-heading'] = fmTypography.heading.fontWeight;
expected['--font-weight-body'] = fmTypography.body.fontWeight;
expected['--font-size-micro-label'] = fmTypography['micro-label'].fontSize;
expected['--letter-spacing-micro-label'] = fmTypography['micro-label'].letterSpacing;
expected['--text-transform-micro-label'] = fmTypography['micro-label'].textTransform;
expected['--font-size-incident-title'] = fmTypography['h2-incident-title'].fontSize;
expected['--font-size-confidence'] = fmTypography['data-confidence'].fontSize;

const HEADING_FAMILY = fmTypography.heading.fontFamily; // "Barlow Condensed"
const BODY_FAMILY = fmTypography.body.fontFamily; // "Barlow"
const DIVIDER_COLOR_MIX = expected['--divider']; // color-mix(...) from DESIGN.md
const DIVIDER_RGBA = 'rgba(29,31,32,0.16)'; // concrete equivalent kept in tokens.ts

// ---------------------------------------------------------------------------
// Parse tokens.css into { '--name': 'value' }, rejecting duplicate declarations.
// ---------------------------------------------------------------------------
function stripBlockComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseCssVars(css: string): Record<string, string> {
  const body = stripBlockComments(css);
  const out: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1].trim();
    if (Object.prototype.hasOwnProperty.call(out, name)) {
      throw new Error(`duplicate declaration of ${name} in tokens.css`);
    }
    out[name] = m[2].trim();
  }
  return out;
}

const cssVars = parseCssVars(cssText);

const firstFamily = (stack: string): string =>
  stack.split(',')[0].trim().replace(/^["']|["']$/g, '');

// ---------------------------------------------------------------------------
// Flatten tokens.ts to [cssName, value] pairs (bridge across naming schemes).
// ---------------------------------------------------------------------------
type Special = 'divider' | 'fontFamily' | undefined;
interface Flat {
  cssName: string;
  value: string;
  special: Special;
}

function flattenTokens(): Flat[] {
  const out: Flat[] = [];
  const add = (cssName: string, value: string, special: Special = undefined) =>
    out.push({ cssName, value, special });

  add('--bg', tokens.color.bg);
  add('--surface', tokens.color.surface);
  add('--divider', tokens.color.divider, 'divider');
  add('--text', tokens.color.text);
  for (const [k, v] of Object.entries(tokens.color.accent)) add(`--accent-${k}`, v);
  add('--accent-2', tokens.color.accent2);
  add('--accent-2-100', tokens.color.accent2_100);
  add('--accent-2-900', tokens.color.accent2_900);
  for (const [k, v] of Object.entries(tokens.color.neutral)) add(`--neutral-${k}`, v);
  for (const [k, v] of Object.entries(tokens.space)) add(`--space-${k}`, v);
  for (const [k, v] of Object.entries(tokens.radius)) add(`--radius-${k}`, v);
  add('--font-heading', tokens.font.heading, 'fontFamily');
  add('--font-body', tokens.font.body, 'fontFamily');
  add('--font-weight-heading', tokens.font.weightHeading);
  add('--font-weight-body', tokens.font.weightBody);
  add('--font-size-micro-label', tokens.font.sizeMicroLabel);
  add('--letter-spacing-micro-label', tokens.font.letterSpacingMicroLabel);
  add('--text-transform-micro-label', tokens.font.textTransformMicroLabel);
  add('--font-size-incident-title', tokens.font.sizeIncidentTitle);
  add('--font-size-confidence', tokens.font.sizeConfidence);
  add('--header-height', tokens.layout.headerHeight);
  add('--col-left', tokens.layout.colLeft);
  add('--col-right', tokens.layout.colRight);
  return out;
}

const flat = flattenTokens();
const allowedCssKeys = new Set<string>([
  ...Object.keys(expected),
  '--font-heading',
  '--font-body',
]);

// ---------------------------------------------------------------------------
// 1 + 2 + 3. tokens.ts vs DESIGN.md vs tokens.css, per shared key.
// ---------------------------------------------------------------------------
describe('tokens.ts, DESIGN.md, and tokens.css agree on every key', () => {
  it.each(flat.filter((f) => !f.special).map((f) => [f.cssName, f.value] as const))(
    '%s: tokens.ts value %s matches DESIGN.md and tokens.css',
    (cssName, value) => {
      expect(expected[cssName], `${cssName} missing from DESIGN.md baseline`).toBe(
        value,
      );
      expect(cssVars[cssName], `${cssName} missing/wrong in tokens.css`).toBe(value);
    },
  );

  it('--divider: CSS keeps the DESIGN.md color-mix; tokens.ts keeps the paired rgba', () => {
    expect(DIVIDER_COLOR_MIX).toMatch(/^color-mix\(/);
    expect(cssVars['--divider']).toBe(DIVIDER_COLOR_MIX);
    expect(tokens.color.divider).toBe(DIVIDER_RGBA);
  });

  it('--font-heading leads with the DESIGN.md heading family, in css and ts', () => {
    expect(firstFamily(cssVars['--font-heading'])).toBe(HEADING_FAMILY);
    expect(firstFamily(tokens.font.heading)).toBe(HEADING_FAMILY);
    expect(cssVars['--font-heading']).toBe(tokens.font.heading);
  });

  it('--font-body leads with the DESIGN.md body family, in css and ts', () => {
    expect(firstFamily(cssVars['--font-body'])).toBe(BODY_FAMILY);
    expect(firstFamily(tokens.font.body)).toBe(BODY_FAMILY);
    expect(cssVars['--font-body']).toBe(tokens.font.body);
  });
});

// ---------------------------------------------------------------------------
// I/O & Edge-Case Matrix rows (values pulled from parsed DESIGN.md).
// ---------------------------------------------------------------------------
describe('I/O & Edge-Case Matrix', () => {
  it('heading type token: Barlow Condensed first, weight 600', () => {
    expect(HEADING_FAMILY).toBe('Barlow Condensed');
    expect(firstFamily(tokens.font.heading)).toBe('Barlow Condensed');
    expect(tokens.font.weightHeading).toBe('600');
    expect(cssVars['--font-weight-heading']).toBe('600');
  });

  it('body type token: Barlow first, weight 400', () => {
    expect(BODY_FAMILY).toBe('Barlow');
    expect(firstFamily(tokens.font.body)).toBe('Barlow');
    expect(tokens.font.weightBody).toBe('400');
    expect(cssVars['--font-weight-body']).toBe('400');
  });

  it('accent color token: --accent-600 resolves to #597ea3; full 100-900 ramp present', () => {
    const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    for (const s of steps) {
      expect(tokens.color.accent[s]).toBe(fmColors[`accent-${s}`]);
      expect(cssVars[`--accent-${s}`]).toBe(fmColors[`accent-${s}`]);
    }
    expect(tokens.color.accent[600]).toBe('#597ea3');
  });

  it('default radius token (sm/default/md/lg) resolves to 0', () => {
    for (const r of [
      tokens.radius.sm,
      tokens.radius.default,
      tokens.radius.md,
      tokens.radius.lg,
    ]) {
      expect(r).toBe('0');
    }
    for (const n of ['--radius-sm', '--radius-default', '--radius-md', '--radius-lg']) {
      expect(cssVars[n]).toBe('0');
    }
  });

  it('tag radius token resolves to 3px', () => {
    expect(tokens.radius.tag).toBe('3px');
    expect(cssVars['--radius-tag']).toBe('3px');
  });

  it('panel-padding spacing tokens: --space-3 = 10.2px, --space-4 = 13.6px', () => {
    expect(tokens.space[3]).toBe('10.2px');
    expect(tokens.space[4]).toBe('13.6px');
    expect(cssVars['--space-3']).toBe('10.2px');
    expect(cssVars['--space-4']).toBe('13.6px');
    for (const px of [10.2, 13.6]) {
      expect(px).toBeGreaterThanOrEqual(10);
      expect(px).toBeLessThanOrEqual(18);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. tokens.css radius hygiene.
// ---------------------------------------------------------------------------
describe('tokens.css radius hygiene', () => {
  it('every --radius-* value is 0, 3px, or 9999px', () => {
    const allowed = new Set(['0', '3px', '9999px']);
    const entries = Object.entries(cssVars).filter(([k]) => k.startsWith('--radius-'));
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, value] of entries) {
      expect(allowed.has(value), `${name} = ${value}`).toBe(true);
    }
  });

  it('no `border-radius` property is used in tokens.css', () => {
    expect(/border-radius\s*:/i.test(stripBlockComments(cssText))).toBe(false);
  });

  it('every px literal in tokens.css is an allowed dimension or radius', () => {
    const allowed = new Set<string>(['3px', '9999px']);
    for (const v of Object.values(expected)) if (/px$/.test(v)) allowed.add(v);
    const literals = stripBlockComments(cssText).match(/\d+(?:\.\d+)?px/g) ?? [];
    expect(literals.length).toBeGreaterThan(0);
    for (const lit of literals) {
      expect(allowed.has(lit), `unexpected px literal in tokens.css: ${lit}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Bidirectional exhaustiveness.
// ---------------------------------------------------------------------------
describe('token set is exhaustive in both directions', () => {
  it('every tokens.css custom property is a documented DESIGN.md token', () => {
    for (const name of Object.keys(cssVars)) {
      expect(allowedCssKeys.has(name), `undocumented token in tokens.css: ${name}`).toBe(
        true,
      );
    }
  });

  it('every DESIGN.md-derived token is declared in tokens.css', () => {
    for (const name of Object.keys(expected)) {
      expect(cssVars[name], `missing from tokens.css: ${name}`).toBeDefined();
    }
    expect(cssVars['--font-heading']).toBeDefined();
    expect(cssVars['--font-body']).toBeDefined();
  });

  it('every tokens.ts leaf value maps to a tokens.css declaration', () => {
    for (const f of flat) {
      expect(cssVars[f.cssName], `tokens.ts leaf ${f.cssName} not in tokens.css`).toBeDefined();
      if (f.special === undefined) {
        expect(cssVars[f.cssName]).toBe(f.value);
      }
    }
  });

  it('tokens.ts and tokens.css declare the same number of keys', () => {
    expect(flat.length).toBe(Object.keys(cssVars).length);
  });
});

// ---------------------------------------------------------------------------
// 6. Consumer guardrails (index.css + App.tsx).
// ---------------------------------------------------------------------------
const consumers: Array<[string, string]> = [
  ['index.css', indexCssText],
  ['App.tsx', appTsxText],
];

describe('index.css and App.tsx route styling through tokens only', () => {
  it.each(consumers)('%s contains no raw hex color literal', (_name, text) => {
    const body = stripBlockComments(text);
    const hex = body.match(/#[0-9a-f]{3,8}\b/i);
    expect(hex, hex ? `raw hex ${hex[0]}` : undefined).toBeNull();
  });

  it.each(consumers)('%s uses no disallowed border-radius value', (_name, text) => {
    const allowed = /^(?:0|3px|9999px|var\(--radius-[a-z-]+\))$/;

    const cssRadius = /border(?:-[a-z]+)*-radius\s*:\s*([^;{}]+?)\s*[;}]/gi;
    let m: RegExpExecArray | null;
    while ((m = cssRadius.exec(text)) !== null) {
      expect(m[1].trim(), `${_name}: border-radius: ${m[1].trim()}`).toMatch(allowed);
    }

    const jsxRadius = /border(?:Top|Bottom)?(?:Left|Right)?Radius\s*:\s*([^,}\n]+)/g;
    while ((m = jsxRadius.exec(text)) !== null) {
      const v = m[1].trim().replace(/['"]/g, '').replace(/,$/, '').trim();
      expect(v, `${_name}: borderRadius ${v}`).toMatch(allowed);
    }
  });

  it.each(consumers)('%s references only custom properties declared in tokens.css', (_name, text) => {
    const refs = [...text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((x) => x[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(
        Object.prototype.hasOwnProperty.call(cssVars, ref),
        `${_name}: var(${ref}) is not declared in tokens.css`,
      ).toBe(true);
    }
  });
});
