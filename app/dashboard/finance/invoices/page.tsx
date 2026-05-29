import { requirePageRole } from "@/lib/auth/redirects";
import { listInvoices } from "@/services/invoices";
import { getStableIssuer, isIssuerReady } from "@/services/stableIssuer";
import { BulkInvoicePanel } from "@/components/finance/bulk-invoice-panel";
import Link from "next/link";

export const dynamic = "force-dynamic";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  await requirePageRole("owner", "employee");
  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "")
    ? (searchParams.period as string)
    : currentYearMonth();

  const [invoices, issuer] = await Promise.all([
    listInvoices({ limit: 200 }),
    getStableIssuer(),
  ]);
  const ready = isIssuerReady(issuer);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Invoices</h1>
          <p className="text-sm text-ink-500 mt-1">
            Bulk generation from completed, unpaid, uninvoiced lessons.
          </p>
        </div>
      </header>

      {!ready && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-[13px] flex items-center justify-between gap-3 flex-wrap">
          <span>
            <strong>Setup needed.</strong> Fill in issuer details to enable bulk generation.
          </span>
          <Link
            href="/dashboard/settings/issuer"
            className="h-8 px-3 inline-flex items-center rounded-lg bg-amber-900 text-amber-50 text-[12px] font-medium hover:bg-amber-800"
          >
            Open issuer settings
          </Link>
        </div>
      )}

      <BulkInvoicePanel period={period} disabled={!ready} />

      <section className="bg-white rounded-2xl shadow-soft p-5">
        <h2 className="text-sm font-semibold text-navy-900 mb-3">
          Recent invoices · {invoices.length}
        </h2>
        {invoices.length === 0 ? (
          <p className="text-[13px] text-ink-500">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100/80">
            {invoices.map((inv) => (
              <li key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-[13px]">
                <div className="flex flex-col">
                  <span className="font-medium text-ink-900">{inv.number}</span>
                  <span className="text-ink-500 text-[12px]">
                    {inv.client?.full_name ?? "(client removed)"} ·
                    {" "}{new Date(inv.issued_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    inv.status === "paid" ? "bg-emerald-50 text-emerald-700" :
                    inv.status === "overdue" ? "bg-rose-50 text-rose-700" :
                    inv.status === "cancelled" ? "bg-ink-100 text-ink-600" :
                    "bg-amber-50 text-amber-800"
                  }`}>{inv.status}</span>
                  <span className="tabular-nums font-semibold text-ink-900">
                    €{Number(inv.total).toFixed(2)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
