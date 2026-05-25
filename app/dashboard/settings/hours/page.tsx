// Working hours + holidays — owner-only.

import { requirePageRole } from "@/lib/auth/redirects";
import { listWorkingHours, listHolidays } from "@/services/workingHours";
import { HoursEditor } from "@/components/settings/hours-editor";

export const dynamic = "force-dynamic";

export default async function HoursPage() {
  await requirePageRole("owner");
  const [hours, holidays] = await Promise.all([listWorkingHours(), listHolidays()]);
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-xl text-navy-700">Working hours &amp; holidays</h2>
        <p className="text-sm text-ink-500 mt-1.5">
          Set when your stable is open. The calendar will respect these — clients can't request lessons outside hours or on holidays.
        </p>
      </header>
      <HoursEditor initialHours={hours} initialHolidays={holidays} />
    </div>
  );
}
