import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getInvoiceDetail } from "@/services/invoices";
import { InvoiceActions } from "@/components/finance/invoice-actions";
import { InvoicePrintView } from "@/components/finance/invoice-print-view";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRole("owner", "employee");
  // Basic UUID guard so /invoices/foo doesn't ratlle Postgres.
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const detail = await getInvoiceDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      {/* Action bar — hidden in print */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {detail.invoice.number}
        </h1>
        <InvoiceActions
          invoiceId={detail.invoice.id}
          status={detail.invoice.status}
        />
      </div>

      <InvoicePrintView detail={detail} />
    </div>
  );
}
