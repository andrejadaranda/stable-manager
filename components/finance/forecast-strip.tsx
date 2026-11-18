"use client";

// Income forecast strip — three live numbers for the selected month:
//   Received · Pending · Projected  (+ Expected total)
// Pending and Projected are clickable: tapping expands the exact items behind
// the number (which lesson / boarding month / charge, for which client) so the
// owner can see precisely what's owed and what's still to come.

import { useState } from "react";
import type { MonthForecast, ForecastBreakdown, ForecastLine } from "@/services/billing";

const FMT_EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const FMT_EUR2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const TYPE_LABEL: Record<string, string> = {
  lesson: "Pamoka", boarding: "Pastatymas", charge: "Mokestis", package: "Abonementas", group_lesson: "Grupinė",
};

export function ForecastStrip({ forecast, breakdown }: { forecast: MonthForecast; breakdown?: ForecastBreakdown }) {
  const [open, setOpen] = useState<"pending" | "projected" | null>(null);

  const cards: Array<{ id: "received" | "pending" | "projected"; label: string; hint: string; value: number; tone: string; list?: ForecastLine[] }> = [
    { id: "received", label: "Received", hint: "Collected this month", value: forecast.received, tone: "text-brand-700" },
    { id: "pending", label: "Pending", hint: "Delivered, not yet paid", value: forecast.pending, tone: "text-alert-600", list: breakdown?.pending },
    { id: "projected", label: "Projected", hint: "Booked, still to come", value: forecast.projected, tone: "text-navy-600", list: breakdown?.projected },
  ];

  const openList = open === "pending" ? breakdown?.pending : open === "projected" ? breakdown?.projected : undefined;

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
        {cards.map((c) => {
          const clickable = (c.id === "pending" || c.id === "projected") && (c.list?.length ?? 0) > 0;
          const isOpen = open === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setOpen(isOpen ? null : (c.id as "pending" | "projected"))}
              className={`text-left rounded-xl p-3 transition-colors ${
                clickable ? "bg-ink-50 hover:bg-ink-100 cursor-pointer" : "bg-ink-50 cursor-default"
              } ${isOpen ? "ring-2 ring-brand-500/30" : ""}`}
            >
              <div className={`text-[20px] font-bold leading-none ${c.tone}`}>{FMT_EUR.format(c.value)}</div>
              <div className="text-[12.5px] font-semibold text-ink-700 mt-1.5">
                {c.label}
                {clickable && <span className="ml-1 text-ink-400 font-normal">{isOpen ? "▴" : "▾"}</span>}
              </div>
              <div className="text-[11px] text-ink-400">{c.hint}</div>
            </button>
          );
        })}
      </div>

      {openList && openList.length > 0 && (
        <div className="mt-3 rounded-xl border border-ink-100 overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {openList.map((it) => (
              <li key={it.key} className="px-3 py-2 flex items-center justify-between gap-3 text-[12.5px]">
                <div className="min-w-0">
                  <span className="font-medium text-ink-900">{it.clientName}</span>
                  <span className="text-ink-400"> · {TYPE_LABEL[it.itemType] ?? it.itemType} · {fmtDay(it.occursOn)}</span>
                  <span className="text-ink-500 truncate"> — {it.title}</span>
                </div>
                <span className="shrink-0 font-semibold text-ink-900 tabular-nums">{FMT_EUR2.format(it.remaining)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11.5px] text-ink-400 mt-3">
        Pending ir Projected spustelk — pamatysi tiksliai iš ko sudaryta. Projected juda automatiškai kai įvedi pamokas.
      </p>
    </section>
  );
}
