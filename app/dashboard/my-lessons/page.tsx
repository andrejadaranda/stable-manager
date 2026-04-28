import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { listServices } from "@/services/services";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { CalendarShell } from "@/components/calendar/calendar-shell";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export default async function MyLessonsPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requirePageRole("client");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const start = startOfWeek(ref);
  const end = addDays(start, 7);

  // RLS narrows lessons to the caller's own client_id; services view is
  // active-only when the caller is a client.
  const [lessons, services] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    listServices(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <CalendarShell
        lessons={lessons}
        weekStart={start}
        basePath="/dashboard/my-lessons"
        editable={false}
      />

      {services.length > 0 && (
        <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-xl text-navy-900">Services & prices</h2>
            <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-ink-500">
              From your stable
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {services.map((s) => (
              <li
                key={s.id}
                className="flex items-baseline justify-between gap-3 py-2 border-b border-ink-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{s.name}</p>
                  {s.description && (
                    <p className="text-[11.5px] text-ink-500 mt-0.5 truncate">
                      {s.description}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums text-navy-900">
                    {FMT_EUR.format(Number(s.base_price))}
                  </p>
                  <p className="text-[11px] text-ink-500 tabular-nums">
                    {s.default_duration_minutes} min
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
