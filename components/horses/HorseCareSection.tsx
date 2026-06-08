"use client";

// Farrier & vet care history for a single horse — shown on the horse's
// dashboard (staff) and the owner's horse page (read-only). Staff can
// flip the per-horse paid flag right here; owners see cost + paid status
// + the farrier/vet's note about their horse.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HorseCareVisit } from "@/services/farrierVisits.pure";
import { VISIT_KIND_COLOR, VISIT_KIND_LABEL } from "@/services/farrierVisits.pure";
import { toggleFarrierPaidAction } from "@/app/dashboard/calendar/farrier-actions";

function eur(cents: number | null): string {
  if (cents == null) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(cents / 100);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function HorseCareSection({
  visits,
  horseId,
  editable = false,
}: {
  visits: HorseCareVisit[];
  horseId: string;
  editable?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function togglePaid(visitId: string, paid: boolean) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("visit_id", visitId);
      fd.set("horse_id", horseId);
      fd.set("paid", String(paid));
      const res = await toggleFarrierPaidAction(fd);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const outstanding = visits
    .filter((v) => v.cost_cents != null && !v.paid_at)
    .reduce((sum, v) => sum + (v.cost_cents ?? 0), 0);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center gap-1 shrink-0" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VISIT_KIND_COLOR.farrier }} />
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VISIT_KIND_COLOR.vet }} />
          </span>
          <h2 className="font-display text-xl text-navy-900 truncate">Farrier &amp; vet</h2>
        </div>
        {outstanding > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-amber-100 text-amber-800 tabular-nums">
            {eur(outstanding)} outstanding
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] px-3 py-2">{error}</div>
      )}

      {visits.length === 0 ? (
        <p className="text-sm text-ink-500">No farrier or vet visits recorded for this horse yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visits.map((v) => (
            <li key={v.id} className="flex flex-col gap-1 py-2.5 border-b border-ink-100 last:border-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold text-navy-900">
                  <span className="inline-flex items-center px-1.5 py-0.5 mr-2 rounded-md text-[10px] font-semibold text-white align-middle"
                    style={{ background: VISIT_KIND_COLOR[v.kind] ?? VISIT_KIND_COLOR.farrier }}>
                    {VISIT_KIND_LABEL[v.kind] ?? "Visit"}
                  </span>
                  {fmtDate(v.starts_at)}
                  {v.farrier_name ? <span className="font-normal text-ink-600"> · {v.farrier_name}</span> : null}
                </p>
                <span className="flex items-center gap-2">
                  {v.cost_cents != null && <span className="text-sm tabular-nums text-ink-700">{eur(v.cost_cents)}</span>}
                  {v.cost_cents != null && (
                    v.paid_at ? (
                      editable ? (
                        <button type="button" disabled={pending} onClick={() => togglePaid(v.id, false)}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 disabled:opacity-50">Paid ✓</button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Paid ✓</span>
                      )
                    ) : (
                      editable ? (
                        <button type="button" disabled={pending} onClick={() => togglePaid(v.id, true)}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ink-100 text-ink-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">Mark paid</button>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">Unpaid</span>
                      )
                    )
                  )}
                </span>
              </div>
              {v.note && <p className="text-[12.5px] text-ink-500">“{v.note}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
