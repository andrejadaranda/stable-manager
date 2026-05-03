// Print-friendly weekly schedule. A4 landscape-ish layout: 7 days
// across, lessons listed chronologically per day. Pinned to barn
// noticeboard / clipped to a stable wall — old-school workflow that's
// still real even with a calendar app.
//
// Owner + employee. Reuses the same calendar lessons feed.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { getOwnStable } from "@/services/account";
import { startOfWeek, addDays, fmtTime, fmtDayLabel } from "@/lib/utils/dates";
import { PrintInvoiceButton as PrintButton } from "@/components/clients/print-invoice-button";

export const dynamic = "force-dynamic";

export default async function PrintSchedulePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requirePageRole("owner", "employee");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const weekStart = startOfWeek(ref);
  const weekEnd = addDays(weekStart, 7);

  const [lessons, stable] = await Promise.all([
    getCalendar(weekStart.toISOString(), weekEnd.toISOString()),
    getOwnStable().catch(() => null),
  ]);

  // Bucket per day
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const buckets = days.map((d) => {
    const sameDay = lessons.filter((l) => {
      const ls = new Date(l.starts_at);
      return ls.getFullYear() === d.getFullYear()
        && ls.getMonth() === d.getMonth()
        && ls.getDate() === d.getDate()
        && l.status !== "cancelled";
    });
    sameDay.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    return { day: d, lessons: sameDay };
  });

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${
    addDays(weekEnd, -1).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }`;

  return (
    <>
      <style>{`
        @media print {
          aside, nav, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body { background: white !important; }
          @page { size: A4 landscape; margin: 10mm; }
          .day-bucket { break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/calendar"
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          ← Back to calendar
        </Link>
        <PrintButton label="Print schedule" />
      </div>

      <article className="bg-white rounded-2xl shadow-soft p-6 md:p-8 print:shadow-none print:rounded-none">
        <header className="flex items-start justify-between gap-6 pb-5 border-b-2 border-ink-200 mb-5">
          <div>
            <p
              className="text-2xl text-navy-900 leading-none"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600 }}
            >
              {stable?.name ?? "Stable"} · Weekly schedule
            </p>
            <p className="text-[12px] text-ink-500 mt-1">
              {rangeLabel} · printed {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <p className="text-[11px] text-ink-500 italic">Longrein.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {buckets.map(({ day, lessons: list }) => (
            <section
              key={day.toISOString()}
              className="day-bucket border border-ink-200 rounded-xl overflow-hidden"
            >
              <header className="bg-ink-50 px-3 py-2 border-b border-ink-200">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className="text-sm font-semibold text-navy-900 tabular-nums leading-tight">
                  {fmtDayLabel(day)}
                </p>
              </header>
              <ul className="flex flex-col">
                {list.length === 0 ? (
                  <li className="px-3 py-3 text-[11px] text-ink-400 italic text-center">
                    No lessons
                  </li>
                ) : (
                  list.map((l) => (
                    <li
                      key={l.id}
                      className="px-3 py-2 border-b border-ink-100 last:border-b-0"
                    >
                      <p className="text-[12px] font-semibold text-navy-900 tabular-nums">
                        {fmtTime(l.starts_at)}–{fmtTime(l.ends_at)}
                      </p>
                      <p className="text-[12px] text-ink-700 truncate">
                        {l.horse?.name ?? "—"}
                        <span className="text-ink-400"> · </span>
                        {l.client?.full_name ?? "—"}
                      </p>
                      {l.trainer?.full_name && (
                        <p className="text-[10.5px] text-ink-500 truncate">
                          {l.trainer.full_name}
                        </p>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-6 pt-4 border-t border-ink-200 text-[10px] text-ink-400 italic">
          Generated by Longrein. Cancelled lessons hidden. Times shown in the stable's local timezone.
        </footer>
      </article>
    </>
  );
}
