// Client portal — single invoice view. RLS (invoices_read) guarantees a
// client can only open their own invoice; getInvoiceDetail returns null
// otherwise → notFound. Reuses the same branded print view as the owner.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getInvoiceDetail } from "@/services/invoices";
import { InvoicePrintView } from "@/components/finance/invoice-print-view";
import { PrintInvoiceButton } from "@/components/finance/print-invoice-button";

export const dynamic = "force-dynamic";

export default async function MyInvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRole("client");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const detail = await getInvoiceDetail(params.id);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/my-invoices"
        className="text-sm text-ink-500 hover:text-ink-900 w-fit inline-flex items-center gap-1 print:hidden"
      >
        <span aria-hidden>←</span> My invoices
      </Link>

      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
          {detail.invoice.number}
        </h1>
        <PrintInvoiceButton />
      </div>

      <InvoicePrintView detail={detail} />
    </div>
  );
}
