// Print-friendly invoice. Designed so Cmd+P (or the "Print / PDF" button)
// produces a clean, branded A4 invoice — the print isolation below hides
// the whole app shell so nothing but this document reaches the page.

import type { InvoiceDetail } from "@/services/invoices";
import { BrandIcon, Wordmark } from "@/components/brand/logo";

export function InvoicePrintView({ detail }: { detail: InvoiceDetail }) {
  const { invoice, items, issuer } = detail;
  const dateStr = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-GB") : "—";

  return (
    <>
      {/* Print isolation — hide the entire app chrome, show only the invoice
          on a clean white A4 page (fixes the dark UI bars in print). */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  @page { size: A4; margin: 16mm; }
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .invoice-print-root, .invoice-print-root * { visibility: visible !important; }
  .invoice-print-root {
    position: absolute !important;
    left: 0; top: 0; width: 100%;
    box-shadow: none !important; border-radius: 0 !important; padding: 0 !important;
  }
}`,
        }}
      />

      <article className="invoice-print-root bg-white rounded-2xl shadow-lift overflow-hidden max-w-3xl mx-auto border border-ink-100">
        {/* Brand band */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-700 via-brand-500 to-saddle-500" aria-hidden />
        <div className="p-8 md:p-10">
        {/* Letterhead — Longrein lockup + invoice meta */}
        <header className="flex items-start justify-between gap-6 mb-8 pb-6 border-b border-ink-200">
          <span className="inline-flex items-center gap-2.5">
            <BrandIcon size="lg" />
            <Wordmark size="lg" />
          </span>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.22em] text-ink-500 font-semibold">Invoice</p>
            <h1 className="text-xl font-semibold mt-0.5 text-ink-900">{invoice.number}</h1>
            <div className="mt-1.5"><StatusBadge status={invoice.status} /></div>
          </div>
        </header>

        {/* Issuer / recipient / dates */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-[13px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-semibold mb-1.5">From</p>
            <p className="font-semibold text-ink-900">{issuer.legal_name ?? "—"}</p>
            {issuer.business_code   && <p className="text-ink-600">Reg. {issuer.business_code}</p>}
            {issuer.vat_code        && <p className="text-ink-600">VAT {issuer.vat_code}</p>}
            {issuer.business_address && <p className="text-ink-600 mt-1 whitespace-pre-wrap">{issuer.business_address}</p>}
            {issuer.iban            && <p className="text-ink-600 mt-1">IBAN {issuer.iban}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-semibold mb-1.5">Bill to</p>
            <p className="font-semibold text-ink-900">{invoice.client?.full_name ?? "—"}</p>
            {invoice.client?.email && <p className="text-ink-600">{invoice.client.email}</p>}
            {invoice.client?.phone && <p className="text-ink-600">{invoice.client.phone}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-semibold mb-1.5">Details</p>
            <p className="text-ink-600">Issued <span className="text-ink-900">{dateStr(invoice.issued_at)}</span></p>
            {invoice.due_at && <p className="text-ink-600">Due <span className="text-ink-900">{dateStr(invoice.due_at)}</span></p>}
            {(invoice.period_start || invoice.period_end) && (
              <p className="text-ink-600 mt-1">Period {dateStr(invoice.period_start)} – {dateStr(invoice.period_end)}</p>
            )}
          </div>
        </section>

        {/* Items */}
        <section className="mb-8">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-ink-500 font-semibold">
                <th className="text-left  py-2 border-b border-ink-300">Description</th>
                <th className="text-right py-2 border-b border-ink-300 w-12">Qty</th>
                <th className="text-right py-2 border-b border-ink-300 w-28">Unit price</th>
                <th className="text-right py-2 border-b border-ink-300 w-28">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="py-2.5 text-ink-900">{it.description}</td>
                  <td className="py-2.5 text-right tabular-nums text-ink-600">{Number(it.quantity)}</td>
                  <td className="py-2.5 text-right tabular-nums text-ink-600">€{Number(it.unit_price).toFixed(2)}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-ink-900">€{Number(it.line_total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="flex justify-end mb-6">
          <div className="w-full sm:w-[64%] min-w-[260px] flex flex-col gap-1">
            <div className="flex items-center justify-between py-1.5 text-[13.5px] text-ink-600">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums text-ink-800">€{Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            {Number(invoice.vat_rate) > 0 && (
              <div className="flex items-center justify-between py-1.5 text-[13.5px] text-ink-600">
                <span>VAT {invoice.vat_rate}%</span>
                <span className="font-mono tabular-nums text-ink-800">€{Number(invoice.vat_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between px-4 py-3.5 rounded-2xl bg-brand-800 text-white">
              <span className="font-bold text-[15px]">Total</span>
              <span className="font-mono font-semibold text-[22px] tabular-nums">€{Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </section>

        {!issuer.vat_code && (
          <p className="text-[11px] text-ink-400 mb-4">VAT not applied — issuer is not VAT-registered.</p>
        )}

        {/* Payment block */}
        {(issuer.iban || invoice.due_at) && (
          <section className="rounded-2xl bg-ink-50 p-4 mb-6">
            {issuer.iban && (
              <>
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink-400 font-bold">Pay to</p>
                <p className="font-mono text-[14px] font-semibold text-ink-900 mt-1.5">IBAN {issuer.iban}</p>
              </>
            )}
            {invoice.due_at && (
              <p className="text-[12.5px] text-ink-600 mt-2">
                Reference <span className="font-semibold text-ink-900">{invoice.number}</span> · due{" "}
                <span className={invoice.status === "overdue" ? "font-semibold text-alert-700" : "font-semibold text-ink-900"}>{dateStr(invoice.due_at)}</span>
              </p>
            )}
          </section>
        )}

        {invoice.notes && (
          <section className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-500 font-semibold mb-1">Notes</p>
            <p className="text-[13px] text-ink-700 whitespace-pre-wrap">{invoice.notes}</p>
          </section>
        )}

        <p className="text-center font-serif italic text-[15px] text-ink-500 mt-6">Thank you for riding with us.</p>
        <p className="text-center text-[11px] text-ink-300 mt-2">
          {issuer.legal_name ?? "Longrein"} · Generated with Longrein · longrein.eu
        </p>
        </div>
      </article>
    </>
  );
}

function StatusBadge({ status }: { status: "issued" | "paid" | "overdue" | "cancelled" }) {
  const map: Record<string, string> = {
    issued:    "bg-amber-50 text-amber-800",
    paid:      "bg-emerald-50 text-emerald-700",
    overdue:   "bg-rose-50 text-rose-700",
    cancelled: "bg-ink-100 text-ink-600",
  };
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}
