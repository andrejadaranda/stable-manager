import { requirePageRole } from "@/lib/auth/redirects";
import { previewBoardingForMonth } from "@/services/boarding";
import { BulkBoardingPanel } from "@/components/boarding/bulk-boarding-panel";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function BoardingSettingsPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requirePageRole("owner");

  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? (searchParams.period as string)
    : currentYearMonth();

  const preview = await previewBoardingForMonth(period);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink-900">
          Boarding
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          Bulk-generate monthly boarding charges for every horse with a fee
          and an owner client set. Skips horses that already have a charge in
          the picked month, so re-running is safe.
        </p>
      </div>

      <BulkBoardingPanel preview={preview} period={period} />
    </div>
  );
}
