import { requirePageRole } from "@/lib/auth/redirects";
import { listServices } from "@/services/services";
import { ServicesManager } from "@/components/services/services-manager";

export default async function ServicesSettingsPage() {
  await requirePageRole("owner");
  // Owners see active + inactive entries so they can re-enable.
  const services = await listServices({ activeOnly: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Services & price list
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          The catalog clients see and the dropdown trainers pick from when
          scheduling lessons. Picking a service auto-fills the lesson price
          and a default duration — both stay editable per-lesson.
        </p>
      </div>

      <ServicesManager services={services} />
    </div>
  );
}
