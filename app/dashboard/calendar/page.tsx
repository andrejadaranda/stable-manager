import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { listActivePackagesForStable } from "@/services/packages";
import { listServices } from "@/services/services";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import { EmptyState } from "@/components/ui";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requirePageRole("owner", "employee");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const start = startOfWeek(ref);
  const end = addDays(start, 7);

  // Fan out the reads in parallel — RLS does the tenant scoping.
  // Horse list is filtered to lesson-eligible: stable-owned or
  // client-owned-and-opted-in. Boarding-only horses are hidden so the
  // calendar dropdown stays clean.
  const [lessons, clients, horses, trainers, activePackages, services] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    listClients({ activeOnly: true }),
    listHorses({ activeOnly: true, lessonsOnly: true }),
    listTrainers(),
    listActivePackagesForStable(),
    listServices({ activeOnly: true }),
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
    <CalendarShell
      lessons={lessons}
      weekStart={start}
      basePath="/dashboard/calendar"
      clients={clients ?? []}
      horses={horses ?? []}
      trainers={trainers ?? []}
      services={services ?? []}
      activePackagesByClient={activePackages}
      editable
    />
  );
}
