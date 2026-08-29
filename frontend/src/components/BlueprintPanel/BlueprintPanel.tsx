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

/**
 * BlueprintPanel — the shared Portwatch visual container, re-implemented to
 * portwatch-tuas's `.panel` (spec-portwatch-tuas-chrome).
 *
 * Renders the Harbor Signal instrument surface: a 1px seafoam L-bracket drawn
 * on `::before` (top-left, 18px) and a single `.corner-mark` ⌐ (bottom-right,
 * 9px) appended after `children`. The four decorative corner registration marks
 * are gone. All visual values come from BlueprintPanel.css via tokens.
 *
 * Caller `className` / `style` merge with — never replace — the component's own
 * (`blueprint-panel panel`), and unknown DOM props (`role`, `aria-*`, `data-*`,
 * `onClick`, `id`, …) spread onto the root element. The `.corner-mark` span is
 * `aria-hidden` and never intercepts pointer events.
 */
export const BlueprintPanel = forwardRef<HTMLDivElement, BlueprintPanelProps>(
  function BlueprintPanel({ as, className, style, children, ...rest }, ref) {
    const Root: ElementType = as ?? 'div';
    const mergedClassName = ['blueprint-panel', 'panel', className]
      .filter(Boolean)
      .join(' ');

    return (
      <Root ref={ref} className={mergedClassName} style={style} {...rest}>
        {children}
        <span className="corner-mark" aria-hidden="true" />
      </Root>
    );
  },
);

BlueprintPanel.displayName = 'BlueprintPanel';
