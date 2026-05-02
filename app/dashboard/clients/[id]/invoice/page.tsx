// Print-friendly client invoice. A4-shaped layout with stable
// letterhead at top, client info, table of unpaid charges, total,
// payment instructions. Hidden navigation so when the user hits
// Cmd+P they get just the document.
//
// Owner-only by design — clients aren't shown the print URL.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getClient } from "@/services/clients";
import { listChargesForClient, type BoardingChargeRow } from "@/services/boarding";
import { listClientCharges, type ClientChargeRow } from "@/services/clientCharges";
import { getClientBalance } from "@/services/payments";
import { getOwnStable } from "@/services/account";
import { PrintInvoiceButton } from "@/components/clients/print-invoice-button";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export const dynamic = "force-dynamic";

export default async function ClientInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRole("owner");
  const [client, stable, boarding, misc, balance] = await Promise.all([
    getClient(params.id),
    getOwnStable().catch(() => null),
    listChargesForClient(params.id).catch((): BoardingChargeRow[] => []),
    listClientCharges(params.id).catch((): ClientChargeRow[] => []),
    getClientBalance(params.id).catch(() => 0),
  ]);
  if (!client) notFound();

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const dueDate = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const invoiceNumber =
    `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${client.id.slice(0, 4).toUpperCase()}`;

  // Filter to *unpaid + partial* charges. payment_status is computed
  // server-side in the boarding/clientCharges views.
  const boardingDue = boarding.filter((b) => b.payment_status !== "paid");
  const miscDue     = misc.filter((m)     => m.payment_status !== "paid");

  const total =
    boardingDue.reduce((acc: number, b) => acc + (Number(b.amount) - Number(b.paid_amount ?? 0)), 0) +
    miscDue.reduce((acc: number, m)     => acc + (Number(m.amount) - Number(m.paid_amount ?? 0)), 0);

  return (
    <>
      {/* Print-only styles — strip nav, force white bg, A4 size */}
      <style>{`
        @media print {
          aside, nav, header.app-chrome, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      {/* Toolbar — only visible on screen */}
      <div className="no-print mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="text-sm text-ink-500 hover:text-ink-900"
        >
          ← Back to {client.full_name}
        </Link>
        <PrintInvoiceButton />
      </div>

      {/* Document */}
      <article className="bg-white rounded-2xl shadow-soft p-8 md:p-10 max-w-3xl mx-auto print:shadow-none print:rounded-none">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 pb-6 border-b border-ink-200">
          <div>
            <p
              className="text-2xl text-navy-900 leading-none"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600, letterSpacing: "-0.01em" }}
            >
              {stable?.name ?? "Stable"}
            </p>
            <p className="text-[12px] text-ink-500 mt-1">Stable management on Hoofbeat.</p>
          </div>
          <div className="text-right text-[12px] text-ink-700">
            <p className="font-semibold text-base text-navy-900">Invoice</p>
            <p className="mt-1 tabular-nums">{invoiceNumber}</p>
            <p className="text-ink-500 mt-0.5">Issued {today}</p>
            <p className="text-ink-500">Due {dueDate}</p>
          </div>
        </header>

        {/* Bill to */}
        <section className="mt-6 grid grid-cols-2 gap-6 text-[13px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">Bill to</p>
            <p className="font-semibold text-ink-900 mt-1.5">{client.full_name}</p>
            {client.email && <p className="text-ink-700">{client.email}</p>}
            {client.phone && <p className="text-ink-700 tabular-nums">{client.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">Current balance</p>
            <p className={`mt-1.5 font-semibold tabular-nums text-lg ${balance < 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {balance < 0
                ? `Owes ${FMT_EUR.format(Math.abs(balance))}`
                : balance > 0
                  ? `Credit ${FMT_EUR.format(balance)}`
                  : "Settled"}
            </p>
          </div>
        </section>

        {/* Lines */}
        <section className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 mb-3">
            Outstanding charges
          </p>
          {(boardingDue.length === 0 && miscDue.length === 0) ? (
            <p className="text-[13px] text-ink-500 italic py-6 text-center bg-ink-50/60 rounded-xl">
              No outstanding charges. This client is fully paid up.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-ink-500 border-b border-ink-200">
                  <th className="py-2 font-semibold">Period</th>
                  <th className="py-2 font-semibold">Description</th>
                  <th className="py-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {boardingDue.map((b) => {
                  const remaining = Number(b.amount) - Number(b.paid_amount ?? 0);
                  return (
                    <tr key={b.id} className="border-b border-ink-100">
                      <td className="py-2.5 text-ink-700 tabular-nums">{b.period_label ?? b.period_start}</td>
                      <td className="py-2.5">
                        <span className="font-medium text-ink-900">Boarding</span>
                        {b.payment_status === "partial" && (
                          <span className="text-amber-700 text-[11px]"> · partially paid</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-medium">
                        {FMT_EUR.format(remaining)}
                      </td>
                    </tr>
                  );
                })}
                {miscDue.map((m) => {
                  const remaining = Number(m.amount) - Number(m.paid_amount ?? 0);
                  return (
                    <tr key={m.id} className="border-b border-ink-100">
                      <td className="py-2.5 text-ink-700 tabular-nums">
                        {new Date(m.incurred_on).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2.5">
                        <span className="font-medium text-ink-900 capitalize">
                          {(m.custom_label ?? m.kind).replace(/_/g, " ")}
                        </span>
                        {m.notes && <span className="text-ink-500"> · {m.notes}</span>}
                        {m.payment_status === "partial" && (
                          <span className="text-amber-700 text-[11px]"> · partially paid</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums font-medium">
                        {FMT_EUR.format(remaining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-300">
                  <td colSpan={2} className="pt-3 text-right text-[11px] uppercase tracking-[0.08em] text-ink-500">Total due</td>
                  <td className="pt-3 text-right">
                    <span
                      className="text-2xl tabular-nums font-semibold text-navy-900"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      {FMT_EUR.format(total)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        {/* Payment + footer */}
        <section className="mt-10 pt-6 border-t border-ink-200 text-[11.5px] text-ink-500 leading-relaxed">
          <p className="mb-1">
            <span className="font-semibold text-ink-700">Payment:</span> Bank transfer, cash, or card. Reference invoice number on transfer.
          </p>
          <p className="mb-1">
            <span className="font-semibold text-ink-700">Questions?</span> Contact {stable?.name ?? "your stable"} directly.
          </p>
          <p className="mt-3 text-ink-400 text-[10px]">
            Generated by Hoofbeat. · {today}
          </p>
        </section>
      </article>
    </>
  );
}
