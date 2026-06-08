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
  const [detail, setDetail] = useState<HorseCareVisit | null>(null);

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
                <button type="button" onClick={() => setDetail(v)}
                  className="text-left text-sm font-semibold text-navy-900 hover:underline">
                  <span className="inline-flex items-center px-1.5 py-0.5 mr-2 rounded-md text-[10px] font-semibold text-white align-middle"
                    style={{ background: VISIT_KIND_COLOR[v.kind] ?? VISIT_KIND_COLOR.farrier }}>
                    {VISIT_KIND_LABEL[v.kind] ?? "Visit"}
                  </span>
                  {fmtDate(v.starts_at)}
                  {v.farrier_name ? <span className="font-normal text-ink-600"> · {v.farrier_name}</span> : null}
                </button>
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
              {v.note && <p className="text-[12.5px] text-ink-500 line-clamp-1">“{v.note}”</p>}
            </li>
          ))}
        </ul>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-lift w-full max-w-md p-5 md:p-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                  style={{ background: VISIT_KIND_COLOR[detail.kind] ?? VISIT_KIND_COLOR.farrier }}>
                  {VISIT_KIND_LABEL[detail.kind] ?? "Visit"}
                </span>
                <h3 className="mt-2 font-display text-xl text-navy-900">{fmtDate(detail.starts_at)}</h3>
                {detail.farrier_name && <p className="text-sm text-ink-600">{detail.farrier_name}</p>}
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-ink-400 hover:text-navy-900 text-xl leading-none" aria-label="Close">×</button>
            </div>

            {detail.cost_cents != null && (
              <div className="flex items-center justify-between rounded-xl bg-cream-soft px-3 py-2.5">
                <span className="text-sm text-ink-600">Cost</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-navy-900">{eur(detail.cost_cents)}</span>
                  {detail.paid_at ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Paid ✓</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">Unpaid</span>
                  )}
                </span>
              </div>
            )}

            <div>
              <p className="text-[12px] uppercase tracking-[0.12em] font-medium text-ink-500 mb-1">What was done</p>
              <p className="text-sm text-navy-900 whitespace-pre-wrap">{detail.note || "No notes recorded for this visit."}</p>
            </div>

            {editable && detail.cost_cents != null && (
              <button type="button" disabled={pending}
                onClick={() => { togglePaid(detail.id, !detail.paid_at); setDetail(null); }}
                className={`h-10 rounded-xl text-sm font-medium disabled:opacity-50 ${detail.paid_at ? "bg-ink-100 text-ink-700" : "text-white"}`}
                style={detail.paid_at ? undefined : { background: VISIT_KIND_COLOR.farrier }}>
                {detail.paid_at ? "Mark unpaid" : "Mark paid"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
