import { requireBusinessAccount } from "@/lib/auth/redirects";
import { getCalendar, autoCompletePastLessons } from "@/services/lessons";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { listActivePackagesForStable } from "@/services/packages";
import { listServices } from "@/services/services";
import { listArenas } from "@/services/arenas";
import { getFarrierVisitsForCalendar } from "@/services/farrierVisits";
import { listAvailabilityBlocks } from "@/services/availability";
import { listPersonalEventsForCalendar } from "@/services/personalEvents";
import { isGoogleConnected } from "@/services/googleCalendar";
import { startOfWeek, addDays, fmtISODate } from "@/lib/utils/dates";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { MonthView } from "@/components/calendar/month-view";
import { CalendarViewToggle } from "@/components/calendar/view-toggle";
import { CalendarSearchButton } from "@/components/calendar/calendar-search-button";
import { TimeOffPanel } from "@/components/calendar/time-off-panel";
import { FarrierPanel } from "@/components/calendar/farrier-panel";
import { EmptyState } from "@/components/ui";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { date?: string; view?: string };
}) {
  await requireBusinessAccount("owner", "employee");

  // Auto-complete any lessons whose time has passed, so the calendar shows the
  // right status immediately (not only after the daily cron). Best-effort.
  await autoCompletePastLessons().catch(() => {});

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const refDate = fmtISODate(ref);

  // ── MONTH view is the default landing (Andrėja 2026-09-26 — "month view
  //    turetu buti default"). Week is one tap away via the toggle (?view=week)
  //    or by tapping a day in the month grid (which links to ?date=…). So we
  //    show week only when a specific day/week is requested, or view=week. ──
  const showMonth =
    searchParams.view === "month" ||
    (searchParams.view !== "week" && !searchParams.date);

  if (showMonth) {
    const monthFirst = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const gridStart = startOfWeek(monthFirst);
    const gridEnd = addDays(gridStart, 42);
    // Load the edit-needed rosters too so lessons are tappable → Edit lesson
    // straight from the month grid (Andrėja: "paspaudus — redaguoju").
    const [mLessons, mFarrier, mBlocks, mEvents, mClients, mHorses, mServices, mArenas, mPackages] = await Promise.all([
      getCalendar(gridStart.toISOString(), gridEnd.toISOString()),
      getFarrierVisitsForCalendar(gridStart.toISOString(), gridEnd.toISOString()).catch(() => []),
      listAvailabilityBlocks(gridStart.toISOString(), gridEnd.toISOString()).catch(() => []),
      listPersonalEventsForCalendar(gridStart.toISOString(), gridEnd.toISOString()).catch(() => []),
      listClients({ activeOnly: true }).catch(() => []),
      listHorses({ activeOnly: true, lessonsOnly: true }).catch(() => []),
      listServices({ activeOnly: true }).catch(() => []),
      listArenas({ activeOnly: true }).catch(() => []),
      listActivePackagesForStable().catch(() => ({})),
    ]);
    const mGoogleConnected = await isGoogleConnected().catch(() => false);
    const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <CalendarViewToggle view="month" weekDate={refDate} monthDate={refDate} basePath="/dashboard/calendar" />
          <CalendarSearchButton />
        </div>
        <MonthView
          lessons={mLessons}
          farrierVisits={mFarrier ?? []}
          blocks={mBlocks ?? []}
          personalEvents={mEvents ?? []}
          googleConnected={mGoogleConnected}
          gridStart={gridStart}
          monthIndex={ref.getMonth()}
          monthLabel={monthFirst.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          basePath="/dashboard/calendar"
          prevDate={fmtISODate(prev)}
          nextDate={fmtISODate(next)}
          clients={(mClients ?? []).map((c) => ({ id: c.id, full_name: c.full_name }))}
          horses={(mHorses ?? []).map((h) => ({ id: h.id, name: h.name }))}
          services={mServices ?? []}
          arenas={mArenas ?? []}
          activePackagesByClient={mPackages ?? {}}
          editable
        />
        <TimeOffPanel blocks={mBlocks ?? []} />
      </div>
    );
  }

  const start = startOfWeek(ref);
  const end = addDays(start, 7);

  // Fan out the reads in parallel — RLS does the tenant scoping.
  // Horse list is filtered to lesson-eligible: stable-owned or
  // client-owned-and-opted-in. Boarding-only horses are hidden so the
  // calendar dropdown stays clean.
  const [lessons, clients, horses, trainers, activePackages, services, arenas, farrierVisits, personalEvents, googleConnected, allHorses] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    listClients({ activeOnly: true }),
    listHorses({ activeOnly: true, lessonsOnly: true }),
    listTrainers(),
    listActivePackagesForStable(),
    listServices({ activeOnly: true }),
    listArenas({ activeOnly: true }).catch(() => []),
    getFarrierVisitsForCalendar(start.toISOString(), end.toISOString()).catch(() => []),
    listPersonalEventsForCalendar(start.toISOString(), end.toISOString()).catch(() => []),
    isGoogleConnected().catch(() => false),
    // Horses currently at the stable (incl. inactive/retired private boarders
    // — any present horse can need a farrier/vet) but NOT ones that have
    // already departed. A departed horse stays on its past visits; it just
    // isn't offered for new ones.
    listHorses({ excludeDeparted: true }).catch(() => []),
  ]);
  const blocks = await listAvailabilityBlocks(start.toISOString(), end.toISOString()).catch(() => []);

  // Fresh-stable nudge: if no horses or no clients, calendar can't book
  // anything yet — show a guided empty state instead of an empty grid.
  const cantBookYet = (horses?.length ?? 0) === 0 || (clients?.length ?? 0) === 0;

  if (cantBookYet) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          title="Add a horse and a client to start booking"
          body="The calendar is ready. To create your first lesson you need at least one active horse and one active client on your roster."
          primary={
            (horses?.length ?? 0) === 0
              ? { label: "Add your first horse", href: "/dashboard/horses?new=1" }
              : { label: "Add your first client", href: "/dashboard/clients?new=1" }
          }
          secondary={
            (horses?.length ?? 0) === 0 && (clients?.length ?? 0) === 0
              ? { label: "View clients", href: "/dashboard/clients" }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <CalendarViewToggle view="week" weekDate={refDate} monthDate={refDate} basePath="/dashboard/calendar" />
        <CalendarSearchButton />
      </div>
      <CalendarShell
        lessons={lessons}
        weekStart={start}
        basePath="/dashboard/calendar"
        clients={clients ?? []}
        horses={horses ?? []}
        trainers={trainers ?? []}
        services={services ?? []}
        arenas={arenas ?? []}
        activePackagesByClient={activePackages}
        farrierVisits={farrierVisits ?? []}
        blocks={blocks ?? []}
        personalEvents={personalEvents ?? []}
        googleConnected={googleConnected ?? false}
        editable
      />

      <FarrierPanel
        visits={farrierVisits ?? []}
        horses={(allHorses ?? []).map((h) => ({ id: h.id, name: h.name }))}
        editable
      />

      <TimeOffPanel blocks={blocks ?? []} />
    </div>
  );
}
