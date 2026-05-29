import { requirePageRole } from "@/lib/auth/redirects";
import { listTrainers } from "@/services/profiles";
import { SubstitutePanel } from "@/components/team/substitute-panel";

export default async function SubstitutePage() {
  await requirePageRole("owner");
  const trainers = await listTrainers();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          Substitute trainer
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Move all <em>scheduled</em> lessons from one trainer to another in a
          date range. Completed lessons stay attached to whoever ran them.
          Conflicts (same time, same horse) are skipped individually.
        </p>
      </header>
      <SubstitutePanel trainers={trainers} />
    </div>
  );
}
