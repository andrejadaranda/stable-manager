// Clients list loading skeleton.

import { Skeleton } from "@/components/ui";

export default function ClientsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-10 w-32" rounded="xl" />
      </header>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden divide-y divide-ink-100">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-5 w-16" rounded="full" />
          </div>
        ))}
      </div>
    </div>
  );
}
