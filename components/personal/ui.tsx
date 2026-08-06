// Presentational primitives for the command centre.
//
// Separate from components/ui/* on purpose: those are Longrein product
// components with their own consumers and their own reasons to change.
// This dashboard has a denser, more editorial look — bigger numerals,
// tighter rows, serif headings — and coupling the two would mean every
// tweak here risked a visual regression somewhere in the product.
//
// The palette is the locked Longrein one (tailwind.config.ts): Arena
// Cream surfaces, Paddock Green chrome, Saddle Tan accents.

import Link from "next/link";
import { cn } from "@/components/ui/cn";

// -------------------------------------------------------------------
// Page scaffolding
// -------------------------------------------------------------------

export function ScreenHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3 pt-1">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-400">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[26px] leading-tight tracking-tightest text-brand-700">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}

export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-6", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink-800">{title}</h2>
        {action ?? (hint && <span className="text-[11px] text-ink-400">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-200/70 bg-white/70 shadow-soft backdrop-blur-sm",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

// -------------------------------------------------------------------
// Numbers
// -------------------------------------------------------------------

type Tone = "brand" | "saddle" | "positive" | "warning" | "danger" | "neutral";

const toneText: Record<Tone, string> = {
  brand: "text-brand-700",
  saddle: "text-saddle-600",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  neutral: "text-ink-800",
};

const toneChip: Record<Tone, string> = {
  brand: "bg-brand-100 text-brand-700",
  saddle: "bg-saddle-50 text-saddle-700",
  positive: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  neutral: "bg-ink-100 text-ink-600",
};

/** Compact KPI tile. Designed to sit two- or three-up on a phone. */
export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-ink-200/70 bg-white/70 p-3.5 shadow-soft",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.13em] text-ink-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-[22px] leading-none tracking-tightest tabular-nums",
          toneText[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-ink-500">{hint}</p>}
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-tight",
        toneChip[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Goal progress bar. Shows both the actual fill and — as a hairline —
 * where she *should* be by now. A bare percentage is cheerful right up
 * until the month ends badly; the pace marker is what makes it honest.
 */
export function ProgressBar({
  ratio,
  paceRatio,
  tone = "brand",
}: {
  ratio: number;
  paceRatio?: number;
  tone?: Tone;
}) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const pacePct =
    paceRatio === undefined ? null : Math.min(100, Math.max(0, paceRatio * 100));

  const fill: Record<Tone, string> = {
    brand: "bg-brand-500",
    saddle: "bg-saddle-500",
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-400",
    neutral: "bg-ink-400",
  };

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-soft", fill[tone])}
        style={{ width: `${pct}%` }}
      />
      {pacePct !== null && pacePct > 1 && pacePct < 99 && (
        <span
          aria-hidden
          className="absolute top-0 h-full w-px bg-ink-900/35"
          style={{ left: `${pacePct}%` }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Lists and states
// -------------------------------------------------------------------

export function Row({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-b-0",
        href && "transition-colors duration-150 active:bg-surface-muted",
        className,
      )}
    >
      {children}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/**
 * Empty states carry weight in this app: most integrations start
 * unconfigured, and "nothing here yet" has to be distinguishable from
 * "this is broken". `action` is where the one-line fix goes.
 */
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-surface-muted/40 px-5 py-7 text-center">
      <p className="text-[13px] font-medium text-ink-700">{title}</p>
      {detail && (
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[12px] leading-relaxed text-ink-500">
          {detail}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Time formatting shared by the schedule lists. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}
