import { cn } from "./cn";

/**
 * Standard page chrome. Used by every dashboard route.
 *   <PageHeader title="..." subtitle="..." actions={<...>} />
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6 mb-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tightest text-ink-900">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-ink-500 mt-1.5 max-w-xl">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
      )}
    </header>
  );
}
