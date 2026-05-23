// Lesson requests widget for the owner overview.
// Auto-hides when there are no pending requests. Sits next to the care
// requests widget — both are actionable inboxes the owner should react to.

import Link from "next/link";
import type { LessonRequestWithContext } from "@/services/lessonRequests.types";

export function LessonRequestsWidget({ items }: { items: LessonRequestWithContext[] }) {
  if (items.length === 0) return null;

  const top = items.slice(0, 5);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="font-display text-xl text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>📅</span>
          Lesson requests
        </h2>
        <Link
          href="/dashboard/lesson-requests"
          className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-700 hover:text-brand-800"
        >
          Open inbox →
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {top.map((r) => {
          const date = new Date(r.requested_start);
          const dateStr = date.toLocaleString("en-GB", {
            weekday: "short", day: "2-digit", month: "short",
            hour: "2-digit", minute: "2-digit",
            timeZone: "Europe/Vilnius",
          });
          return (
            <li key={r.id}>
              <Link
                href="/dashboard/lesson-requests"
                className="
                  flex items-center gap-3 px-3 py-2 rounded-xl
                  bg-surface/40 hover:bg-surface/80 transition-colors group
                "
              >
                <span
                  className="
                    shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center
                    bg-amber-50 text-amber-700 text-base
                  "
                  aria-hidden
                >
                  📅
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">
                    {dateStr} · {r.requested_duration_min} min
                  </p>
                  <p className="text-[11.5px] text-ink-500 truncate">
                    {r.requester_name ?? "Client"}
                    {r.horse_name && <> · {r.horse_name}</>}
                  </p>
                </div>
                <span
                  className="text-ink-300 group-hover:text-brand-700 transition-colors shrink-0"
                  aria-hidden
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {items.length > top.length && (
        <p className="text-[11.5px] text-ink-500 mt-3 text-center">
          {items.length - top.length} more pending
        </p>
      )}
    </section>
  );
}
