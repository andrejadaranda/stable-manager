import Link from "next/link";
import { cn } from "./cn";

/**
 * Module-level empty state. Always answers two questions:
 * 1. Why is this empty? (title)
 * 2. What should I do? (body + CTA)
 *
 * The illustration is intentionally abstract — soft brand-colored
 * shape, not a stock illustration. Keeps the product feel quiet
 * and grown-up.
 */
type Action = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function EmptyState({
  title,
  body,
  primary,
  secondary,
  className,
  icon,
}: {
  title: string;
  body: string;
  primary?: Action;
  secondary?: Action;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "card-elevated flex flex-col items-center text-center px-6 py-12 md:py-16",
        className,
      )}
    >
      <div className="mb-5">{icon ?? <DefaultMark />}</div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="text-sm text-ink-500 mt-2 max-w-sm leading-relaxed">{body}</p>
      {(primary || secondary) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {primary && <PrimaryAction action={primary} />}
          {secondary && <SecondaryAction action={secondary} />}
        </div>
      )}
    </div>
  );
}

function PrimaryAction({ action }: { action: Action }) {
  const cls =
    "inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-medium " +
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm transition-colors";
  if (action.href) return <Link href={action.href} className={cls}>{action.label}</Link>;
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

function SecondaryAction({ action }: { action: Action }) {
  const cls =
    "inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-medium " +
    "text-ink-700 hover:bg-ink-100/60 transition-colors";
  if (action.href) return <Link href={action.href} className={cls}>{action.label}</Link>;
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

/** Default abstract brand mark — soft warm circle + arc. */
function DefaultMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
      <circle cx="28" cy="28" r="26" fill="#FBF1EA" />
      <circle cx="28" cy="28" r="14" fill="#F5DDCB" />
      <path
        d="M14 36c4 4 10 6 14 6s10-2 14-6"
        stroke="#B25430"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
