import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listHorsesWithWeeklyWorkload } from "@/services/horses";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { HorseList } from "@/components/horses/horse-list";
import { CreateHorsePanel } from "@/components/horses/create-horse-form";
import { PageHeader } from "@/components/ui";

export default async function HorsesPage() {
  const session = await requirePageRole("owner", "employee");

  const start = startOfWeek(new Date());
  const end = addDays(start, 7);
  const horses = await listHorsesWithWeeklyWorkload(
    start.toISOString(),
    end.toISOString(),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Horses"
        subtitle="Roster, weekly workload, and lesson limits."
        actions={
          <>
            {session.role === "owner" && (
              <Link
                href="/dashboard/horses/profitability"
                className="
                  h-10 px-3.5 inline-flex items-center rounded-xl text-sm font-medium
                  text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors
                "
              >
                Profitability
              </Link>
            )}
            <CreateHorsePanel />
          </>
        }
      />
      <HorseList horses={horses} />
    </div>
  );
}
