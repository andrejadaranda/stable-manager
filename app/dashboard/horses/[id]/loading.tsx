// Horse profile loading skeleton — preserves the magazine hero shape
// so layout doesn't shift when content streams in.

import { Skeleton } from "@/components/ui";

export default function HorseProfileLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />

      <div className="bg-white rounded-3xl shadow-soft overflow-hidden">
        <Skeleton className="h-32 md:h-36 w-full" rounded="2xl" />
        <div className="px-5 md:px-7 pb-5 md:pb-6 -mt-12 md:-mt-14">
          <div className="flex flex-col md:flex-row md:items-end gap-5">
            <Skeleton className="w-28 h-28 md:w-32 md:h-32 self-center md:self-end" rounded="2xl" />
            <div className="flex-1 flex flex-col gap-2 mt-3 md:mt-0">
              <Skeleton className="h-9 w-48 mx-auto md:mx-0" />
              <Skeleton className="h-3 w-32 mx-auto md:mx-0" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" rounded="2xl" />
            ))}
          </div>
        </div>
      </div>

      <Skeleton className="h-10" rounded="xl" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <Skeleton className="h-96" rounded="2xl" />
        <Skeleton className="h-96" rounded="2xl" />
      </div>
    </div>
  );
}
