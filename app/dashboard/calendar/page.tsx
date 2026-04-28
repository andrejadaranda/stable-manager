import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { WeekView } from "@/components/calendar/week-view";
import { CreateLessonPanel } from "@/components/calendar/create-lesson-form";
import { PageHeader, EmptyState } from "@/components/ui";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requirePageRole("owner", "employee");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const start = startOfWeek(ref);
  const end = addDays(start, 7);

  // Fan out the four reads in parallel — RLS does the tenant scoping.
  const [lessons, clients, horses, trainers] = await Promise.all([
    getCalendar(start.toISOString(), end.toISOString()),
    listClients({ activeOnly: true }),
    listHorses({ activeOnly: true }),
    listTrainers(),
  ]);

  // Fresh-stable nudge: if no horses or no clients, calendar can't book
  // anything yet — show a guided empty state instead of an empty grid.
  const cantBookYet = (horses?.length ?? 0) === 0 || (clients?.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        subtitle="Schedule lessons, edit times, and track status."
        actions={
          <CreateLessonPanel
            clients={clients ?? []}
            horses={horses ?? []}
            trainers={trainers ?? []}
          />
        }
      />

      {cantBookYet ? (
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
      ) : (
        <WeekView
          lessons={lessons}
          weekStart={start}
          basePath="/dashboard/calendar"
          editable
        />
      )}
    </div>
  );
}
