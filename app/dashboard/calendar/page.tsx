import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { listTrainers } from "@/services/profiles";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { WeekView } from "@/components/calendar/week-view";
import { CreateLessonPanel } from "@/components/calendar/create-lesson-form";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Calendar</h1>
        <CreateLessonPanel
          clients={clients ?? []}
          horses={horses ?? []}
          trainers={trainers ?? []}
        />
      </div>
      <WeekView
        lessons={lessons}
        weekStart={start}
        basePath="/dashboard/calendar"
        editable
      />
    </div>
  );
}
