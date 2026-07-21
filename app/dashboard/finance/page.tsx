// Finance dashboard — owner-only.
//
// Picks a month via ?period=YYYY-MM. Shows three blocks:
//   1. Headline KPIs (revenue / expenses / net) with month picker.
//   2. Revenue breakdown — by category (lessons / packages / boarding)
//      and by service from the price list.
//   3. Expenses breakdown — by category + per-horse.
//   4. Per-horse profitability table — net contribution per horse.
//
// All numbers come from a single service call (`getMonthFinancials`)
// which fans out two parallel queries.

import { requireBusinessAccount } from "@/lib/auth/redirects";
import { getMonthFinancials, getRevenueTrend } from "@/services/finance";
import { getMonthForecast } from "@/services/billing";
import { ensureBoardingForCurrentMonth } from "@/services/boarding";
import { FinanceShell } from "@/components/finance/finance-shell";
import { ForecastStrip } from "@/components/finance/forecast-strip";

export const dynamic = "force-dynamic";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requireBusinessAccount("owner");

  // Make sure this month's boarding charges exist before we tally finance.
  await ensureBoardingForCurrentMonth();

  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? (searchParams.period as string)
    : currentYearMonth();

  const [data, trend, forecast] = await Promise.all([
    getMonthFinancials(period),
    getRevenueTrend(period, 6),
    getMonthForecast(period),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ForecastStrip forecast={forecast} />
      <FinanceShell data={data} trend={trend} />
    </div>
  );
}
