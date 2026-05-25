// Custom session types — owner-only CRUD.

import { requirePageRole } from "@/lib/auth/redirects";
import { listStableSessionTypes } from "@/services/stableSessionTypes";
import { SessionTypesEditor } from "@/components/settings/session-types-editor";

export const dynamic = "force-dynamic";

export default async function SessionTypesPage() {
  await requirePageRole("owner");
  const types = await listStableSessionTypes();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-xl text-navy-700">Custom session types</h2>
        <p className="text-sm text-ink-500 mt-1.5">
          Define your own ride categories — beyond the defaults (flat, dressage, hack, …).
          Useful for therapy programs, kids' clubs, FEI disciplines, etc.
        </p>
      </header>
      <SessionTypesEditor initialTypes={types} />
    </div>
  );
}
