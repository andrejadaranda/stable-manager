// Dashboard route loading skeleton. Streams instantly so the user
// sees the layout shape while the server fetches summary data.

import { Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0 flex flex-col gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </header>

      {/* CTA band */}
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr_1fr] gap-3">
        <Skeleton className="h-20" rounded="2xl" />
        <Skeleton className="h-20" rounded="2xl" />
        <Skeleton className="h-20" rounded="2xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
        <div className="flex flex-col gap-5 min-w-0">
          <Skeleton className="h-44" rounded="2xl" />
          <Skeleton className="h-32" rounded="2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Skeleton className="h-44" rounded="2xl" />
            <Skeleton className="h-44" rounded="2xl" />
          </div>
        </div>
        <Skeleton className="h-80" rounded="2xl" />
      </div>
    </div>
  );
}
