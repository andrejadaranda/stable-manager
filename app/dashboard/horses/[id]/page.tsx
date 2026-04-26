import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getHorse } from "@/services/horses";
import { getHorseLessons, getHorseWorkload } from "@/services/lessons";
import {
  startOfWeek,
  addDays,
  fmtDayLabel,
  fmtTime,
} from "@/lib/utils/dates";
import { EditHorseButton } from "@/components/horses/edit-horse-dialog";

export default async function HorseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRole("owner", "employee");

  const horse = await getHorse(params.id);
  if (!horse) notFound();

  const start = startOfWeek(new Date());
  const end = addDays(start, 7);

  const [workload, recent] = await Promise.all([
    getHorseWorkload(params.id, start.toISOString(), end.toISOString()),
    getHorseLessons(params.id, { limit: 10 }),
  ]);

  const overWeek = workload.total_lessons >= horse.weekly_lesson_limit;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/dashboard/horses"
        className="text-sm text-neutral-600 hover:underline w-fit"
      >
        ← Horses
      </Link>

      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{horse.name}</h1>
          <span
            className={`text-sm ${
              horse.active ? "text-emerald-700" : "text-neutral-500"
            }`}
          >
            {horse.active ? "Active" : "Inactive"}
          </span>
        </div>
        <EditHorseButton horse={horse} />
      </header>

      <section className="border border-neutral-200 rounded-md bg-white p-4">
        <h2 className="text-sm font-medium mb-2">This week</h2>
        <p
          className={`text-sm ${
            overWeek ? "text-red-700 font-medium" : "text-neutral-700"
          }`}
        >
          {workload.total_lessons} lesson
          {workload.total_lessons === 1 ? "" : "s"} ·{" "}
          {workload.total_minutes} min
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          Limit: {horse.daily_lesson_limit}/day, {horse.weekly_lesson_limit}/wk
        </p>
      </section>

      {horse.notes && (
        <section className="border border-neutral-200 rounded-md bg-white p-4">
          <h2 className="text-sm font-medium mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap text-neutral-800">
            {horse.notes}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Recent lessons</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">No lessons yet.</p>
        ) : (
          <div className="border border-neutral-200 rounded-md bg-white divide-y divide-neutral-200">
            {recent.map((l) => (
              <div
                key={l.id}
                className="px-4 py-2 text-sm grid grid-cols-[1.4fr_1fr_1fr_auto] gap-3 items-center"
              >
                <div className="text-neutral-700">
                  {fmtDayLabel(new Date(l.starts_at))} · {fmtTime(l.starts_at)}
                </div>
                <div>{l.client?.full_name ?? "—"}</div>
                <div className="text-neutral-600">
                  {l.trainer?.full_name ?? "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                  {l.status.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
