"use client";

// Bulk boarding generation panel — owner-only.
//
// Picking a month re-fetches the preview via URL ?period=YYYY-MM, so
// the table on the right is always in sync with what would actually be
// written. The "Generate" button creates one charge per horse that
// doesn't already have one — re-running is a no-op for the rest.

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  generateBoardingAction,
  type GenerateState,
} from "@/app/dashboard/settings/boarding/actions";
import type { BoardingPreview } from "@/services/boarding";

const initialState: GenerateState = {
  error: null, created: null, skipped: null, totalAmount: null,
};

const FMT_EUR = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "EUR",
});

export function BulkBoardingPanel({
  preview,
  period,
}: {
  preview: BoardingPreview;
  period: string; // YYYY-MM
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [state, action] = useFormState<GenerateState, FormData>(
    generateBoardingAction, initialState,
  );

  // Refresh the preview after a successful generate so the "already
  // has a charge" column reflects the new state.
  useEffect(() => {
    if (state.created !== null && state.created > 0) {
      router.refresh();
    }
  }, [state.created, router]);

  const elig = preview.rows.filter((r) => !r.alreadyHasCharge);
  const newTotal = elig.reduce((acc, r) => acc + Number(r.fee), 0);
  const newCount = elig.length;

  function changePeriod(newPeriod: string) {
    const params = new URLSearchParams(sp);
    params.set("period", newPeriod);
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Period picker + summary -------------------------------- */}
      <div className="bg-white rounded-2xl shadow-soft p-5 flex flex-col sm:flex-row gap-4 sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm flex-1 min-w-0">
          <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">
            Month
          </span>
          <input
            type="month"
            value={period}
            onChange={(e) => changePeriod(e.target.value)}
            className="
              rounded-xl border border-ink-200 bg-white text-sm text-ink-900
              px-3 py-2.5 max-w-[200px]
              focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
            "
          />
        </label>

        <SummaryStat label="Eligible horses" value={String(newCount)} />
        <SummaryStat
          label="Total to bill"
          value={FMT_EUR.format(newTotal)}
          tone="brand"
        />
      </div>

      {/* Action ------------------------------------------------- */}
      {newCount === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
          {preview.rows.length === 0
            ? "No horses qualify yet — set a monthly boarding fee and an owner client on at least one horse."
            : `All ${preview.rows.length} horses already have a charge for ${preview.label}. Nothing to generate.`}
        </div>
      ) : (
        <form
          action={action}
          className="bg-white rounded-2xl shadow-soft p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <input type="hidden" name="year_month" value={period} />
          <p className="text-sm text-ink-700">
            Generate {newCount} {newCount === 1 ? "charge" : "charges"} for{" "}
            <span className="font-medium text-navy-900">{preview.label}</span>{" "}
            totalling{" "}
            <span className="font-semibold text-navy-900 tabular-nums">
              {FMT_EUR.format(newTotal)}
            </span>
            .
          </p>
          <GenerateSubmit />
        </form>
      )}

      {/* Result message ---------------------------------------- */}
      {state.error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
          {state.error}
        </p>
      )}
      {state.created !== null && !state.error && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
          Created {state.created} charge{state.created === 1 ? "" : "s"}{" "}
          totalling {FMT_EUR.format(state.totalAmount ?? 0)}
          {state.skipped ? `, skipped ${state.skipped} (already billed).` : "."}
        </p>
      )}

      {/* Per-horse list ---------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900">Horses</h3>
          <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-ink-500">
            {preview.rows.length} total
          </span>
        </div>
        {preview.rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-500">
            No eligible horses yet. Each horse needs an owner client + a monthly fee.
          </p>
        ) : (
          <ul>
            {preview.rows.map((r) => (
              <li
                key={r.horseId}
                className="px-4 py-3 flex items-center justify-between gap-3 border-b border-ink-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">
                    {r.horseName}
                  </p>
                  <p className="text-[11.5px] text-ink-500 truncate">
                    {r.ownerClientName} · {FMT_EUR.format(Number(r.fee))} / month
                  </p>
                </div>
                {r.alreadyHasCharge ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500 bg-ink-100 rounded-md px-2 py-1">
                    Already billed
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-700 bg-brand-50 rounded-md px-2 py-1">
                    Will bill
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GenerateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-5 rounded-xl text-sm font-medium whitespace-nowrap
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Generating…" : "Generate charges"}
    </button>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand";
}) {
  return (
    <div className="min-w-[140px]">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-500">
        {label}
      </p>
      <p className={`font-display text-xl tabular-nums mt-0.5 ${tone === "brand" ? "text-brand-700" : "text-navy-900"}`}>
        {value}
      </p>
    </div>
  );
}
