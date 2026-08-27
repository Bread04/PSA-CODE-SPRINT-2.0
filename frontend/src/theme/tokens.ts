/**
 * Portwatch Console — Design Token System (Story 2.1)
 *
 * Typed mirror of ./tokens.css. Every value here is transcribed EXACTLY from
 * DESIGN.md front-matter and MUST match the corresponding `--custom-property`
 * declaration in tokens.css (verified by tokens.test.ts).
 *
 * Consume `tokens` for values needed in TS/JS (inline styles, canvas, SVG);
 * consume the CSS custom properties in stylesheets. Never hardcode a theme
 * hex/px anywhere else.
 */

export const tokens = {
  color: {
    bg: '#f2f2f3',
    surface: '#e9e9ea',
    /**
     * DESIGN.md defines `--divider` as
     * `color-mix(in srgb, #1d1f20 16%, transparent)`.
     * This is its concrete, equivalent rgba form (per live-console.html);
     * the two representations are intentionally paired, so the CSS/TS
     * mismatch check special-cases `divider`.
     */
    divider: 'rgba(29,31,32,0.16)',
    text: '#1d1f20',
    accent: {
      100: '#eef6ff',
      200: '#d6ebff',
      300: '#b5d9fd',
      400: '#94bce3',
      500: '#749dc4',
      600: '#597ea3',
      700: '#416180',
      800: '#2c455d',
      900: '#1d2d3d',
    },
    accent2: '#728fab',
    accent2_100: '#eef6ff',
    accent2_900: '#1f2d3a',
    neutral: {
      100: '#f5f5f8',
      300: '#dfe1e4',
      500: '#9a9fa3',
      700: '#585c60',
      900: '#2b2b2d',
    },
  },
  space: {
    1: '3.4px',
    2: '6.8px',
    3: '10.2px',
    4: '13.6px',
    6: '20.4px',
    8: '27.2px',
  },
  radius: {
    sm: '0',
    default: '0',
    md: '0',
    lg: '0',
    tag: '3px',
    full: '9999px',
  },
  font: {
    heading: '"Barlow Condensed", "Oswald", "Arial Narrow", sans-serif',
    body: 'Barlow, Arial, sans-serif',
    weightHeading: '600',
    weightBody: '400',
    sizeMicroLabel: '11px',
    letterSpacingMicroLabel: '0.14em',
    textTransformMicroLabel: 'uppercase',
    sizeIncidentTitle: '29px',
    sizeConfidence: '38px',
  },
  layout: {
    headerHeight: '54px',
    colLeft: '296px',
    colRight: '400px',
  },
} as const;

export type Tokens = typeof tokens;
export type ColorTokens = Tokens['color'];
export type AccentStep = keyof ColorTokens['accent'];
export type NeutralStep = keyof ColorTokens['neutral'];
export type SpaceStep = keyof Tokens['space'];
export type RadiusToken = keyof Tokens['radius'];
export type FontToken = keyof Tokens['font'];
export type LayoutToken = keyof Tokens['layout'];
