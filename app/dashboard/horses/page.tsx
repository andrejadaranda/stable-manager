import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listHorsesWithWeeklyWorkload } from "@/services/horses";
import { listClients } from "@/services/clients";
import { startOfWeek, addDays } from "@/lib/utils/dates";
import { HorseList } from "@/components/horses/horse-list";
import { CreateHorsePanel } from "@/components/horses/create-horse-form";
import { PageHeader } from "@/components/ui";

export default async function HorsesPage() {
  const session = await requirePageRole("owner", "employee");

  const start = startOfWeek(new Date());
  const end = addDays(start, 7);
  // Load horses + the active client roster in parallel. Clients feed the
  // "Owner (boarding horse)" picker inside the + New horse dialog.
  const [horses, clients] = await Promise.all([
    listHorsesWithWeeklyWorkload(start.toISOString(), end.toISOString()),
    listClients({ activeOnly: true }).catch(
      () => [] as Array<{ id: string; full_name: string }>,
    ),
  ]);
  const clientOptions = clients.map((c) => ({ id: c.id, full_name: c.full_name }));

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
            <CreateHorsePanel clients={clientOptions} />
          </>
        }
      />
      <HorseList horses={horses} />
    </div>
  );
}
