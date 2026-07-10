// Client portal — list of my own invoices. RLS (invoices_read) scopes the
// query to the signed-in client, so listInvoices() returns only theirs.
// Fixes the dead end where the single-invoice view's "← My invoices" back
// link (and any client navigation here) had no page to land on.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listInvoices } from "@/services/invoices";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const FMT_EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

const STATUS_TONE: Record<string, string> = {
  paid:      "bg-emerald-50 text-emerald-700",
  issued:    "bg-sky-50 text-sky-700",
  overdue:   "bg-rose-50 text-rose-700",
  cancelled: "bg-ink-100 text-ink-500",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Vilnius",
  });
}

export default async function MyInvoicesPage() {
  await requirePageRole("client");
  const invoices = await listInvoices({ limit: 200 });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My invoices" subtitle="Every invoice issued to you." />

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          body="When your stable issues you an invoice it will appear here, and you can open it to view or print."
        />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-ink-100/60">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/dashboard/my-invoices/${inv.id}`}
                  className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 hover:bg-neutral-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">{inv.number}</p>
                    <p className="text-[12px] text-ink-500">Issued {fmtDate(inv.issued_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-ink-900 tabular-nums">
                      {FMT_EUR.format(inv.total)}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_TONE[inv.status] ?? "bg-ink-100 text-ink-600"}`}>
                      {inv.status}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
