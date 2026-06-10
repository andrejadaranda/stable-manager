import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { getFarrierVisitsForCalendar } from "@/services/farrierVisits";
import { listServices } from "@/services/services";
import { startOfWeek, addDays, fmtISODate } from "@/lib/utils/dates";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { MonthView } from "@/components/calendar/month-view";
import { CalendarViewToggle } from "@/components/calendar/view-toggle";
import { FarrierPanel } from "@/components/calendar/farrier-panel";
import { listMyHorses, listStableLessonHorses } from "@/services/myHorses";
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
  searchParams: { date?: string; view?: string };
}) {
  await requirePageRole("client");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const refDate = fmtISODate(ref);

  // Month is the default landing (matches the owner calendar). Date-based
  // navigation carries ?date and drops to week; ?view=week|month overrides.
  const showMonth =
    searchParams.view === "month" || (!searchParams.view && !searchParams.date);

  // The "Request a lesson" picker offers horses the client owns or has
  // ridden, PLUS the stable's lesson pool (school horses). Owned/ridden are
  // listed first; the insert-side RLS accepts all three cases.
  const [myHorses, stableHorses, myRequests] = await Promise.all([
    listMyHorses().catch(() => []),
    listStableLessonHorses().catch(() => []),
    listLessonRequestsForClient().catch(() => []),
  ]);

  const seen = new Set<string>();
  const horseChoices: HorseChoice[] = [];
  for (const h of myHorses) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    horseChoices.push({ id: h.id, name: h.name });
  }
  for (const h of stableHorses) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    horseChoices.push({ id: h.id, name: h.name });
  }

  const header = (
    <header className="flex items-baseline justify-between gap-3 flex-wrap">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-navy-900 leading-none">
          My lessons
        </h1>
        <p className="text-sm text-ink-500 mt-2">
          Your calendar. Request a new lesson — the stable will confirm time,
          horse, and trainer.
        </p>
      </div>
      <RequestLessonButton horses={horseChoices} />
    </header>
  );

  // ── Month view ──
  if (showMonth) {
    const monthFirst = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const gridStart = startOfWeek(monthFirst);
    const gridEnd = addDays(gridStart, 42);
    const [mLessons, mFarrier] = await Promise.all([
      getCalendar(gridStart.toISOString(), gridEnd.toISOString()),
      getFarrierVisitsForCalendar(gridStart.toISOString(), gridEnd.toISOString()).catch(() => []),
    ]);
    const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return (
      <div className="flex flex-col gap-6">
        {header}
        <CalendarViewToggle view="month" weekDate={refDate} monthDate={refDate} basePath="/dashboard/my-lessons" />
        <MonthView
          lessons={mLessons}
          farrierVisits={mFarrier ?? []}
          blocks={[]}
          gridStart={gridStart}
          monthIndex={ref.getMonth()}
          monthLabel={monthFirst.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          basePath="/dashboard/my-lessons"
          prevDate={fmtISODate(prev)}
          nextDate={fmtISODate(next)}
        />
        <MyLessonRequestsSection items={myRequests} />
        <ServicesCard />
      </div>
    );
  }

  // ── Week view ──
  const start = startOfWeek(ref);
  const end = addDays(start, 7);
  const [lessons, farrierVisits] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    getFarrierVisitsForCalendar(start.toISOString(), end.toISOString()).catch(() => []),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {header}
      <CalendarViewToggle view="week" weekDate={refDate} monthDate={refDate} basePath="/dashboard/my-lessons" />
      <CalendarShell
        lessons={lessons}
        weekStart={start}
        basePath="/dashboard/my-lessons"
        farrierVisits={farrierVisits ?? []}
        editable={false}
      />
      <FarrierPanel visits={farrierVisits ?? []} editable={false} />
      <MyLessonRequestsSection items={myRequests} />
      <ServicesCard />
    </div>
  );
}

async function ServicesCard() {
  const services = await listServices().catch(() => []);
  if (services.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl text-navy-900">Services &amp; prices</h2>
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
  );
}
