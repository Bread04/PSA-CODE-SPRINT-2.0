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
    sizeNano: '9px',
    sizePico: '8px',
    sizeSectionHeading: '21px',
    sizeMetricValue: '27px',
  },
  /* ---- Harbor Signal chrome — transcribed from
     frontend/portwatch-tuas/client/src/index.css. Typed mirror of the
     `--geo-land` / `--panel-*` / `--rail-*` / `--topbar-*` / `--nav-*` /
     `--grid-*` / `--grain-opacity` / `--chrome-backdrop-blur` /
     `--metric-card-*` / `--eyebrow` / `--status-pulse-glow` custom
     properties in ./tokens.css. ---- */
  chrome: {
    geoLand: '#0a2028',
    panelBorder: 'rgba(85, 147, 151, 0.21)',
    panelBg: 'rgba(14, 36, 44, 0.73)',
    panelAccentBorder: 'rgba(102, 224, 210, 0.4)',
    panelHoverBorder: 'rgba(237, 177, 92, 0.62)',
    panelBracket: 'rgba(102, 224, 210, 0.65)',
    cornerMarkBorder: 'rgba(102, 224, 210, 0.38)',
    panelHeaderText: '#d9eeeb',
    panelHeaderDetail: '#688c91',
    railBg: 'rgba(6, 20, 27, 0.88)',
    railBorder: 'rgba(84, 150, 154, 0.2)',
    railEyebrow: '#557d85',
    railFoot: '#52767b',
    railFootStrong: '#8fb7b6',
    railStatus: '#8bd4c7',
    railCollapseBorder: 'rgba(102, 224, 210, 0.34)',
    navActiveGradFrom: 'rgba(54, 122, 128, 0.24)',
    navActiveGradTo: 'rgba(40, 82, 89, 0.08)',
    navHoverBg: 'rgba(78, 137, 143, 0.1)',
    navIdle: '#6a9196',
    navActiveText: '#d8fbf3',
    topbarBg: 'rgba(7, 20, 27, 0.64)',
    topbarBorder: 'rgba(84, 150, 154, 0.16)',
    breadcrumb: '#62868b',
    breadcrumbStrong: '#d6ebe8',
    topbarTime: '#668a8e',
    liveChipBorder: 'rgba(102, 224, 210, 0.28)',
    liveChipBg: 'rgba(36, 109, 108, 0.1)',
    liveChipText: '#89d9ce',
    chromeBackdropBlur: '18px',
    gridLine: 'rgba(85, 154, 156, 0.055)',
    gridSize: '40px 40px',
    gridOpacity: '0.24',
    grainOpacity: '0.025',
    metricCardBg: 'rgba(10, 29, 37, 0.77)',
    metricValue: '#dff5f1',
    eyebrow: '#69c8c0',
    statusPulseGlow: 'rgba(102, 224, 210, 0.28)',
    countdownFillWidth: '0%',
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
export type ChromeToken = keyof Tokens['chrome'];
