/* Harbor Signal design reminder: reusable instrument surfaces, seafoam telemetry, oxidized amber warnings, low-glare ink, and asymmetric operations layout. */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Check, CircleAlert, Info, LoaderCircle } from "lucide-react";

export type SignalTone = "teal" | "amber" | "red" | "green" | "slate";

const toneClasses: Record<SignalTone, string> = {
  teal: "signal-teal",
  amber: "signal-amber",
  red: "signal-red",
  green: "signal-green",
  slate: "signal-slate",
};

export function Panel({
  children,
  className = "",
  accent = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  return <section className={`panel ${accent ? "panel-accent" : ""} ${onClick ? "panel-interactive" : ""} ${className}`} onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === "Enter" || event.key === " ")) onClick(); }} tabIndex={onClick ? 0 : undefined} role={onClick ? "button" : undefined}>{children}</section>;
}

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ tone, children, pulse = false }: { tone: SignalTone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={`status-pill ${toneClasses[tone]}`}>
      <span className={`status-dot ${pulse ? "pulse" : ""}`} />
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  suffix,
  delta,
  tone = "teal",
  icon: Icon,
  note,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  delta?: string;
  tone?: SignalTone;
  icon: LucideIcon;
  note?: string;
}) {
  return (
    <div className={`metric-card ${toneClasses[tone]}`}>
      <div className="metric-card-top">
        <span className="metric-label">{label}</span>
        <Icon size={15} strokeWidth={1.7} />
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

export function SignalTag({ label, tone = "slate", icon = "dot" }: { label: string; tone?: SignalTone; icon?: "dot" | "check" | "alert" | "info" | "loading" }) {
  const Icon = icon === "check" ? Check : icon === "alert" ? CircleAlert : icon === "info" ? Info : icon === "loading" ? LoaderCircle : null;
  return (
    <span className={`signal-tag ${toneClasses[tone]}`}>
      {Icon ? <Icon className={icon === "loading" ? "spin" : ""} size={12} /> : <span className="status-dot" />}
      {label}
    </span>
  );
}

export function TinySparkline({ points, tone = "teal" }: { points: number[]; tone?: SignalTone }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 32 - ((point - min) / Math.max(1, max - min)) * 27;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className={`tiny-sparkline ${toneClasses[tone]}`} viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,36 ${coords} 100,36`} className="spark-fill" />
    </svg>
  );
}

export function CornerMark({ className = "" }: { className?: string }) {
  return <span className={`corner-mark ${className}`} aria-hidden="true" />;
}

export function RailButton({ active, icon: Icon, label, onClick, badge }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void; badge?: string }) {
  return (
    <button className={`rail-button ${active ? "active" : ""}`} onClick={onClick} aria-label={label} title={label}>
      <Icon size={18} strokeWidth={1.7} />
      <span>{label}</span>
      {badge && <b>{badge}</b>}
    </button>
  );
}

export function LinkButton({ children, onClick, icon = true, tone = "ghost" }: { children: ReactNode; onClick?: () => void; icon?: boolean; tone?: "ghost" | "solid" }) {
  return (
    <button className={`link-button ${tone}`} onClick={onClick}>
      {children}
      {icon && <ArrowUpRight size={14} />}
    </button>
  );
}

export function CountdownBar({ percent, tone = "amber" }: { percent: number; tone?: SignalTone }) {
  return (
    <div className={`countdown-track ${toneClasses[tone]}`}>
      <div className="countdown-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
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
