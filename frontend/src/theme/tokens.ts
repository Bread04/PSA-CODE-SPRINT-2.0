/**
 * Portwatch Console — Design Token System (Story 2.1, re-valued to "Harbor
 * Signal" 2026-08-29).
 *
 * Typed mirror of ./tokens.css. Every value here MUST match the corresponding
 * `--custom-property` declaration in tokens.css (verified by tokens.test.ts,
 * three-way against `ux-PSA CODE SPRINT-2026-08-29/DESIGN.md` for the tokens
 * that have a DESIGN.md counterpart).
 *
 * Consume `tokens` for values needed in TS/JS (inline styles, canvas, SVG);
 * consume the CSS custom properties in stylesheets. Never hardcode a theme
 * hex/px anywhere else.
 *
 * Harbor Signal `--divider` is a flat hex, so the historical CSS-vs-TS
 * `divider` special-case is gone — every value is now a straight mirror.
 */

export const tokens = {
  color: {
    bg: '#07141b',
    surface: '#0d1c26',
    surfaceElevated: '#122833',
    surfaceSubtle: '#183243',
    divider: '#214459',
    text: '#eaf7f9',
    textMuted: '#a4b8c0',
    paper: '#e6f1f3',
    accent: {
      100: '#e6fbf7',
      200: '#c2f3eb',
      300: '#9de9df',
      400: '#79e1d3',
      500: '#66e0d2',
      600: '#4fcbbd',
      700: '#5ad2c4',
      800: '#2e8e83',
      900: '#e8695a',
    },
    accent2: '#f7b267',
    accent2_100: '#fce6cc',
    accent2_900: '#6e4620',
    neutral: {
      100: '#0a1922',
      300: '#214459',
      500: '#5c7480',
      700: '#a4b8c0',
      900: '#eaf7f9',
    },
    signalSeafoam: '#66e0d2',
    signalAmber: '#f7b267',
    signalRed: '#e8695a',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '20px',
    8: '24px',
  },
  layout: {
    topbarHeight: '72px',
    bannerHeight: '40px',
    railWidth: '214px',
    railWidthCollapsed: '74px',
    colLeft: '296px',
    colRight: '400px',
  },
  elevation: {
    shadowPanel:
      '0 14px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(191, 255, 245, 0.03)',
    shadowPanelAccent:
      '0 18px 54px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(191, 255, 245, 0.04)',
    bracketSeafoam: '#66e0d2',
    railActiveGlow: 'rgba(102, 224, 210, 0.55)',
  },
  radius: {
    sm: '4px',
    default: '8px',
    md: '8px',
    lg: '16px',
    xl: '22px',
    tag: '4px',
    full: '9999px',
  },
  font: {
    heading: '"Space Grotesk", system-ui, sans-serif',
    body: '"Space Grotesk", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
    weightHeading: '600',
    weightBody: '400',
    sizeMicroLabel: '11px',
    letterSpacingMicroLabel: '0.16em',
    textTransformMicroLabel: 'uppercase',
    sizeIncidentTitle: '28px',
    sizeConfidence: '34px',
    sizeCaption: '12px',
    sizeBody: '13px',
    sizeBodyLg: '14px',
    sizeSectionTitle: '16px',
    letterSpacingLabel: '0.08em',
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
export type ElevationToken = keyof Tokens['elevation'];
