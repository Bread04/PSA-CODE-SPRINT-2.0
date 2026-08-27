import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementType } from 'react';

import './BlueprintPanel.css';

export interface BlueprintPanelProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Root element/tag to render. Defaults to `'div'`.
   *
   * The forwarded ref is typed for the default `div` element — permitting
   * common containers (`section`, `article`, `li`, `button`, …) without a full
   * polymorphic-ref generic. This is a documented pragmatic tradeoff (spec 2.2),
   * not a gap.
   */
  as?: ElementType;
}

/** The four corner registration marks, in DOM order. */
const CORNER_SUFFIXES = ['tl', 'tr', 'bl', 'br'] as const;

/**
 * BlueprintPanel — the shared Portwatch visual container.
 *
 * Renders a bordered, square, `--surface` box with four decorative 11px
 * crosshair corner marks offset 6px outside each corner (see BlueprintPanel.css;
 * all visual values come from Story 2.1 tokens). `children` render inside the
 * box; the corner marks are `aria-hidden` and never intercept pointer events.
 *
 * Caller `className` / `style` merge with — never replace — the component's own,
 * and unknown DOM props (`role`, `aria-*`, `data-*`, `onClick`, `id`, …) are
 * spread onto the root element. Padding defaults to `--space-4` and is
 * overridable via the `--blueprint-panel-padding` custom property.
 */
export const BlueprintPanel = forwardRef<HTMLDivElement, BlueprintPanelProps>(
  function BlueprintPanel({ as, className, style, children, ...rest }, ref) {
    const Root: ElementType = as ?? 'div';
    const mergedClassName = ['blueprint-panel', className]
      .filter(Boolean)
      .join(' ');

    return (
      <Root ref={ref} className={mergedClassName} style={style} {...rest}>
        {children}
        {CORNER_SUFFIXES.map((suffix) => (
          <span
            key={suffix}
            className={`blueprint-panel__corner blueprint-panel__corner--${suffix}`}
            aria-hidden="true"
          />
        ))}
      </Root>
    );
  },
);

BlueprintPanel.displayName = 'BlueprintPanel';
