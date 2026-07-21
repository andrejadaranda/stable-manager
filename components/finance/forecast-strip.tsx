// Income forecast strip — three live numbers for the selected month:
//   Received · Pending · Projected  (+ Expected total)
// Server component, presentational only. Numbers come from getMonthForecast
// and update on every load — there is no recalculate button by design.

import type { MonthForecast } from "@/services/billing";

const FMT_EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function ForecastStrip({ forecast }: { forecast: MonthForecast }) {
  const cards: Array<{ label: string; hint: string; value: number; tone: string }> = [
    { label: "Received", hint: "Collected this month", value: forecast.received, tone: "text-brand-700" },
    { label: "Pending", hint: "Delivered, not yet paid", value: forecast.pending, tone: "text-alert-600" },
    { label: "Projected", hint: "Booked, still to come", value: forecast.projected, tone: "text-navy-600" },
  ];

  return (
    <section className="bg-white border border-ink-100 rounded-2xl shadow-soft p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif font-semibold text-[18px] text-ink-900">This month&apos;s income</h2>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Expected</div>
          <div className="text-[22px] font-bold text-ink-900 leading-none mt-0.5">{FMT_EUR.format(forecast.expected)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-ink-50 p-3">
            <div className={`text-[20px] font-bold leading-none ${c.tone}`}>{FMT_EUR.format(c.value)}</div>
            <div className="text-[12.5px] font-semibold text-ink-700 mt-1.5">{c.label}</div>
            <div className="text-[11px] text-ink-400">{c.hint}</div>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-ink-400 mt-3">
        Projected moves automatically as you book lessons — no refresh needed.
      </p>
    </section>
  );
}
