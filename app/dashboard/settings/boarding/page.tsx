import { requirePageRole } from "@/lib/auth/redirects";
import { previewBoardingForMonth, listOutstandingBoardingCharges } from "@/services/boarding";
import { getStableFeatures } from "@/services/features";
import { BulkBoardingPanel } from "@/components/boarding/bulk-boarding-panel";
import { OutstandingBoardingBoard } from "@/components/boarding/outstanding-board";
import { FeatureDisabled } from "@/components/ui";

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

  const features = await getStableFeatures();
  if (!features.boarding) {
    return <FeatureDisabled feature="Horse boarding" isOwner />;
  }

  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? (searchParams.period as string)
    : currentYearMonth();

  const [preview, outstanding] = await Promise.all([
    previewBoardingForMonth(period),
    listOutstandingBoardingCharges().catch(() => []),
  ]);

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

      <OutstandingBoardingBoard rows={outstanding} />

      <BulkBoardingPanel preview={preview} period={period} />
    </div>
  );
}
