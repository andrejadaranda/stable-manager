// Week / Month switch for the calendar. Plain links so it works without
// client JS; the page fetches the right range based on ?view.

import Link from "next/link";

export function CalendarViewToggle({
  view,
  weekDate,
  monthDate,
  basePath,
}: {
  view: "week" | "month";
  weekDate: string;
  monthDate: string;
  basePath: string;
}) {
  const base = "h-9 px-4 inline-flex items-center rounded-lg text-[13px] font-medium transition-colors";
  const on = "bg-brand-600 text-white";
  const off = "text-ink-600 hover:bg-ink-100";
  return (
    <div className="inline-flex items-center gap-1 bg-ink-50 rounded-xl p-1 w-fit">
      <Link href={`${basePath}?date=${weekDate}`} className={`${base} ${view === "week" ? on : off}`}>
        Week
      </Link>
      <Link href={`${basePath}?view=month&date=${monthDate}`} className={`${base} ${view === "month" ? on : off}`}>
        Month
      </Link>
    </div>
  );
}
