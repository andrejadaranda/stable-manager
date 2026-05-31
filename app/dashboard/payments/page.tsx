import { requireBusinessAccount } from "@/lib/auth/redirects";
import { listPayments } from "@/services/payments";
import { listClients } from "@/services/clients";
import { listHorses } from "@/services/horses";
import { getCalendar } from "@/services/lessons";
import { PaymentList } from "@/components/payments/payment-list";
import { CreatePaymentPanel } from "@/components/payments/create-payment-form";
import { ExportPdfButton } from "@/components/payments/export-pdf-button";
import { PageHeader } from "@/components/ui";

export default async function PaymentsPage() {
  await requireBusinessAccount("owner");

  // Lesson dropdown shows ±60 days around today.
  const from = new Date();
  from.setDate(from.getDate() - 60);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  const [payments, clients, lessons, horses] = await Promise.all([
    listPayments(),
    listClients({ activeOnly: true }),
    getCalendar(from.toISOString(), to.toISOString()),
    // ALL horses (incl. inactive) — boarding is paid for retired/non-lesson
    // horses too, so the payment dropdown must not hide them.
    listHorses().catch(() => []),
  ]);

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
            />
          </div>
        }
      />
      <PaymentList payments={payments} showClientName />
    </div>
  );
}
