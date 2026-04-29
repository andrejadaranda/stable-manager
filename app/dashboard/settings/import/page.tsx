import { requirePageRole } from "@/lib/auth/redirects";
import { ImportPanel } from "@/components/settings/import-panel";

export default async function ImportSettingsPage() {
  await requirePageRole("owner");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Import data
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          Migrate your existing roster in one paste. Each row goes through
          the same validation as the in-app forms — duplicates and
          malformed rows skip individually with a clear error so you can
          fix and re-run.
        </p>
      </div>

      <ImportPanel />
    </div>
  );
}
