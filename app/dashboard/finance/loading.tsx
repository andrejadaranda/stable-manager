import { Skeleton } from "@/components/ui";

export default function FinanceLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-44" rounded="xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Skeleton className="h-28" rounded="2xl" />
        <Skeleton className="h-28" rounded="2xl" />
        <Skeleton className="h-28" rounded="2xl" />
      </div>

      <Skeleton className="h-72" rounded="2xl" />
      <Skeleton className="h-64" rounded="2xl" />
    </div>
  );
}
