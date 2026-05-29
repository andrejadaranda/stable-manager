import { requirePageRole } from "@/lib/auth/redirects";
import { listArenas } from "@/services/arenas";
import { ArenasPanel } from "@/components/settings/arenas-panel";

export default async function ArenasSettingsPage() {
  await requirePageRole("owner", "employee");
  const arenas = await listArenas({ activeOnly: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Arenas
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          Riding spaces at your yard. Each lesson is assigned to one arena
          so two trainers can run parallel sessions. Color sets the
          calendar event stripe.
        </p>
      </div>
      <ArenasPanel arenas={arenas} />
    </div>
  );
}
