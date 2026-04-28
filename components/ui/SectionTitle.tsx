import { cn } from "./cn";

/** Small label above a card / list section. */
export function SectionTitle({
  children,
  hint,
  action,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3 mb-3", className)}>
      <div>
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-ink-500 font-medium">
          {children}
        </h2>
        {hint && <p className="text-xs text-ink-500 mt-1">{hint}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
