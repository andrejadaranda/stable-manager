// Client portal — "My payments + balance" page.
//
// Shows:
//   1. Big balance card — Owes / Credit / Settled with stable-tone colours
//   2. Payment history — every transfer/cash payment the trainer recorded
//      against this client. RLS already narrows listPayments() to the
//      caller's own rows when role='client'.
//
// What we DO NOT show on this client-facing surface:
//   * other clients' transactions (RLS handles it but doc'd for posterity)
//   * the owner-side OwesBreakdown (it surfaces internal lesson/charge
//     IDs and "mark paid" controls — owner-only by design)

import { requirePageRole } from "@/lib/auth/redirects";
import {
  listPayments,
  getClientBalance,
} from "@/services/payments";
import { listChargesForClient } from "@/services/boarding";
import { listMyInvoiceRequests } from "@/services/invoiceRequests";
import { RequestInvoicePanel } from "@/components/invoiceRequests/request-invoice-panel";

export const dynamic = "force-dynamic";

const FMT_EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export default async function MyPaymentsPage() {
  const session = await requirePageRole("client");
  if (!session.clientId) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-ink-600">
          Your account isn&apos;t linked to a client record yet. Ask your
          trainer to re-send your invite, or contact{" "}
          <a href="mailto:hello@longrein.eu" className="text-brand-700 underline">
            hello@longrein.eu
          </a>.
        </p>
      </div>
    );
  }

  const [payments, balance, boardingCharges, invoiceRequests] = await Promise.all([
    listPayments({ clientId: session.clientId }),
    getClientBalance(session.clientId),
    listChargesForClient(session.clientId).catch(() => []),
    listMyInvoiceRequests().catch(() => []),
  ]);

  // Only prefix the horse name when this boarder keeps more than one horse —
  // otherwise it's redundant noise on every row.
  const multipleHorses = new Set(boardingCharges.map((c) => c.horse_id)).size > 1;

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <header>
        <h1
          className="text-3xl tracking-tight text-ink-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
        >
          My payments
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Your balance with the stable + every payment you&apos;ve made.
        </p>
      </header>

      <BalanceCard balance={balance} />

      <RequestInvoicePanel requests={invoiceRequests} />

      {boardingCharges.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
            Boarding by month ({boardingCharges.length})
          </h2>
          <ul className="bg-white rounded-2xl shadow-soft divide-y divide-ink-100">
            {boardingCharges.map((c) => {
              const status = c.payment_status;
              const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
              return (
                <li key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">
                      {multipleHorses && c.horse_name && (
                        <span className="text-ink-500 font-normal">{c.horse_name} · </span>
                      )}
                      {c.period_label ||
                        new Date(c.period_start).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                    </p>
                    <p className="text-[11.5px] text-ink-500 mt-0.5 tabular-nums">
                      {FMT_EUR.format(Number(c.amount))}
                      {status === "partial" && ` · ${FMT_EUR.format(Number(c.paid_amount))} paid`}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      status === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : status === "partial"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {status === "paid"
                      ? "Paid"
                      : status === "partial"
                      ? `${FMT_EUR.format(remaining)} left`
                      : "Unpaid"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[12px] text-ink-500">
            Boarding is billed monthly. Pay your stable directly — once they
            record it, the month flips to <span className="text-emerald-700 font-medium">Paid</span> here.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          Payment history ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-ink-500">
            No payments recorded yet. As your trainer logs payments
            you&apos;ve made, they&apos;ll appear here.
          </p>
        ) : (
          <ul className="bg-white rounded-2xl shadow-soft divide-y divide-ink-100">
            {payments.map((p) => (
              <li
                key={p.id}
                className="px-5 py-3.5 flex items-baseline justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">
                    {p.lesson
                      ? `Lesson · ${new Date(p.lesson.starts_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
                      : "Payment"}
                  </p>
                  <p className="text-[11.5px] text-ink-500 mt-0.5">
                    {new Date(p.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    {" · "}
                    <span className="capitalize">{p.method}</span>
                    {p.lesson?.horse && <> · {p.lesson.horse.name}</>}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-emerald-700">
                  +{FMT_EUR.format(Number(p.amount))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 text-[12px] text-ink-500 bg-ink-50/60 rounded-xl p-4">
        <p>
          <span className="font-medium text-ink-700">How balances work:</span>{" "}
          a negative balance (Owes) means the stable has charged you for
          lessons or services you haven&apos;t paid for yet. A positive
          balance (Credit) means you&apos;ve paid more than what&apos;s due —
          useful when you keep a deposit on file.
        </p>
        <p>
          Payments are recorded by your trainer or the stable owner when they
          receive your cash, card, or bank transfer. If something is missing,
          reach out to them directly.
        </p>
      </section>
    </div>
  );
}

function BalanceCard({ balance }: { balance: number }) {
  if (balance < 0) {
    const owed = Math.abs(balance);
    return (
      <section className="rounded-2xl shadow-soft p-6 bg-gradient-to-br from-rose-50 to-rose-100/60 border border-rose-200">
        <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-rose-700">
          You owe
        </p>
        <p className="text-3xl font-semibold tabular-nums text-rose-900 mt-1">
          {FMT_EUR.format(owed)}
        </p>
        <p className="text-[12.5px] text-rose-800/80 mt-2 leading-relaxed">
          Pay your trainer directly (cash, transfer, card — whatever they
          accept). Once they record the payment it&apos;ll move into your
          history below.
        </p>
      </section>
    );
  }
  if (balance > 0) {
    return (
      <section className="rounded-2xl shadow-soft p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200">
        <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-emerald-700">
          Credit on file
        </p>
        <p className="text-3xl font-semibold tabular-nums text-emerald-900 mt-1">
          {FMT_EUR.format(balance)}
        </p>
        <p className="text-[12.5px] text-emerald-800/80 mt-2 leading-relaxed">
          You&apos;ve paid more than what&apos;s currently charged. This
          credit will offset the next lesson or service.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl shadow-soft p-6 bg-white border border-ink-200">
      <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-ink-500">
        Balance
      </p>
      <p className="text-3xl font-semibold tabular-nums text-ink-900 mt-1">
        {FMT_EUR.format(0)}
      </p>
      <p className="text-[12.5px] text-ink-500 mt-2">
        Settled — nothing outstanding, nothing prepaid.
      </p>
    </section>
  );
}
