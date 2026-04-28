import { cn } from "./cn";

/**
 * Dashboard KPI tile. Big number + label + optional trend / hint.
 * Tone is decorative — each card gets a subtle accent stripe.
 */
type Tone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const stripe: Record<Tone, string> = {
  brand:   "from-brand-100 to-transparent",
  success: "from-emerald-100 to-transparent",
  warning: "from-amber-100 to-transparent",
  danger:  "from-rose-100 to-transparent",
  info:    "from-sky-100 to-transparent",
  neutral: "from-ink-100 to-transparent",
};

const accent: Record<Tone, string> = {
  brand:   "text-brand-700",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger:  "text-rose-700",
  info:    "text-sky-700",
  neutral: "text-ink-700",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-elevated relative overflow-hidden p-5",
        "transition-transform duration-200 ease-soft hover:translate-y-[-1px]",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-16 -z-0 bg-gradient-to-b opacity-70",
          stripe[tone],
        )}
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500 font-medium">
          {label}
        </p>
        {icon && <div className={cn("opacity-60", accent[tone])}>{icon}</div>}
      </div>
      <p
        className={cn(
          "relative z-10 mt-2 text-3xl font-semibold tracking-tightest text-ink-900 tabular-nums",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="relative z-10 mt-1 text-[12px] text-ink-500 leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}
