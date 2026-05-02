// Smart Suggestions widget — proactive heads-up card on the dashboard.
// Each suggestion is a row with a tone-coded left border + headline +
// body + Open arrow. Empty state intentionally skips rendering (no
// "all clear" stub) so the dashboard doesn't have noisy whitespace.

import Link from "next/link";
import type { Suggestion } from "@/services/suggestions";

const TONE: Record<Suggestion["tone"], { border: string; chip: string }> = {
  danger:  { border: "border-l-rose-500",    chip: "bg-rose-50 text-rose-800"     },
  warning: { border: "border-l-amber-500",   chip: "bg-amber-50 text-amber-800"   },
  info:    { border: "border-l-sky-500",     chip: "bg-sky-50 text-sky-800"       },
  ok:      { border: "border-l-emerald-500", chip: "bg-emerald-50 text-emerald-800" },
};

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  welfare_risk:    "Welfare",
  horse_resting:   "Welfare",
  client_balance:  "Money",
  package_expiring: "Packages",
  busy_day:        "Calendar",
  health_overdue:  "Health",
  health_due_soon: "Health",
};

export function SmartSuggestions({ items }: { items: Suggestion[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="font-display text-xl text-navy-900 leading-none">
          Worth knowing today
        </h2>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          {items.length} {items.length === 1 ? "signal" : "signals"}
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {items.map((s) => {
          const tone = TONE[s.tone];
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                className={`
                  block bg-surface/40 rounded-xl border-l-4 ${tone.border}
                  pl-4 pr-3 py-3
                  hover:bg-surface/80 transition-colors group
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded-md ${tone.chip}`}>
                        {KIND_LABEL[s.kind]}
                      </span>
                      <p className="text-sm font-semibold text-navy-900">
                        {s.title}
                      </p>
                    </div>
                    <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                  <span className="text-ink-300 group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" aria-hidden>
                    →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
