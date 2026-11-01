// =============================================================
// Client account statement — print view (screenshot or Save-as-PDF).
//
// One clear chronological ledger: every charge, every payment, every
// credit top-up (incl. work-for-credit/barter) and every credit spent,
// with a running balance after each line — so the owner can hand a
// client (or their barter partner) an unambiguous "here's exactly what
// was added and deducted, and when" document. Auto-prints on open; the
// toolbar is hidden in the printout.
// =============================================================

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getClientStatement, getClientAvailableCredit, getClientAccountSummary } from "@/services/payments";
import { getBarterCreditTotal } from "@/services/barterCredits";
import { getOwnStable } from "@/services/stables";
import { AutoPrint, PrintButton } from "@/components/print/auto-print";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientStatementPage({ params }: { params: { id: string } }) {
  await requirePageRole("owner");
  if (!UUID.test(params.id)) notFound();

  const [summary, statementDesc, availableCredit, barterTotal, stable] = await Promise.all([
    getClientAccountSummary(params.id),
    getClientStatement(params.id), // newest-first
    getClientAvailableCredit(params.id),
    getBarterCreditTotal(params.id),
    getOwnStable(),
  ]);

  const s = summary as { full_name: string; total_charged: number | string; total_paid: number | string; balance: number | string };
  // Chronological (oldest → newest) reads best on a printed statement.
  const entries = [...statementDesc].reverse();
  const balance = Number(s.balance);
  const fmt = (n: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n);
  const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Vilnius" });
  const generated = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Vilnius" });

  return (
    <div className="min-h-screen bg-white text-neutral-900 print:bg-white">
      <AutoPrint />

      <div className="print:hidden border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <Link href={`/dashboard/clients/${params.id}`} className="text-sm text-neutral-600 hover:text-neutral-900">← Back to client</Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-4xl px-8 py-10 print:py-6">
        <header className="mb-8 pb-6 border-b border-neutral-200 flex items-baseline justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Account statement</p>
            <h1 className="text-2xl font-semibold">{s.full_name}</h1>
            <p className="text-sm text-neutral-600 mt-0.5">{stable.name}</p>
          </div>
          <div className="text-right text-sm text-neutral-600">
            <p className="font-medium">Generated {generated}</p>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Card label="Total charged" value={fmt(Number(s.total_charged))} />
          <Card label="Cash paid" value={fmt(Number(s.total_paid))} />
          <Card label="Credit available" value={fmt(availableCredit)} sub={barterTotal > 0 ? `incl. ${fmt(barterTotal)} earned` : undefined} />
          <Card
            label={balance >= 0 ? "In credit" : "Owes"}
            value={fmt(Math.abs(balance))}
            highlight
            tone={balance >= 0 ? "ok" : "warn"}
          />
        </section>

        {entries.length === 0 ? (
          <p className="text-sm text-neutral-600">No activity on this account yet.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-neutral-900 text-left">
                <Th>Date</Th>
                <Th>Detail</Th>
                <Th className="text-right">Charged</Th>
                <Th className="text-right">Credit / Paid</Th>
                <Th className="text-right">Balance</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isCharge = e.direction === "charge";
                const isCreditUsed = e.direction === "credit_used";
                return (
                  <tr key={e.id} className="border-b border-neutral-200 align-top">
                    <Td className="whitespace-nowrap">{fmtD(e.date)}</Td>
                    <Td>
                      <span className="font-medium">{e.label}</span>
                      {e.sub ? <span className="text-neutral-500"> · {e.sub}</span> : null}
                      {isCreditUsed ? <span className="text-neutral-500"> ({fmt(e.amount)} from credit)</span> : null}
                    </Td>
                    <Td className="text-right tabular-nums">{isCharge ? fmt(e.amount) : ""}</Td>
                    <Td className="text-right tabular-nums">{!isCharge && !isCreditUsed ? `+${fmt(e.amount)}` : ""}</Td>
                    <Td className="text-right tabular-nums font-medium">{fmt(e.balanceAfter)}</Td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <Td colSpan={4} className="text-right pt-3">{balance >= 0 ? "In credit" : "Balance owed"}</Td>
                <Td className="text-right tabular-nums pt-3">{fmt(balance)}</Td>
              </tr>
            </tbody>
          </table>
        )}

        <footer className="mt-10 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>Generated by Longrein · longrein.eu · A positive balance means the client is in credit; negative means they owe. “Credit used” lines draw from the available-credit pool and do not change the balance.</p>
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

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2 pr-3 font-medium text-neutral-700 ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`py-2 pr-3 ${className}`}>{children}</td>;
}
function Card({ label, value, sub, highlight = false, tone = "ok" }: { label: string; value: string; sub?: string; highlight?: boolean; tone?: "ok" | "warn" }) {
  const base = highlight
    ? tone === "warn" ? "border-rose-600 bg-rose-600 text-white" : "border-emerald-600 bg-emerald-600 text-white"
    : "border-neutral-200 bg-neutral-50";
  return (
    <div className={`rounded-md border p-3 ${base}`}>
      <p className={`text-xs ${highlight ? "text-white/80" : "text-neutral-500"}`}>{label}</p>
      <p className="text-lg font-semibold mt-0.5 tabular-nums">{value}</p>
      {sub ? <p className={`text-[11px] mt-0.5 ${highlight ? "text-white/80" : "text-neutral-500"}`}>{sub}</p> : null}
    </div>
  );
}
