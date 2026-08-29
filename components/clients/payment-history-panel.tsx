// Client account statement — one dated timeline of EVERYTHING: each lesson /
// charge / boarding as it was billed, and each payment or credit movement,
// with a running balance so the owner can follow the whole flow ("visa eiga
// labai aiški"): what happened, what it cost, when it was paid, and when
// credit was used. Read-only. Owner-gated by the parent page.

import type { StatementEntry } from "@/services/payments";

const FMT = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${FMT.format(Math.abs(n))}`;

export function PaymentHistoryPanel({
  entries,
  availableCredit,
}: {
  entries: StatementEntry[];
  /** Spendable credit left on the account right now. */
  availableCredit: number;
}) {
  // entries come newest-first; the newest one's balanceAfter is the balance now.
  const balanceNow = entries.length ? entries[0].balanceAfter : 0;

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          Account statement
        </h2>
        {availableCredit > 0.001 && (
          <span className="text-[12px] font-semibold text-violet-700">
            {FMT.format(availableCredit)} credit available
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Nothing charged or paid yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {entries.map((e) => {
            const isCharge = e.direction === "charge";
            const amtColor =
              e.direction === "charge"       ? "text-neutral-800" :
              e.direction === "credit_used"  ? "text-violet-700" :
              e.direction === "credit_added" ? "text-sky-700" :
                                               "text-emerald-700";
            const tag =
              e.direction === "charge"       ? "charged" :
              e.direction === "credit_used"  ? "from credit" :
              e.direction === "credit_added" ? "credit" :
                                               "paid";
            return (
              <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-neutral-900 truncate">{e.label}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Vilnius" })}
                    {e.sub ? ` · ${e.sub}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-semibold tabular-nums ${amtColor}`}>
                    {isCharge ? "−" : e.direction === "credit_used" ? "" : "+"}{FMT.format(e.amount)}
                  </span>
                  <p className="text-[10px] uppercase tracking-wide text-neutral-400 mt-0.5">
                    {tag} · bal {signed(e.balanceAfter)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3">
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">Balance now</span>
          <span className={`text-sm font-bold tabular-nums ${balanceNow < -0.001 ? "text-rose-700" : balanceNow > 0.001 ? "text-violet-700" : "text-neutral-700"}`}>
            {signed(balanceNow)}
            <span className="ml-1 text-[10px] font-medium normal-case text-neutral-400">
              {balanceNow < -0.001 ? "owes" : balanceNow > 0.001 ? "in credit" : "settled"}
            </span>
          </span>
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-400 leading-snug">
        Every lesson, charge and boarding as it was billed, and every payment.
        A negative balance is owed; a positive balance is credit paid ahead and
        is drawn down when you tap “Use credit” on a lesson.
      </p>
    </section>
  );
}
