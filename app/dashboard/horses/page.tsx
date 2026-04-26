import { requirePageRole } from "@/lib/auth/redirects";
import { listHorsesWithWeeklyWorkload } from "@/services/horses";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { HorseList } from "@/components/horses/horse-list";
import { CreateHorsePanel } from "@/components/horses/create-horse-form";

export default async function HorsesPage() {
  await requirePageRole("owner", "employee");

  const start = startOfWeek(new Date());
  const end = addDays(start, 7);
  const horses = await listHorsesWithWeeklyWorkload(
    start.toISOString(),
    end.toISOString(),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Horses</h1>
        <CreateHorsePanel />
      </div>
      <HorseList horses={horses} />
    </div>
  );
}
