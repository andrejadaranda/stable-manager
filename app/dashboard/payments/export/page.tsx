// =============================================================
// Payments PDF export — server-rendered print view.
//
// Why HTML print instead of a real PDF library (jsPDF / @react-pdf):
//   * Zero new deps — keeps the bundle (and Vercel cold-start) lean
//     right before launch.
//   * Browser's "Save as PDF" is universally available, prints the
//     same layout owners see on screen, and lets them pick paper size.
//   * Adding a server-side PDF lib later is a drop-in (same data
//     fetch, swap the renderer) — we're not painting ourselves into a
//     corner.
//
// The page auto-prints on mount and the print stylesheet hides the
// "← Back" link + the "Print" button so the saved PDF is clean.
// =============================================================

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listPayments } from "@/services/payments";
import { getOwnStable } from "@/services/stables";
import { AutoPrint } from "@/components/print/auto-print";

type Search = {
  from?: string;  // YYYY-MM-DD inclusive
  to?:   string;  // YYYY-MM-DD inclusive (we expand to half-open below)
};

export default async function PaymentsExportPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  await requirePageRole("owner");

  // Default window: last 30 days, ending today, if user didn't pick.
  const today = new Date();
  const defaultTo   = isoDate(today);
  const defaultFrom = isoDate(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));

  const fromDate = validDate(searchParams.from) ?? defaultFrom;
  const toDate   = validDate(searchParams.to)   ?? defaultTo;

  // listPayments uses a half-open window on paid_at (timestamptz), so
  // bump the upper bound to the start of the NEXT day to include the
  // entire `to` date.
  const fromIso = `${fromDate}T00:00:00.000Z`;
  const toIso   = `${addDays(toDate, 1)}T00:00:00.000Z`;

  const [payments, stable] = await Promise.all([
    listPayments({ from: fromIso, to: toIso }),
    getOwnStable(),
  ]);

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const byMethod = groupBy(payments, (p) => p.method);

  return (
    <div className="min-h-screen bg-white text-neutral-900 print:bg-white">
      <AutoPrint />

      {/* Toolbar — hidden in print */}
      <div className="print:hidden border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <Link
          href="/dashboard/payments"
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Back to Payments
        </Link>
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-10 print:py-6">
        {/* Header */}
        <header className="mb-8 pb-6 border-b border-neutral-200">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Payments report
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

        {/* Summary */}
        <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <SummaryCard label="Total received" value={fmtMoney(total)} highlight />
          <SummaryCard label="Payments"       value={String(payments.length)} />
          <SummaryCard
            label="Cash"
            value={fmtMoney(sumOf(byMethod.get("cash") ?? []))}
          />
          <SummaryCard
            label="Card + transfer"
            value={fmtMoney(
              sumOf(byMethod.get("card") ?? []) +
                sumOf(byMethod.get("transfer") ?? []),
            )}
          />
        </section>

        {/* Detail table */}
        {payments.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No payments recorded in this date range.
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-900 text-left">
                <Th>Date</Th>
                <Th>Client</Th>
                <Th>Method</Th>
                <Th>Lesson</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-neutral-200 align-top"
                >
                  <Td>{formatDate(p.paid_at.slice(0, 10))}</Td>
                  <Td>{p.client?.full_name ?? "—"}</Td>
                  <Td className="capitalize">{p.method}</Td>
                  <Td>
                    {p.lesson
                      ? `${formatDate(p.lesson.starts_at.slice(0, 10))}${
                          p.lesson.horse ? ` · ${p.lesson.horse.name}` : ""
                        }`
                      : "—"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {fmtMoney(Number(p.amount))}
                  </Td>
                </tr>
              ))}
              <tr className="font-semibold">
                <Td colSpan={4} className="text-right pt-3">
                  Total
                </Td>
                <Td className="text-right tabular-nums pt-3">
                  {fmtMoney(total)}
                </Td>
              </tr>
            </tbody>
          </table>
        )}

        <footer className="mt-10 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            Generated by Longrein · longrein.eu · This report includes
            payments with <code>paid_at</code> in the selected range.
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

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-neutral-50"
      }`}
    >
      <p className={`text-xs ${highlight ? "text-neutral-300" : "text-neutral-500"}`}>
        {label}
      </p>
      <p className="text-lg font-semibold mt-0.5 tabular-nums">{value}</p>
    </div>
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
