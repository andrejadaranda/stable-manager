// Calendar route loading skeleton.

import { Skeleton } from "@/components/ui";

export default function CalendarLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" rounded="xl" />
          <Skeleton className="h-10 w-32" rounded="xl" />
        </div>
      </div>

      {/* Time grid placeholder */}
      <div className="bg-white rounded-2xl shadow-soft p-4">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
          {Array.from({ length: 56 }).map((_, i) => (
            <Skeleton key={i + 100} className="h-12" />
          ))}
        </div>
      </div>
    </div>
  );
}
