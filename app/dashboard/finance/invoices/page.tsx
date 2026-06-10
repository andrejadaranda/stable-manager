import { requirePageRole } from "@/lib/auth/redirects";
import { listInvoices } from "@/services/invoices";
import { getStableIssuer, isIssuerReady } from "@/services/stableIssuer";
import { BulkInvoicePanel } from "@/components/finance/bulk-invoice-panel";
import { InvoiceBulkList } from "@/components/finance/invoice-bulk-list";
import { InvoiceRequestsSection } from "@/components/finance/invoice-requests-section";
import { listPendingInvoiceRequests } from "@/services/invoiceRequests";
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

  const [invoices, issuer, pendingRequests] = await Promise.all([
    listInvoices({ limit: 200 }),
    getStableIssuer(),
    listPendingInvoiceRequests().catch(() => []),
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

      <InvoiceRequestsSection requests={pendingRequests} />

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
        <InvoiceBulkList invoices={invoices} />
      </section>
    </div>
  );
}
