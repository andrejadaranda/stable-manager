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
import { getMonthFinancials } from "@/services/finance";
import { ensureBoardingForCurrentMonth } from "@/services/boarding";
import { FinanceShell } from "@/components/finance/finance-shell";

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

  const data = await getMonthFinancials(period);

  return <FinanceShell data={data} />;
}
