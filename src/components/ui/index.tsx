/**
 * Shared UI primitives for the COROD Simulator.
 *
 * The goal of these components is CONSISTENCY: every card, button, badge and
 * segmented control across the app should look and behave identically instead
 * of each screen re-inventing spacing / color / radius inline. Prefer these
 * over ad-hoc Tailwind class soup.
 */
import React from 'react';

/** Join class names, dropping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Card / Panel
// ---------------------------------------------------------------------------

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Removes default padding when you need a flush container. */
  flush?: boolean;
}

/** Standard surface card: slate-900 bg, slate-800 border, xl radius. */
export const Card: React.FC<CardProps> = ({ flush, className, children, ...rest }) => (
  <div
    className={cx(
      'bg-slate-900 border border-slate-800 rounded-xl shadow-sm',
      !flush && 'p-4',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

interface PanelHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Right-aligned actions (buttons, selectors). */
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent panel header: title + optional subtitle/icon on the left, actions right. */
export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className,
}) => (
  <div className={cx('flex flex-wrap items-center justify-between gap-3', className)}>
    <div className="flex items-center gap-3 min-w-0">
      {icon && <div className="shrink-0 text-slate-400">{icon}</div>}
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-100 truncate">{title}</div>
        {subtitle && <div className="text-2xs text-slate-400 truncate">{subtitle}</div>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Eyebrow label
// ---------------------------------------------------------------------------

/** Tiny uppercase label used above fields / on the left of a stat. */
export const Eyebrow: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className,
  children,
  ...rest
}) => (
  <span className={cx('eyebrow', className)} {...rest}>
    {children}
  </span>
);

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg border transition-colors active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white',
  secondary: 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100',
  ghost: 'bg-transparent hover:bg-slate-800 border-transparent text-slate-300 hover:text-white',
  danger: 'bg-red-600 hover:bg-red-500 border-red-500 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'text-2xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Badge / StatBadge
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'success' | 'danger' | 'info' | 'warning' | 'brand';

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-slate-200',
  success: 'text-emerald-400',
  danger: 'text-red-400',
  info: 'text-blue-400',
  warning: 'text-amber-400',
  brand: 'text-amber-400',
};

interface StatBadgeProps {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
}

/** A labeled read-only telemetry pill: "DEPTH  1,200 FT". */
export const StatBadge: React.FC<StatBadgeProps> = ({ label, value, tone = 'neutral', className }) => (
  <div
    className={cx(
      'px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1.5',
      className,
    )}
  >
    <Eyebrow>{label}</Eyebrow>
    <span className={cx('stat-value text-sm', TONE_TEXT[tone])}>{value}</span>
  </div>
);

interface BadgeProps {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}

/** Small status chip. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, children }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-950 border border-slate-800',
      TONE_TEXT[tone],
      className,
    )}
  >
    {children}
  </span>
);

// ---------------------------------------------------------------------------
// SegmentedControl
// ---------------------------------------------------------------------------

interface Segment<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  segments: ReadonlyArray<Segment<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Optional eyebrow label shown before the control. */
  label?: React.ReactNode;
  className?: string;
}

/** The repeated "pick one" selector (VIEW, LEVEL, tabs, display mode). */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cx('flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800', className)}>
      {label && <Eyebrow className="px-1.5">{label}</Eyebrow>}
      {segments.map((seg) => {
        const active = seg.id === value;
        return (
          <button
            key={seg.id}
            type="button"
            title={seg.title}
            aria-pressed={active}
            onClick={() => onChange(seg.id)}
            className={cx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-semibold transition-colors',
              active
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800',
            )}
          >
            {seg.icon}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
