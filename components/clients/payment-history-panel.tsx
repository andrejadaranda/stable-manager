// Client payment & credit history — a plain, dated statement so the owner can
// see exactly who paid what, when, and where credit was added or deducted.
// Read-only. Owner-gated by the parent page.

import type { LedgerEntry } from "@/services/payments";

const FMT = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export function PaymentHistoryPanel({
  entries,
  availableCredit,
}: {
  entries: LedgerEntry[];
  /** Spendable credit left on the account right now. */
  availableCredit: number;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          Payments &amp; credit
        </h2>
        {availableCredit > 0.001 && (
          <span className="text-[12px] font-semibold text-violet-700">
            {FMT.format(availableCredit)} credit available
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No payments recorded yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {entries.map((e) => (
            <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] text-neutral-900 truncate">{e.label}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Vilnius" })}
                  {e.kind === "payment" && e.method !== "credit" ? ` · ${e.method}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-semibold tabular-nums ${
                  e.kind === "credit_used" ? "text-violet-700" :
                  e.kind === "credit_added" ? "text-sky-700" :
                  "text-emerald-700"
                }`}>
                  {e.kind === "credit_used" ? "−" : "+"}{FMT.format(e.amount)}
                </span>
                <p className="text-[10px] uppercase tracking-wide text-neutral-400 mt-0.5">
                  {e.kind === "credit_used" ? "from credit" : e.kind === "credit_added" ? "credit" : "paid"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-neutral-400 leading-snug">
        “Credit” = money paid ahead. It builds up on overpayment and is drawn
        down when you tap “Use credit” on a lesson.
      </p>
    </section>
  );
}
