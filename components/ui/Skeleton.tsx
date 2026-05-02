// Tiny skeleton primitive used by route-level loading.tsx files.
// Pulses softly with the brand cream so it doesn't feel jarring
// on the warm surface.

import { cn } from "./cn";

export function Skeleton({
  className,
  rounded = "lg",
}: {
  className?: string;
  rounded?: "md" | "lg" | "xl" | "2xl" | "full";
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse bg-ink-100",
        rounded === "md"  && "rounded-md",
        rounded === "lg"  && "rounded-lg",
        rounded === "xl"  && "rounded-xl",
        rounded === "2xl" && "rounded-2xl",
        rounded === "full" && "rounded-full",
        className,
      )}
    />
  );
}

export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          rounded="md"
        />
      ))}
    </div>
  );
}
