// Dashboard onboarding checklist. Server component — pure render of
// the steps from `getOnboardingStatus()`. Hides itself once the stable
// is fully set up so it doesn't take up space forever.

import Link from "next/link";
import type { OnboardingStatus } from "@/services/onboarding";

export function OnboardingChecklist({ status }: { status: OnboardingStatus | null }) {
  // Hide entirely when fully done.
  if (!status || status.complete) return null;

  // The next undone step gets the brand CTA treatment so the user
  // sees exactly what to tap next.
  const nextIdx = status.steps.findIndex((s) => !s.done);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-navy-900 leading-none">
            Get your stable up and running
          </h2>
          <p className="text-[12.5px] text-ink-500 mt-1.5">
            A few clicks to go from empty to ready to book.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500 tabular-nums">
          {status.pct}% done
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full bg-brand-600 transition-all"
          style={{ width: `${status.pct}%` }}
        />
      </div>

      <ul className="flex flex-col gap-1.5">
        {status.steps.map((s, i) => {
          const isNext = i === nextIdx;
          return (
            <li
              key={s.key}
              className={`rounded-xl border px-3 py-2.5 flex items-start gap-3 ${
                s.done
                  ? "border-emerald-100 bg-emerald-50/40"
                  : isNext
                  ? "border-brand-200 bg-brand-50/50"
                  : "border-ink-100 bg-surface"
              }`}
            >
              {/* Status dot */}
              <span
                aria-hidden
                className={`mt-0.5 w-5 h-5 rounded-full border shrink-0 inline-flex items-center justify-center ${
                  s.done
                    ? "border-emerald-600 bg-emerald-600 text-white text-[12px]"
                    : isNext
                    ? "border-brand-500 bg-white"
                    : "border-ink-300 bg-white"
                }`}
              >
                {s.done ? "✓" : ""}
              </span>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${s.done ? "text-emerald-800" : "text-navy-900"}`}>
                  {s.label}
                </p>
                {!s.done && (
                  <p className="text-[11.5px] text-ink-600 mt-0.5">{s.hint}</p>
                )}
              </div>

              {!s.done && (
                <Link
                  href={s.href}
                  className={`shrink-0 h-8 px-3 inline-flex items-center rounded-lg text-[12px] font-medium ${
                    isNext
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "bg-white text-ink-700 hover:bg-ink-100/60 border border-ink-200"
                  }`}
                >
                  {isNext ? "Take me there →" : "Open"}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
