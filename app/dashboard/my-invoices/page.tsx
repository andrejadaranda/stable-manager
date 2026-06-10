// Client portal — "My invoices". Lists the invoices the stable has issued
// to this client (RLS scopes invoices_read to the caller's own client_id).
// Read-only: clients view/print, they don't edit status or email.

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listInvoices } from "@/services/invoices";

export const dynamic = "force-dynamic";

const FMT_EUR = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" });

const STATUS_TONE: Record<string, string> = {
  paid:      "bg-emerald-50 text-emerald-700",
  issued:    "bg-amber-50  text-amber-700",
  sent:      "bg-amber-50  text-amber-700",
  overdue:   "bg-rose-50   text-rose-700",
  draft:     "bg-ink-100   text-ink-600",
  cancelled: "bg-ink-100   text-ink-500",
  void:      "bg-ink-100   text-ink-500",
};

function fmtDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

export default async function MyInvoicesPage() {
  await requirePageRole("client");
  const invoices = await listInvoices().catch(() => []);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1
          className="text-3xl tracking-tight text-ink-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
        >
          My invoices
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Invoices your stable has issued to you. Tap one to view or print it.
        </p>
      </header>

      {invoices.length === 0 ? (
        <section className="card-elevated p-8 text-center">
          <p className="text-sm text-ink-600">
            No invoices yet. When your stable issues an invoice, it will appear here.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {invoices.map((inv) => {
            const tone = STATUS_TONE[inv.status] ?? "bg-ink-100 text-ink-600";
            const period =
              inv.period_start && inv.period_end
                ? `${fmtDate(inv.period_start)} – ${fmtDate(inv.period_end)}`
                : fmtDate(inv.issued_at);
            return (
              <li key={inv.id}>
                <Link
                  href={`/dashboard/my-invoices/${inv.id}`}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-white shadow-soft hover:shadow-lift transition-shadow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-navy-900">{inv.number}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}>
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-500 mt-0.5">{period}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-navy-900">
                      {FMT_EUR.format(Number(inv.total))}
                    </p>
                    <p className="text-[11px] text-ink-500">due {fmtDate(inv.due_at)}</p>
                  </div>
                  <span className="text-ink-400 group-hover:text-brand-700 transition-colors text-lg" aria-hidden>→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
