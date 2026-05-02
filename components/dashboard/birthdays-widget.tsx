// Upcoming birthdays widget — emotional micro-feature that nobody else
// in the equestrian software space ships. Shows on the dashboard
// when at least one entry falls in the next 14 days.

import Link from "next/link";
import type { BirthdayEntry } from "@/services/birthdays";

export function BirthdaysWidget({ items }: { items: BirthdayEntry[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="font-display text-xl text-navy-900 leading-none flex items-baseline gap-2">
          <span aria-hidden>🎂</span>
          Upcoming birthdays
        </h2>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          Next 14 days
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {items.slice(0, 5).map((b) => (
          <li key={`${b.kind}:${b.id}`}>
            <Link
              href={b.href}
              className="
                flex items-center gap-3 px-3 py-2 rounded-xl
                bg-surface/40 hover:bg-surface/80 transition-colors group
              "
            >
              <span
                className={`
                  shrink-0 w-9 h-9 rounded-xl inline-flex items-center justify-center
                  ${b.kind === "horse" ? "bg-brand-50 text-brand-700" : "bg-navy-50 text-navy-700"}
                `}
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                aria-hidden
              >
                {b.name[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-900 truncate">{b.name}</p>
                <p className="text-[11.5px] text-ink-500">
                  {labelFor(b.daysAway)}
                  {b.age != null && (
                    <>
                      {" · "}turns {b.age}
                    </>
                  )}
                </p>
              </div>
              <span className="text-ink-300 group-hover:text-brand-700 transition-colors shrink-0" aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function labelFor(daysAway: number): string {
  if (daysAway === 0)  return "Today";
  if (daysAway === 1)  return "Tomorrow";
  if (daysAway <= 6)   return `In ${daysAway} days`;
  if (daysAway <= 14)  return `In ${daysAway} days`;
  return `${daysAway}d away`;
}
