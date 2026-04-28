import { cn } from "./cn";

type Tone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  brand:   "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger:  "bg-rose-50 text-rose-700",
  info:    "bg-sky-50 text-sky-700",
  muted:   "bg-ink-100/60 text-ink-500",
};

const dotColor: Record<Tone, string> = {
  neutral: "bg-ink-400",
  brand:   "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger:  "bg-rose-500",
  info:    "bg-sky-500",
  muted:   "bg-ink-300",
};

type BadgeProps = {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Compact status pill — tone-coded, optional leading dot. */
export function Badge({ tone = "neutral", dot = false, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide",
        toneStyles[tone],
        className,
      )}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dotColor[tone])} />}
      {children}
    </span>
  );
}

/** Lesson status → tone mapping shared across calendar + lists. */
export type LessonStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export function lessonStatusTone(s: LessonStatus): Tone {
  switch (s) {
    case "scheduled": return "info";
    case "completed": return "success";
    case "cancelled": return "muted";
    case "no_show":   return "warning";
  }
}

export function lessonStatusLabel(s: LessonStatus): string {
  switch (s) {
    case "scheduled": return "Scheduled";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "no_show":   return "No-show";
  }
}
