import { requirePageRole } from "@/lib/auth/redirects";
import { listPayments } from "@/services/payments";
import { listClients } from "@/services/clients";
import { getCalendar } from "@/services/lessons";
import { PaymentList } from "@/components/payments/payment-list";
import { CreatePaymentPanel } from "@/components/payments/create-payment-form";

export default async function PaymentsPage() {
  await requirePageRole("owner");

  // Lesson dropdown shows ±60 days around today.
  const from = new Date();
  from.setDate(from.getDate() - 60);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  const [payments, clients, lessons] = await Promise.all([
    listPayments(),
    listClients({ activeOnly: true }),
    getCalendar(from.toISOString(), to.toISOString()),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <CreatePaymentPanel
          clients={clients ?? []}
          lessons={lessons ?? []}
        />
      </div>
      <PaymentList payments={payments} showClientName />
    </div>
  );
}
