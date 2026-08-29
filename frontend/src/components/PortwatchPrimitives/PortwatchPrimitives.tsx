/*
 * PortwatchPrimitives — the Harbor Signal instrument-surface primitives, ported
 * from `frontend/portwatch-tuas/client/src/components/PortwatchPrimitives.tsx`
 * (spec-portwatch-tuas-chrome). Hand-rolled CSS in ./PortwatchPrimitives.css —
 * no Tailwind / shadcn — routed through the Story 2.1 + Harbor-Signal chrome
 * tokens. `lucide-react` line icons at 1.7 stroke, always `aria-hidden`.
 *
 * `SignalTone` tone classes (`signal-{tone}`) set only `color`; a component's
 * background / border never changes with tone.
 *
 * `PanelHeader` is the compact panel header (eyebrow + `<h3>`, portwatch's
 * `.panel-header`); `SectionHeading` is the larger `<h2>` view-intro heading,
 * ported for future view intros.
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, Check, CircleAlert, Info, LoaderCircle } from 'lucide-react';

import './PortwatchPrimitives.css';

export type SignalTone = 'teal' | 'amber' | 'red' | 'green' | 'slate';

const toneClasses: Record<SignalTone, string> = {
  teal: 'signal-teal',
  amber: 'signal-amber',
  red: 'signal-red',
  green: 'signal-green',
  slate: 'signal-slate',
};

export function Panel({
  children,
  className = '',
  accent = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const classes = [
    'panel',
    accent && 'panel-accent',
    onClick && 'panel-interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section
      className={classes}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          // Space would otherwise scroll the page.
          if (event.key === ' ') event.preventDefault();
          onClick();
        }
      }}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </section>
  );
}

/** Heading level for {@link PanelHeader} — keeps the document outline monotonic. */
export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

export function PanelHeader({
  eyebrow,
  title,
  level = 3,
  titleId,
  titleClassName,
  index,
  detail,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  /** `<h{level}>` for the title. Default 3 (a panel). Nested panels use 4. */
  level?: HeadingLevel;
  titleId?: string;
  /** Extra class on the `<hN>` alongside `panel-header__title` (the panel's `…__heading` hook). */
  titleClassName?: string;
  /** Optional mono index token rendered on the right (portwatch `.panel-index`). */
  index?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  const Heading = `h${level}` as const;
  return (
    <div className="panel-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <Heading
          id={titleId}
          className={
            'panel-header__title' + (titleClassName ? ` ${titleClassName}` : '')
          }
        >
          {title}
        </Heading>
        {detail != null && <p className="panel-header__detail">{detail}</p>}
      </div>
      {index != null && <span className="panel-index">{index}</span>}
      {action}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
  titleClassName,
  titleId,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
  /** Extra class appended to the `<h2>` alongside `section-heading__title`. */
  titleClassName?: string;
  /** `id` for the `<h2>` so an `aria-labelledby` region resolves to it. */
  titleId?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2
          id={titleId}
          className={
            'section-heading__title' + (titleClassName ? ` ${titleClassName}` : '')
          }
        >
          {title}
        </h2>
        {detail && <p className="section-heading__detail">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({
  tone,
  children,
  pulse = false,
}: {
  tone: SignalTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  return (
    <span className={`status-pill ${toneClasses[tone]}`}>
      <span className={`status-dot ${pulse ? 'pulse' : ''}`} />
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  suffix,
  delta,
  tone = 'teal',
  icon: Icon,
  note,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  delta?: string;
  tone?: SignalTone;
  icon?: LucideIcon;
  note?: string;
}) {
  return (
    <div className={`metric-card ${toneClasses[tone]}`}>
      <div className="metric-card-top">
        <span className="metric-label">{label}</span>
        {Icon && <Icon size={15} strokeWidth={1.7} aria-hidden="true" />}
      </div>
      <div className="metric-value-line">
        <strong>{value}</strong>
        {suffix && <span>{suffix}</span>}
      </div>
      {(delta || note) && (
        <div className="metric-foot">
          {delta && <span className="metric-delta">{delta}</span>}
          {note && <span>{note}</span>}
        </div>
      )}
    </div>
  );
}

export function SignalTag({
  label,
  tone = 'slate',
  icon = 'dot',
}: {
  label: string;
  tone?: SignalTone;
  icon?: 'dot' | 'check' | 'alert' | 'info' | 'loading';
}) {
  const Icon =
    icon === 'check'
      ? Check
      : icon === 'alert'
        ? CircleAlert
        : icon === 'info'
          ? Info
          : icon === 'loading'
            ? LoaderCircle
            : null;
  return (
    <span className={`signal-tag ${toneClasses[tone]}`}>
      {Icon ? (
        <Icon
          className={icon === 'loading' ? 'spin' : ''}
          size={12}
          aria-hidden="true"
        />
      ) : (
        <span className="status-dot" />
      )}
      {label}
    </span>
  );
}

export function TinySparkline({
  points,
  tone = 'teal',
}: {
  points: number[];
  tone?: SignalTone;
}) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 32 - ((point - min) / Math.max(1, max - min)) * 27;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      className={`tiny-sparkline ${toneClasses[tone]}`}
      viewBox="0 0 100 36"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={coords} fill="none" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,36 ${coords} 100,36`} className="spark-fill" />
    </svg>
  );
}

export function CornerMark({ className = '' }: { className?: string }) {
  return <span className={`corner-mark ${className}`} aria-hidden="true" />;
}

export function RailButton({
  active,
  icon: Icon,
  label,
  onClick,
  badge,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      className={`rail-button ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
      <span>{label}</span>
      {badge && <b>{badge}</b>}
    </button>
  );
}

export function LinkButton({
  children,
  onClick,
  icon = true,
  tone = 'ghost',
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: boolean;
  tone?: 'ghost' | 'solid';
}) {
  return (
    <button type="button" className={`link-button ${tone}`} onClick={onClick}>
      {children}
      {icon && <ArrowUpRight size={14} aria-hidden="true" />}
    </button>
  );
}

export function CountdownBar({
  percent,
  tone = 'amber',
}: {
  percent: number;
  tone?: SignalTone;
}) {
  const pct = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;
  // The per-instance fill % rides the declared `--countdown-fill-width` token's
  // fallback slot, so the only literal in this file is a token reference
  // (token-discipline #6 — a .tsx that carries `style={{}}` must reference a
  // `var(--token)`).
  return (
    <div className={`countdown-track ${toneClasses[tone]}`}>
      <div
        className="countdown-fill"
        style={{ width: `var(--countdown-fill-width, ${pct}%)` }}
      />
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">∕∕</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
