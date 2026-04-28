import { cn } from "./cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "section" | "article";
  padded?: boolean;
  interactive?: boolean;
};

/**
 * Soft-elevation surface. Default = no padding (lists/tables fit edge-to-edge).
 * Use `padded` for content panels.
 */
export function Card({
  as: Tag = "div",
  padded = false,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cn(
        "card-elevated",
        padded && "p-6",
        interactive && "is-interactive cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-6 py-5 border-b border-ink-100",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && (
          <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
