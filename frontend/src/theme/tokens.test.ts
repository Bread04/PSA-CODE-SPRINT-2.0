import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from './tokens';

/**
 * Story 2.1 — Design Token System contract enforcer, re-pointed to the
 * "Harbor Signal" DESIGN.md (`ux-PSA CODE SPRINT-2026-08-29`).
 *
 * The blueprint token set was re-valued in place: names stay stable wherever a
 * Harbor Signal counterpart exists, only values changed (spec-harbor-signal-
 * reskin). This enforcer therefore splits its parity check:
 *
 *   - Tokens that HAVE a DESIGN.md front-matter counterpart (`--bg`,
 *     `--surface*`, `--divider`, `--text*`, the signal hues, the rail / topbar
 *     dimensions, the radius + spacing scales, the font families / weights)
 *     must equal the DESIGN.md value (case-insensitively for hex).
 *   - Every other token (the derived seafoam / amber / neutral ramps, the
 *     numbered spacing keys, the named type-role sizes) is the frontend's own
 *     extension and only needs tokens.css === tokens.ts.
 *
 *   1. tokens.ts leaf values equal tokens.css.
 *   2. DESIGN.md-anchored tokens equal the parsed DESIGN.md front-matter.
 *   3. tokens.css radius hygiene: only 0 / 4px / 8px / 16px / 22px / 9999px.
 *   4. Bidirectional exhaustiveness + key-count parity.
 *   5. Consumer guardrails (guardrail #6): every shipped `.css` / `.tsx` file
 *      under `src/` routes colour + radius through tokens and references only
 *      declared custom properties. Only the allowed radius set changed.
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
const srcDir = join(HERE, '..');
const designMdPath = join(
  HERE,
  '..',
  '..',
  '..',
  '_bmad-output',
  'planning-artifacts',
  'ux-designs',
  'ux-PSA CODE SPRINT-2026-08-29',
  'DESIGN.md',
);

const cssText = readOrThrow(tokensCssPath, 'tokens.css');
const designMdText = readOrThrow(designMdPath, 'DESIGN.md');

// ---------------------------------------------------------------------------
// Consumer guardrail targets: every shipped .css / .ts / .tsx file under src/
// EXCEPT the token definition files and any test file.
// ---------------------------------------------------------------------------
const OVERRIDE_HOOKS = new Set<string>(['--blueprint-panel-padding']);

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const consumerRelPaths = readdirSync(srcDir, {
  withFileTypes: true,
  recursive: true,
})
  .filter((entry) => entry.isFile())
  .map((entry) =>
    relative(srcDir, join(entry.parentPath, entry.name)).replace(/\\/g, '/'),
  )
  .filter((p) => /\.(css|ts|tsx)$/.test(p))
  .filter((p) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(p))
  .filter((p) => !p.split('/').includes('__tests__'))
  .filter((p) => !p.endsWith('theme/tokens.css') && !p.endsWith('theme/tokens.ts'))
  .sort();

const consumers: Array<[string, string]> = consumerRelPaths.map((rel) => [
  rel,
  readOrThrow(join(srcDir, rel), rel),
]);

// ---------------------------------------------------------------------------
// Minimal YAML front-matter parser for the Harbor Signal DESIGN.md — flat +
// nested maps, inline `# comment` tails stripped, values unquoted.
// ---------------------------------------------------------------------------
type FmNode = { [key: string]: string | FmNode };

/** Strip an inline `# comment` tail that is not inside a quoted string. */
function stripInlineComment(value: string): string {
  if (value.startsWith('"') || value.startsWith("'")) {
    const q = value[0];
    const end = value.indexOf(q, 1);
    return end === -1 ? value : value.slice(1, end);
  }
  const hash = value.indexOf(' #');
  return (hash === -1 ? value : value.slice(0, hash)).trim();
}

function parseFrontMatter(md: string): FmNode {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error('DESIGN.md front-matter block not found');
  const root: FmNode = {};
  const stack: Array<{ indent: number; node: FmNode }> = [
    { indent: -1, node: root },
  ];

  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (line.startsWith('- ')) continue; // sequence items — unused here
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = line.slice(0, ci).trim().replace(/^['"]|['"]$/g, '');
    const rawValue = line.slice(ci + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;

    if (rawValue === '') {
      const child: FmNode = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = stripInlineComment(rawValue);
    }
  }
  return root;
}

const fm = parseFrontMatter(designMdText);
const fmColors = fm.colors as FmNode;
const fmBg = fmColors.background as Record<string, string>;
const fmTypo = fm.typography as FmNode;
const fmRounded = fm.rounded as Record<string, string>;
const fmSpacing = fm.spacing as Record<string, string>;
const fmComponents = fm.components as FmNode;
const fmRail = fmComponents.rail as Record<string, string>;
const fmTopbar = fmComponents.topbar as Record<string, string>;

const firstFamily = (stack: string): string =>
  stack.split(',')[0].trim().replace(/^["']|["']$/g, '');

// DESIGN.md value -> expected tokens.css value (normalised).
const px = (n: string): string => `${n.trim()}px`;

/** { cssVarName: designValue } for every token that is anchored to DESIGN.md. */
const designAnchored: Record<string, string> = {
  '--bg': fmBg.ink,
  '--surface': fmBg.panel,
  '--surface-elevated': fmBg.elevated,
  '--surface-subtle': fmBg.subtle,
  '--divider': fmColors.border as string,
  '--text': fmColors.textPrimary as string,
  '--text-muted': fmColors.textSecondary as string,
  '--paper': fmColors.paper as string,
  '--accent-500': fmColors.signalSeafoam as string,
  '--signal-seafoam': fmColors.signalSeafoam as string,
  '--accent-2': fmColors.signalAmber as string,
  '--signal-amber': fmColors.signalAmber as string,
  '--accent-900': fmColors.signalRed as string,
  '--signal-red': fmColors.signalRed as string,
  '--radius-sm': px(fmRounded.sm),
  '--radius-default': px(fmRounded.md),
  '--radius-md': px(fmRounded.md),
  '--radius-lg': px(fmRounded.lg),
  '--radius-xl': px(fmRounded.xl),
  '--space-1': px(fmSpacing.xs),
  '--space-2': px(fmSpacing.sm),
  '--space-3': px(fmSpacing.md),
  '--space-4': px(fmSpacing.lg),
  '--space-6': px(fmSpacing.xl),
  '--space-8': px(fmSpacing.xxl),
  '--rail-width': px(fmRail.widthExpanded),
  '--rail-width-collapsed': px(fmRail.widthCollapsed),
  '--topbar-height': px(fmTopbar.height),
  '--font-weight-heading': (fmTypo.display as Record<string, string>).weight,
  '--font-weight-body': (fmTypo.body as Record<string, string>).weight,
};

const DISPLAY_FAMILY = firstFamily(
  (fmTypo.display as Record<string, string>).family,
); // "Space Grotesk"
const MONO_FAMILY = firstFamily((fmTypo.mono as Record<string, string>).family); // "IBM Plex Mono"

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

// ---------------------------------------------------------------------------
// Flatten tokens.ts to [cssName, value] pairs (bridge across naming schemes).
// ---------------------------------------------------------------------------
type Special = 'fontFamily' | undefined;
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
  add('--surface-elevated', tokens.color.surfaceElevated);
  add('--surface-subtle', tokens.color.surfaceSubtle);
  add('--divider', tokens.color.divider);
  add('--text', tokens.color.text);
  add('--text-muted', tokens.color.textMuted);
  add('--paper', tokens.color.paper);
  for (const [k, v] of Object.entries(tokens.color.accent)) add(`--accent-${k}`, v);
  add('--accent-2', tokens.color.accent2);
  add('--accent-2-100', tokens.color.accent2_100);
  add('--accent-2-900', tokens.color.accent2_900);
  for (const [k, v] of Object.entries(tokens.color.neutral)) add(`--neutral-${k}`, v);
  add('--signal-seafoam', tokens.color.signalSeafoam);
  add('--signal-amber', tokens.color.signalAmber);
  add('--signal-red', tokens.color.signalRed);
  for (const [k, v] of Object.entries(tokens.space)) add(`--space-${k}`, v);
  add('--topbar-height', tokens.layout.topbarHeight);
  add('--banner-height', tokens.layout.bannerHeight);
  add('--rail-width', tokens.layout.railWidth);
  add('--rail-width-collapsed', tokens.layout.railWidthCollapsed);
  add('--col-left', tokens.layout.colLeft);
  add('--col-right', tokens.layout.colRight);
  add('--shadow-panel', tokens.elevation.shadowPanel);
  add('--shadow-panel-accent', tokens.elevation.shadowPanelAccent);
  add('--bracket-seafoam', tokens.elevation.bracketSeafoam);
  add('--rail-active-glow', tokens.elevation.railActiveGlow);
  for (const [k, v] of Object.entries(tokens.radius)) add(`--radius-${k}`, v);
  add('--font-heading', tokens.font.heading, 'fontFamily');
  add('--font-body', tokens.font.body, 'fontFamily');
  add('--font-mono', tokens.font.mono, 'fontFamily');
  add('--font-weight-heading', tokens.font.weightHeading);
  add('--font-weight-body', tokens.font.weightBody);
  add('--font-size-micro-label', tokens.font.sizeMicroLabel);
  add('--letter-spacing-micro-label', tokens.font.letterSpacingMicroLabel);
  add('--text-transform-micro-label', tokens.font.textTransformMicroLabel);
  add('--font-size-incident-title', tokens.font.sizeIncidentTitle);
  add('--font-size-confidence', tokens.font.sizeConfidence);
  add('--font-size-caption', tokens.font.sizeCaption);
  add('--font-size-body', tokens.font.sizeBody);
  add('--font-size-body-lg', tokens.font.sizeBodyLg);
  add('--font-size-section-title', tokens.font.sizeSectionTitle);
  add('--letter-spacing-label', tokens.font.letterSpacingLabel);
  return out;
}

const flat = flattenTokens();

// ---------------------------------------------------------------------------
// 1. tokens.ts leaf values equal tokens.css.
// ---------------------------------------------------------------------------
describe('tokens.ts mirrors tokens.css', () => {
  it.each(flat.map((f) => [f.cssName, f.value] as const))(
    '%s: tokens.ts value %s is declared with that value in tokens.css',
    (cssName, value) => {
      expect(cssVars[cssName], `${cssName} missing from tokens.css`).toBe(value);
    },
  );

  it('tokens.ts and tokens.css declare the same number of keys', () => {
    expect(flat.length).toBe(Object.keys(cssVars).length);
  });
});

// ---------------------------------------------------------------------------
// 2. DESIGN.md-anchored tokens equal the parsed DESIGN.md front-matter.
// ---------------------------------------------------------------------------
describe('DESIGN.md-anchored tokens match ux-PSA CODE SPRINT-2026-08-29/DESIGN.md', () => {
  it.each(Object.entries(designAnchored))(
    '%s resolves to the DESIGN.md value %s',
    (cssName, designValue) => {
      expect(cssVars[cssName], `${cssName} missing from tokens.css`).toBeDefined();
      expect(cssVars[cssName].toLowerCase()).toBe(designValue.toLowerCase());
    },
  );

  it('--font-heading / --font-body lead with the DESIGN.md display family', () => {
    expect(firstFamily(cssVars['--font-heading'])).toBe(DISPLAY_FAMILY);
    expect(firstFamily(cssVars['--font-body'])).toBe(DISPLAY_FAMILY);
    expect(firstFamily(tokens.font.heading)).toBe(DISPLAY_FAMILY);
    expect(DISPLAY_FAMILY).toBe('Space Grotesk');
  });

  it('--font-mono leads with the DESIGN.md mono family', () => {
    expect(firstFamily(cssVars['--font-mono'])).toBe(MONO_FAMILY);
    expect(firstFamily(tokens.font.mono)).toBe(MONO_FAMILY);
    expect(MONO_FAMILY).toBe('IBM Plex Mono');
  });
});

// ---------------------------------------------------------------------------
// I/O & Edge-Case Matrix rows (Harbor Signal spot checks).
// ---------------------------------------------------------------------------
describe('I/O & Edge-Case Matrix', () => {
  it('seafoam is the signature accent — --accent-500 is the DESIGN.md signal seafoam', () => {
    expect(cssVars['--accent-500'].toLowerCase()).toBe('#66e0d2');
    expect(tokens.color.accent[500].toLowerCase()).toBe('#66e0d2');
    expect(tokens.color.signalSeafoam.toLowerCase()).toBe('#66e0d2');
  });

  it('the critical-surface ink (--accent-900) is the DESIGN.md signal red', () => {
    expect(cssVars['--accent-900'].toLowerCase()).toBe('#e8695a');
    expect(cssVars['--signal-red'].toLowerCase()).toBe('#e8695a');
  });

  it('standard panel radius token (--radius-md / --radius-default) resolves to 8px', () => {
    expect(tokens.radius.md).toBe('8px');
    expect(tokens.radius.default).toBe('8px');
    expect(cssVars['--radius-md']).toBe('8px');
    expect(cssVars['--radius-default']).toBe('8px');
  });

  it('radius ramp: sm 4 / md 8 / lg 16 / xl 22 / full 9999', () => {
    expect(cssVars['--radius-sm']).toBe('4px');
    expect(cssVars['--radius-lg']).toBe('16px');
    expect(cssVars['--radius-xl']).toBe('22px');
    expect(cssVars['--radius-full']).toBe('9999px');
  });

  it('spacing scale base is 4px and the panel-padding step is 16px', () => {
    expect(tokens.space[1]).toBe('4px');
    expect(tokens.space[4]).toBe('16px');
    expect(cssVars['--space-1']).toBe('4px');
    expect(cssVars['--space-4']).toBe('16px');
  });

  it('command rail dimensions: 214 expanded / 74 collapsed, topbar 72', () => {
    expect(cssVars['--rail-width']).toBe('214px');
    expect(cssVars['--rail-width-collapsed']).toBe('74px');
    expect(cssVars['--topbar-height']).toBe('72px');
  });

  it('display type token: Space Grotesk first, weight 600', () => {
    expect(firstFamily(tokens.font.heading)).toBe('Space Grotesk');
    expect(tokens.font.weightHeading).toBe('600');
    expect(cssVars['--font-weight-heading']).toBe('600');
  });

  it('mono type token: IBM Plex Mono first, weight 400 body', () => {
    expect(firstFamily(tokens.font.mono)).toBe('IBM Plex Mono');
    expect(tokens.font.weightBody).toBe('400');
    expect(cssVars['--font-weight-body']).toBe('400');
  });
});

// ---------------------------------------------------------------------------
// 3. tokens.css radius + px hygiene.
// ---------------------------------------------------------------------------
describe('tokens.css radius hygiene', () => {
  const ALLOWED_RADIUS = new Set(['0', '4px', '8px', '16px', '22px', '9999px']);

  it('every --radius-* value is 0 / 4px / 8px / 16px / 22px / 9999px', () => {
    const entries = Object.entries(cssVars).filter(([k]) =>
      k.startsWith('--radius-'),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, value] of entries) {
      expect(ALLOWED_RADIUS.has(value), `${name} = ${value}`).toBe(true);
    }
  });

  it('no `border-radius` property is used in tokens.css', () => {
    expect(/border-radius\s*:/i.test(stripBlockComments(cssText))).toBe(false);
  });

  it('every px literal in tokens.css also appears within a declared token value', () => {
    const declaredPx = new Set<string>();
    for (const v of Object.values(cssVars)) {
      for (const lit of v.match(/\d+(?:\.\d+)?px/g) ?? []) declaredPx.add(lit);
    }
    const literals = stripBlockComments(cssText).match(/\d+(?:\.\d+)?px/g) ?? [];
    expect(literals.length).toBeGreaterThan(0);
    for (const lit of literals) {
      expect(declaredPx.has(lit), `stray px literal in tokens.css: ${lit}`).toBe(
        true,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Bidirectional exhaustiveness.
// ---------------------------------------------------------------------------
describe('token set is exhaustive in both directions', () => {
  const flatNames = new Set(flat.map((f) => f.cssName));

  it('every tokens.css custom property is mirrored by a tokens.ts leaf', () => {
    for (const name of Object.keys(cssVars)) {
      expect(flatNames.has(name), `tokens.css token not in tokens.ts: ${name}`).toBe(
        true,
      );
    }
  });

  it('every tokens.ts leaf maps to a tokens.css declaration', () => {
    for (const f of flat) {
      expect(
        cssVars[f.cssName],
        `tokens.ts leaf ${f.cssName} not in tokens.css`,
      ).toBeDefined();
      if (f.special === undefined) expect(cssVars[f.cssName]).toBe(f.value);
    }
  });

  it('every DESIGN.md-anchored token is declared in tokens.css', () => {
    for (const name of Object.keys(designAnchored)) {
      expect(cssVars[name], `missing from tokens.css: ${name}`).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Consumer guardrails (guardrail #6) — unchanged logic; only the allowed
//    radius set moves to the Harbor Signal values.
// ---------------------------------------------------------------------------
const NAMED_COLOR =
  /\b(white|black|red|green|blue|gray|grey|silver|gainsboro|orange|yellow|purple|pink|brown|cyan|magenta)\b/i;

describe('shipped src CSS + components route styling through tokens only', () => {
  it('the guardrail walk covers ≥1 file with ≥1 token reference', () => {
    expect(consumers.length).toBeGreaterThan(0);
    const totalRefs = consumers.reduce(
      (n, [, raw]) =>
        n + [...stripComments(raw).matchAll(/var\(\s*--[a-z0-9-]+/gi)].length,
      0,
    );
    expect(totalRefs).toBeGreaterThan(0);
  });

  it('the guardrail walk resolves the known consumer files', () => {
    for (const required of [
      'components/BlueprintPanel/BlueprintPanel.css',
      'index.css',
      'App.tsx',
    ]) {
      expect(consumerRelPaths, `missing ${required} from the walk`).toContain(
        required,
      );
    }
  });

  it.each(consumers)('%s contains no raw hex color literal', (_name, raw) => {
    const body = stripComments(raw);
    const hex = body.match(/#[0-9a-f]{3,8}\b/i);
    expect(hex, hex ? `raw hex ${hex[0]}` : undefined).toBeNull();
  });

  it.each(consumers.filter(([name]) => name.endsWith('.css')))(
    '%s uses no CSS named color as a property value',
    (_name, raw) => {
      const body = stripComments(raw);
      const values = [...body.matchAll(/:\s*([^;{}]+)[;}]/g)].map((m) =>
        m[1].trim(),
      );
      for (const value of values) {
        const hit = value.match(NAMED_COLOR);
        expect(
          hit,
          hit ? `${_name}: named color "${hit[0]}" in "${value}"` : undefined,
        ).toBeNull();
      }
    },
  );

  it.each(consumers.filter(([name]) => name.endsWith('.css')))(
    '%s routes every font-size through a token (no bare px/rem literal)',
    (_name, raw) => {
      const body = stripComments(raw);
      const bare = [...body.matchAll(/font-size\s*:\s*([^;{}]+)[;}]/gi)]
        .map((m) => m[1].trim())
        .filter((v) => !/^var\(--font-size-[a-z-]+\)$/.test(v));
      expect(
        bare,
        bare.length ? `${_name}: bare font-size literal(s) ${bare.join(', ')}` : undefined,
      ).toEqual([]);
    },
  );

  it.each(consumers.filter(([name]) => name.endsWith('.css')))(
    '%s does not de-emphasise text with opacity: 0.6 (use var(--text-muted))',
    (_name, raw) => {
      const body = stripComments(raw);
      expect(
        /opacity\s*:\s*0?\.6\b/i.test(body),
        `${_name}: found "opacity: 0.6" — use color: var(--text-muted) instead`,
      ).toBe(false);
    },
  );

  it.each(consumers)('%s uses no disallowed border-radius value', (_name, raw) => {
    const text = stripComments(raw);
    const allowed = /^(?:0|4px|8px|16px|22px|9999px|var\(--radius-[a-z-]+\))$/;

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

  it.each(consumers)(
    '%s references only declared tokens (fallbacks must be a token or a registered override hook)',
    (_name, raw) => {
      const body = stripComments(raw);
      const re = /var\(\s*(--[a-z0-9-]+)\s*(,)?/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const ref = m[1];
        const declared = Object.prototype.hasOwnProperty.call(cssVars, ref);
        if (m[2]) {
          expect(
            declared || OVERRIDE_HOOKS.has(ref),
            `${_name}: var(${ref}) has a fallback but is neither a declared token nor a registered OVERRIDE_HOOK`,
          ).toBe(true);
          continue;
        }
        expect(
          declared,
          `${_name}: var(${ref}) is not declared in tokens.css and has no fallback`,
        ).toBe(true);
      }
    },
  );

  it.each(consumers)(
    '%s: a file with any styling signal references at least one token',
    (_name, raw) => {
      const text = stripComments(raw);
      const hasStylingSignal =
        /style\s*=\s*\{\{|var\(|#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?px\b/.test(text);
      if (!hasStylingSignal) return;
      const refs = [...text.matchAll(/var\(\s*--[a-z0-9-]+/gi)];
      expect(
        refs.length,
        `${_name} carries a styling signal but no var(--token) reference`,
      ).toBeGreaterThan(0);
    },
  );

  // Acceptance Criterion 5 — the global reduced-motion escape hatch ships in
  // index.css (EXPERIENCE.md Accessibility Floor).
  it('index.css carries the global prefers-reduced-motion block', () => {
    const indexCss = consumers.find(([name]) => name === 'index.css')?.[1] ?? '';
    expect(indexCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
