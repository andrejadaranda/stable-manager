import { requireBusinessAccount } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { listActivePackagesForStable } from "@/services/packages";
import { listServices } from "@/services/services";
import { listArenas } from "@/services/arenas";
import { getFarrierVisitsForCalendar } from "@/services/farrierVisits";
import { startOfWeek, addDays, fmtISODate } from "@/lib/utils/dates";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { MonthView } from "@/components/calendar/month-view";
import { CalendarViewToggle } from "@/components/calendar/view-toggle";
import { FarrierPanel } from "@/components/calendar/farrier-panel";
import { EmptyState } from "@/components/ui";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { date?: string; view?: string };
}) {
  await requireBusinessAccount("owner", "employee");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const refDate = fmtISODate(ref);

  // ── Month view: read-only 6-week overview, click a day to book ──
  if (searchParams.view === "month") {
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
      <div className="flex flex-col gap-5">
        <CalendarViewToggle view="month" weekDate={refDate} monthDate={refDate} basePath="/dashboard/calendar" />
        <MonthView
          lessons={mLessons}
          farrierVisits={mFarrier ?? []}
          gridStart={gridStart}
          monthIndex={ref.getMonth()}
          monthLabel={monthFirst.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          basePath="/dashboard/calendar"
          prevDate={fmtISODate(prev)}
          nextDate={fmtISODate(next)}
        />
      </div>
    );
  }

  const start = startOfWeek(ref);
  const end = addDays(start, 7);

  // Fan out the reads in parallel — RLS does the tenant scoping.
  // Horse list is filtered to lesson-eligible: stable-owned or
  // client-owned-and-opted-in. Boarding-only horses are hidden so the
  // calendar dropdown stays clean.
  const [lessons, clients, horses, trainers, activePackages, services, arenas, farrierVisits, allHorses] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    listClients({ activeOnly: true }),
    listHorses({ activeOnly: true, lessonsOnly: true }),
    listTrainers(),
    listActivePackagesForStable(),
    listServices({ activeOnly: true }),
    listArenas({ activeOnly: true }).catch(() => []),
    getFarrierVisitsForCalendar(start.toISOString(), end.toISOString()).catch(() => []),
    // ALL horses (incl. inactive/retired private boarders) — any horse can
    // need a farrier/vet, so the visit form must not hide them.
    listHorses({}).catch(() => []),
  ]);

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
      <CalendarViewToggle view="week" weekDate={refDate} monthDate={refDate} basePath="/dashboard/calendar" />
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
        editable
      />

      <FarrierPanel
        visits={farrierVisits ?? []}
        horses={(allHorses ?? []).map((h) => ({ id: h.id, name: h.name }))}
        editable
      />
    </div>
  );
}
