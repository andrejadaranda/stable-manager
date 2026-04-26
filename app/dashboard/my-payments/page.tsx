import { requirePageRole } from "@/lib/auth/redirects";
import { listPayments, getClientBalance } from "@/services/payments";
import { PaymentList } from "@/components/payments/payment-list";

export default async function MyPaymentsPage() {
  const session = await requirePageRole("client");

  // A client without a linked clients row can't have payments yet.
  if (!session.clientId) {
    return (
      <div className="flex flex-col gap-3 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">My Payments</h1>
        <p className="text-sm text-neutral-600">
          Your portal account isn&apos;t linked to a client record yet. Ask your
          stable owner to finish setting it up.
        </p>
      </div>
    );
  }

  const [payments, balance] = await Promise.all([
    listPayments(),                            // RLS filters to own payments
    getClientBalance(session.clientId),        // owner-or-self; allowed
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">My Payments</h1>

      <section className="border border-neutral-200 rounded-md bg-white p-4">
        <p className="text-xs text-neutral-500 mb-1">Current balance</p>
        <BalanceLine balance={balance} />
        <p className="text-xs text-neutral-500 mt-2">
          Negative means you owe the stable. Positive means you have a credit.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Payment history</h2>
        <PaymentList payments={payments} showClientName={false} />
      </section>
    </div>
  );
}

function BalanceLine({ balance }: { balance: number }) {
  if (balance < 0) {
    return (
      <p className="text-lg font-semibold text-red-700">
        Owes {Math.abs(balance).toFixed(2)}
      </p>
    );
  }
  if (balance > 0) {
    return (
      <p className="text-lg font-semibold text-emerald-700">
        Credit {balance.toFixed(2)}
      </p>
    );
  }
  return <p className="text-lg font-semibold text-neutral-700">Settled (0.00)</p>;
}
