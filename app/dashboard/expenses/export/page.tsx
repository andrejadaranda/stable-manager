// =============================================================
// Expenses PDF export — server-rendered print view.
// Same architecture as /dashboard/payments/export — see that file
// for the "why HTML print, not a PDF lib" rationale.
// =============================================================

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listExpenses, type ExpenseCategory } from "@/services/expenses";
import { getOwnStable } from "@/services/stables";
import { AutoPrint } from "@/components/print/auto-print";

type Search = {
  from?: string;  // YYYY-MM-DD inclusive
  to?:   string;  // YYYY-MM-DD inclusive
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  feed:        "Feed",
  vet:         "Vet",
  farrier:     "Farrier",
  maintenance: "Maintenance",
  staff:       "Staff",
  other:       "Other",
};

export default async function ExpensesExportPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requirePageRole("owner");

  // Default window: current month so the most common use case
  // ("month-end totals for my accountant") is one-click.
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultFrom = isoDate(monthStart);
  const defaultTo   = isoDate(today);

  const fromDate = validDate(searchParams.from) ?? defaultFrom;
  const toDate   = validDate(searchParams.to)   ?? defaultTo;

  // expenses.incurred_on is a DATE (not timestamptz), so the half-open
  // upper bound is the day AFTER `to` — keeps `to` inclusive.
  const [expenses, stable] = await Promise.all([
    listExpenses({ from: fromDate, to: addDays(toDate, 1) }),
    getOwnStable(),
  ]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const byCategory = groupBy(expenses, (e) => e.category);

  return (
    <div className="min-h-screen bg-white text-neutral-900 print:bg-white">
      <AutoPrint />

      <div className="print:hidden border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <Link
          href="/dashboard/expenses"
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Expenses
        </Link>
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-10 print:py-6">
        <header className="mb-8 pb-6 border-b border-neutral-200">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Expenses report
              </p>
              <h1 className="text-2xl font-semibold">{stable.name}</h1>
            </div>
            <div className="text-right text-sm text-neutral-600">
              <p className="font-medium">
                {formatDate(fromDate)} → {formatDate(toDate)}
              </p>
              <p className="text-xs mt-0.5">
                Generated {formatDate(isoDate(new Date()))}
              </p>
            </div>
          </div>
        </header>

        {/* Category roll-up — most accountants want this aggregate */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 text-neutral-700 uppercase tracking-wider">
            By category
          </h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[])
                .filter((c) => (byCategory.get(c)?.length ?? 0) > 0)
                .map((c) => {
                  const rows = byCategory.get(c) ?? [];
                  const sub  = sumOf(rows);
                  return (
                    <tr key={c} className="border-b border-neutral-200">
                      <Td>{CATEGORY_LABELS[c]}</Td>
                      <Td className="text-right text-neutral-500">
                        {rows.length} {rows.length === 1 ? "entry" : "entries"}
                      </Td>
                      <Td className="text-right tabular-nums font-medium">
                        {fmtMoney(sub)}
                      </Td>
                    </tr>
                  );
                })}
              <tr className="font-semibold">
                <Td colSpan={2} className="text-right pt-3">Total</Td>
                <Td className="text-right tabular-nums pt-3">{fmtMoney(total)}</Td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Line items */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-neutral-700 uppercase tracking-wider">
            Line items
          </h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No expenses recorded in this date range.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-neutral-900 text-left">
                  <Th>Date</Th>
                  <Th>Category</Th>
                  <Th>Horse</Th>
                  <Th>Description</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-neutral-200 align-top"
                  >
                    <Td>{formatDate(e.incurred_on)}</Td>
                    <Td>{CATEGORY_LABELS[e.category]}</Td>
                    <Td>{e.horse?.name ?? "—"}</Td>
                    <Td>{e.description ?? "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {fmtMoney(Number(e.amount))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            Generated by Longrein · longrein.eu · This report includes
            expenses with <code>incurred_on</code> in the selected range.
          </p>
        </footer>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

// ---------- primitives ----------
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2 pr-3 font-medium text-neutral-700 ${className}`}>{children}</th>;
}
function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`py-2 pr-3 ${className}`}>
      {children}
    </td>
  );
}

// ---------- helpers ----------
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function validDate(s?: string): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
function addDays(yyyymmdd: string, n: number): string {
  const d = new Date(`${yyyymmdd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}
function formatDate(yyyymmdd: string): string {
  const d = new Date(`${yyyymmdd}T00:00:00.000Z`);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}
function sumOf<T extends { amount: number | string }>(xs: T[]): number {
  return xs.reduce((s, x) => s + Number(x.amount), 0);
}
function groupBy<T, K>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}
