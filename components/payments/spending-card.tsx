// Client portal — "Spending so far". Shows where the client's money went
// (lessons, boarding, farrier/vet, other) plus how much they've paid.
// Server component — pure display, no interactivity.

import type { ClientSpendingBreakdown } from "@/services/payments";

const FMT_EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function SpendingCard({ breakdown }: { breakdown: ClientSpendingBreakdown }) {
  const { lessons, lessonsCount, boarding, care, other, totalBilled, totalPaid } = breakdown;
  if (totalBilled === 0 && totalPaid === 0) return null;

  const rows: Array<{ label: string; value: number; hint?: string }> = [
    { label: "Lessons", value: lessons, hint: lessonsCount ? `${lessonsCount} ${lessonsCount === 1 ? "lesson" : "lessons"}` : undefined },
    { label: "Boarding", value: boarding },
    { label: "Farrier & vet", value: care },
    { label: "Other", value: other },
  ].filter((r) => r.value > 0);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <h2 className="font-display text-xl text-navy-900 mb-4">Spending so far</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-ink-50/70 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-500">Total billed</p>
          <p className="text-2xl font-medium text-navy-900 tabular-nums mt-1">{FMT_EUR.format(totalBilled)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50/70 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-700">Paid</p>
          <p className="text-2xl font-medium text-emerald-800 tabular-nums mt-1">{FMT_EUR.format(totalPaid)}</p>
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-2 border-t border-ink-100 first:border-0">
              <span className="text-[13px] text-ink-700">
                {r.label}
                {r.hint && <span className="text-ink-400"> · {r.hint}</span>}
              </span>
              <span className="text-[13px] font-medium text-navy-900 tabular-nums">{FMT_EUR.format(r.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
