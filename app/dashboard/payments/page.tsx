import { requireBusinessAccount } from "@/lib/auth/redirects";
import { listPayments } from "@/services/payments";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { listOutstandingBoardingCharges } from "@/services/boarding";
import { getCalendar } from "@/services/lessons";
import { PaymentList } from "@/components/payments/payment-list";
import { CreatePaymentPanel } from "@/components/payments/create-payment-form";
import { PaymentFilterBar } from "@/components/payments/payment-filter-bar";
import { ExportPdfButton } from "@/components/payments/export-pdf-button";
import { PageHeader } from "@/components/ui";

type Method = "cash" | "card" | "transfer" | "other";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; client?: string; method?: string };
}) {
  await requireBusinessAccount("owner");

  // Lesson dropdown shows ±60 days around today.
  const from = new Date();
  from.setDate(from.getDate() - 60);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  // Filters from the URL. from/to/client go to the service; method is
  // applied here (the service doesn't filter by method).
  const fFrom   = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from ?? "") ? searchParams.from! : undefined;
  const fTo     = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to ?? "")   ? searchParams.to!   : undefined;
  const fClient = searchParams.client || undefined;
  const fMethod = (["cash", "card", "transfer", "other"] as const).includes(searchParams.method as Method)
    ? (searchParams.method as Method)
    : undefined;

  const [paymentsRaw, clients, lessons, horses, outstanding] = await Promise.all([
    listPayments({
      clientId: fClient,
      from: fFrom ? new Date(fFrom).toISOString() : undefined,
      // include the whole "to" day
      to: fTo ? new Date(new Date(fTo).getTime() + 24 * 3600 * 1000).toISOString() : undefined,
    }),
    listClients({ activeOnly: true }),
    getCalendar(from.toISOString(), to.toISOString()),
    // ALL horses (incl. inactive) — boarding is paid for retired/non-lesson
    // horses too, so the payment dropdown must not hide them.
    listHorses().catch(() => []),
    // Unpaid boarding months — lets a boarding payment settle a specific
    // month so it auto-flips to Paid.
    listOutstandingBoardingCharges().catch(() => []),
  ]);

  const payments = fMethod ? paymentsRaw.filter((p) => p.method === fMethod) : paymentsRaw;
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const hasFilter = Boolean(fFrom || fTo || fClient || fMethod);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        subtitle="Cash, card, and transfers received from clients."
        actions={
          <div className="flex items-center gap-2">
            <ExportPdfButton basePath="/dashboard/payments/export" />
            <CreatePaymentPanel
              clients={clients ?? []}
              lessons={lessons ?? []}
              horses={(horses ?? []).map((h) => ({ id: h.id, name: h.name }))}
              outstanding={(outstanding ?? []).map((c) => ({
                id: c.id,
                horse_id: c.horse_id,
                owner_client_id: c.owner_client_id,
                period_label: c.period_label,
                period_start: c.period_start,
                amount: c.amount,
                paid_amount: c.paid_amount,
              }))}
            />
          </div>
        }
      />

      <PaymentFilterBar
        clients={(clients ?? []).map((c) => ({ id: c.id, full_name: c.full_name }))}
        current={{ from: fFrom, to: fTo, client: fClient, method: fMethod }}
      />

      {/* Totals summary */}
      <div className="flex items-center justify-between rounded-2xl bg-navy-700 text-white px-5 py-3">
        <span className="text-[12px] uppercase tracking-[0.12em] text-white/70">
          {hasFilter ? "Filtered total" : "All payments"} · {payments.length}
        </span>
        <span className="font-display text-xl tabular-nums">
          €{total.toFixed(2)}
        </span>
      </div>

      <PaymentList payments={payments} showClientName />
    </div>
  );
}
