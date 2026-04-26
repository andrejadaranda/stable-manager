import { requirePageRole } from "@/lib/auth/redirects";
import { getCalendar } from "@/services/lessons";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { WeekView } from "@/components/calendar/week-view";

export default async function MyLessonsPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  await requirePageRole("client");

  const ref = searchParams.date ? new Date(searchParams.date) : new Date();
  const start = startOfWeek(ref);
  const end = addDays(start, 7);

  // RLS narrows lessons to the caller's own client_id.
  const lessons = await getCalendar(start.toISOString(), end.toISOString());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">My Lessons</h1>
      <WeekView
        lessons={lessons}
        weekStart={start}
        basePath="/dashboard/my-lessons"
      />
    </div>
  );
}
