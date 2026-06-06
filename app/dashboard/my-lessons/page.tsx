import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { getFarrierVisitsForCalendar } from "@/services/farrierVisits";
import { listServices } from "@/services/services";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { FarrierPanel } from "@/components/calendar/farrier-panel";
import { listMyHorses } from "@/services/myHorses";
import { listLessonRequestsForClient } from "@/services/lessonRequests";
import {
  RequestLessonButton,
  type HorseChoice,
} from "@/components/lessonRequests/request-lesson-button";
import { MyLessonRequestsSection } from "@/components/lessonRequests/my-lesson-requests-section";

export const dynamic = "force-dynamic";

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
  const [lessons, services, myHorses, myRequests, farrierVisits] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    listServices(),
    listMyHorses().catch(() => []),
    listLessonRequestsForClient().catch(() => []),
    getFarrierVisitsForCalendar(start.toISOString(), end.toISOString()).catch(() => []),
  ]);

  // The "Request a lesson" picker offers horses the client either owns or has
  // lessoned with (listMyHorses already returns that union). RLS on the insert
  // side enforces the same constraint, so the dropdown can't be tampered with.
  const horseChoices: HorseChoice[] = myHorses.map((h) => ({
    id:   h.id,
    name: h.name,
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-navy-900 leading-none">
            My lessons
          </h1>
          <p className="text-sm text-ink-500 mt-2">
            Your weekly calendar. Request a new lesson — the stable will confirm
            time, horse, and trainer.
          </p>
        </div>
        <RequestLessonButton horses={horseChoices} />
      </header>

      <CalendarShell
        lessons={lessons}
        weekStart={start}
        basePath="/dashboard/my-lessons"
        editable={false}
      />

      <FarrierPanel visits={farrierVisits ?? []} editable={false} />

      <MyLessonRequestsSection items={myRequests} />

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
