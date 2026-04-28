// Client boarding summary — read-only view rendered on the client
// detail page. Shows boarding charges across all horses this client
// owns, with paid status and total outstanding.
//
// We deliberately keep the actions (mark paid / unpaid) on the horse
// profile, since they belong to a single horse's billing. This view
// is purely a roll-up.

import type { BoardingChargeRow } from "@/services/boarding";

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function ClientBoardingSection({
  charges,
}: {
  charges: BoardingChargeRow[];
}) {
  const totalDue = charges.reduce((acc, c) => {
    const remaining = Math.max(0, Number(c.amount) - Number(c.paid_amount));
    return acc + remaining;
  }, 0);

  // Group by horse so each horse gets its own subsection.
  const byHorse = new Map<string, BoardingChargeRow[]>();
  for (const c of charges) {
    const arr = byHorse.get(c.horse_id) ?? [];
    arr.push(c);
    byHorse.set(c.horse_id, arr);
  }

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Boarding</h2>
          <p className="text-[11.5px] text-ink-500 mt-0.5">
            Charges for horses owned by this client.
          </p>
        </div>
        <p
          className={`text-sm font-semibold tabular-nums ${
            totalDue > 0 ? "text-amber-700" : "text-emerald-700"
          }`}
        >
          {totalDue > 0 ? `${FMT_EUR.format(totalDue)} due` : "All paid"}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {charges.map((c) => (
          <li
            key={c.id}
            className="rounded-xl border border-ink-100 bg-surface px-3 py-2 flex items-center justify-between gap-3 text-xs"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink-900">
                {c.period_label ||
                  `${new Date(c.period_start).toLocaleDateString()} → ${new Date(c.period_end).toLocaleDateString()}`}
              </p>
              <p className="text-[11px] text-ink-500">
                {c.payment_status === "paid"
                  ? `Paid · ${FMT_EUR.format(Number(c.amount))}`
                  : c.payment_status === "partial"
                  ? `Partial · ${FMT_EUR.format(Number(c.paid_amount))} of ${FMT_EUR.format(Number(c.amount))}`
                  : `Unpaid · ${FMT_EUR.format(Number(c.amount))}`}
              </p>
            </div>
            <PaymentStatusPill status={c.payment_status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaymentStatusPill({ status }: { status: "paid" | "partial" | "unpaid" }) {
  const cls =
    status === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : status === "partial"
      ? "bg-amber-100 text-amber-700"
      : "bg-ink-100 text-ink-700";
  const label =
    status === "paid" ? "Paid" : status === "partial" ? "Partial" : "Unpaid";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
