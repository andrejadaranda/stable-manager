// /dashboard/horses/profitability — per-horse P&L for the current month
// + 2 trailing months. Audit-flagged as the single highest-impact
// feature for owner stickiness: "this horse generated €450 in lesson
// revenue and cost €280 in feed/farrier this month."
//
// Owner only — exposes per-horse cost data that staff don't need.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { getMonthFinancials, type PerHorseFinancial } from "@/services/finance";
import { PageHeader, HelpHint } from "@/components/ui";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const dynamic = "force-dynamic";

function priorYearMonth(yearMonth: string, monthsBack: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 - monthsBack, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function thisYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PerHorseProfitabilityPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requirePageRole("owner");

  const ym = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? (searchParams.period as string)
    : thisYearMonth();

  // Pull 3 months in parallel so the trend column has real numbers.
  const [thisMonth, prev1, prev2] = await Promise.all([
    getMonthFinancials(ym),
    getMonthFinancials(priorYearMonth(ym, 1)),
    getMonthFinancials(priorYearMonth(ym, 2)),
  ]);

  // Build a unified row set keyed by horseId — a horse can appear in
  // any of the 3 months. We zip in priors as additional columns.
  const byHorse = new Map<string, {
    name:    string;
    horseId: string;
    cur:     PerHorseFinancial | null;
    p1:      PerHorseFinancial | null;
    p2:      PerHorseFinancial | null;
  }>();

  function ingest(rows: PerHorseFinancial[], slot: "cur" | "p1" | "p2") {
    for (const r of rows) {
      const e = byHorse.get(r.horseId) ?? {
        name: r.horseName, horseId: r.horseId, cur: null, p1: null, p2: null,
      };
      e.name = r.horseName || e.name;
      (e as Record<typeof slot, PerHorseFinancial | null>)[slot] = r;
      byHorse.set(r.horseId, e);
    }
  }
  ingest(thisMonth.perHorse, "cur");
  ingest(prev1.perHorse,    "p1");
  ingest(prev2.perHorse,    "p2");

  const rows = [...byHorse.values()].sort((a, b) =>
    (b.cur?.net ?? 0) - (a.cur?.net ?? 0),
  );

  const totals = {
    revenue:  thisMonth.perHorse.reduce((acc, r) => acc + r.revenue,  0),
    expenses: thisMonth.perHorse.reduce((acc, r) => acc + r.expenses, 0),
    net:      thisMonth.perHorse.reduce((acc, r) => acc + r.net,      0),
  };

  const monthLabel = (s: string) => {
    const [y, m] = s.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Per-horse profitability"
        subtitle="Lesson + boarding revenue earned by each horse, minus expenses tagged to it. Package revenue excluded — it isn't tied to a single horse."
        actions={
          <>
            <HelpHint
              title="Per-horse profitability"
              body={
                <>
                  <p><strong>Revenue</strong> = lesson payments where the lesson had this horse + boarding charges paid to this horse.</p>
                  <p><strong>Expenses</strong> = expenses tagged to this horse on the Expenses page (vet, farrier, dental, etc.).</p>
                  <p><strong>Net</strong> = revenue minus expenses for the month.</p>
                  <p>Negative net = a horse that's costing more than it earned this month — not a verdict, just a signal. Old horses, retirees, and seasonal lulls all show negative.</p>
                  <p>Package revenue is excluded — packages aren't tied to a single horse.</p>
                </>
              }
            />
            <Link
              href="/dashboard/finance"
              className="text-[12.5px] text-ink-500 hover:text-ink-900"
            >
              ← Finance
            </Link>
          </>
        }
      />

      {/* Headline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiTile label="Revenue (this month)"  value={FMT_EUR.format(totals.revenue)}  tone="ok"     period={thisMonth.label} />
        <KpiTile label="Expenses (this month)" value={FMT_EUR.format(totals.expenses)} tone="warn"   period={thisMonth.label} />
        <KpiTile label="Net (this month)"      value={FMT_EUR.format(totals.net)}      tone={totals.net >= 0 ? "ok" : "danger"} period={thisMonth.label} big />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft px-6 py-12 text-center">
          <p className="text-sm font-semibold text-navy-900">No per-horse data yet</p>
          <p className="text-[12.5px] text-ink-500 mt-1.5">
            Tag expenses to a specific horse and ensure lessons have a horse assigned to populate this view.
          </p>
        </div>
      ) : (
        <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-ink-500 border-b border-ink-100 bg-surface/40">
                  <th className="px-4 py-2.5 font-semibold">Horse</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{monthLabel(priorYearMonth(ym, 2))} net</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{monthLabel(priorYearMonth(ym, 1))} net</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Revenue</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Expenses</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Net (this month)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.horseId} className="border-b border-ink-100 last:border-0 hover:bg-surface/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/horses/${r.horseId}`}
                        className="font-medium text-navy-900 hover:text-brand-700"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <NetCell value={r.p2?.net ?? null} />
                    <NetCell value={r.p1?.net ?? null} />
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                      {r.cur ? FMT_EUR.format(r.cur.revenue) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-700">
                      {r.cur ? FMT_EUR.format(r.cur.expenses) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                      (r.cur?.net ?? 0) >= 0 ? "text-emerald-800" : "text-rose-800"
                    }`}>
                      {r.cur ? FMT_EUR.format(r.cur.net) : <span className="text-ink-300 font-normal">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface/60 border-t-2 border-ink-200">
                  <td className="px-4 py-3 font-semibold text-navy-900">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-500">{FMT_EUR.format(prev2.perHorse.reduce((a, r) => a + r.net, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-500">{FMT_EUR.format(prev1.perHorse.reduce((a, r) => a + r.net, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-800 font-semibold">{FMT_EUR.format(totals.revenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-800 font-semibold">{FMT_EUR.format(totals.expenses)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-bold text-base ${
                    totals.net >= 0 ? "text-emerald-900" : "text-rose-900"
                  }`}>
                    {FMT_EUR.format(totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <p className="text-[11.5px] text-ink-500 max-w-2xl leading-relaxed">
        <strong>How this is calculated:</strong> Revenue = lesson payments where the lesson had this horse + boarding charges paid to this horse. Expenses = expenses tagged to this horse on the Expenses page. Package revenue is excluded because packages aren't tied to a single horse. Negative net = a horse that's costing more than it's earning this month — a useful signal, not a verdict.
      </p>
    </div>
  );
}

function NetCell({ value }: { value: number | null }) {
  if (value == null) {
    return <td className="px-4 py-3 text-right text-ink-300 tabular-nums">—</td>;
  }
  const tone = value >= 0 ? "text-ink-700" : "text-rose-600";
  return (
    <td className={`px-4 py-3 text-right tabular-nums ${tone}`}>
      {FMT_EUR.format(value)}
    </td>
  );
}

function KpiTile({
  label,
  value,
  tone,
  period,
  big,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger";
  period: string;
  big?: boolean;
}) {
  const valueClass =
    tone === "warn"   ? "text-amber-700"   :
    tone === "ok"     ? "text-emerald-800" :
                        "text-rose-800";
  return (
    <div className={`bg-white rounded-2xl shadow-soft p-5 ${big ? "ring-1 ring-emerald-200" : ""}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
        {label}
      </p>
      <p className={`font-display ${big ? "text-4xl" : "text-3xl"} tabular-nums mt-1.5 ${valueClass}`}>
        {value}
      </p>
      <p className="text-[11.5px] text-ink-500 mt-1">{period}</p>
    </div>
  );
}
