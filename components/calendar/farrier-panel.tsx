"use client";

// Farrier/vet visit panel — calendar page (staff: create, edit, delete,
// mark paid per horse) and the owner's /my-lessons page (read-only, sees
// their horses' cost + paid status + note). Each attached horse carries
// an optional cost (the owner's debt for the work) and a note (what the
// farrier/vet said). Self-contained — no coupling to the lessons grid.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  CalendarFarrierVisit,
  CareVisitKind,
  FarrierVisitHorse,
} from "@/services/farrierVisits.pure";
import { VISIT_KIND_COLOR, VISIT_KIND_LABEL } from "@/services/farrierVisits.pure";
import {
  createFarrierVisitAction,
  updateFarrierVisitAction,
  deleteFarrierVisitAction,
  toggleFarrierPaidAction,
} from "@/app/dashboard/calendar/farrier-actions";

type HorseOpt = { id: string; name: string };

function eur(cents: number | null): string {
  if (cents == null) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStartLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + 1, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function durationMinutes(startIso: string, endIso: string): number {
  const m = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  return [30, 60, 90, 120, 180].includes(m) ? m : 60;
}

export function FarrierPanel({
  visits,
  horses = [],
  editable = false,
}: {
  visits: CalendarFarrierVisit[];
  horses?: HorseOpt[];
  editable?: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | { edit?: CalendarFarrierVisit }>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...visits].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [visits],
  );

  function run(action: () => Promise<{ ok: boolean; error: string | null }>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      else { onOk?.(); router.refresh(); }
    });
  }

  function handleDelete(id: string) {
    const fd = new FormData(); fd.set("id", id);
    run(() => deleteFarrierVisitAction(fd));
  }

  function handleTogglePaid(visitId: string, horseId: string, paid: boolean) {
    const fd = new FormData();
    fd.set("visit_id", visitId); fd.set("horse_id", horseId); fd.set("paid", String(paid));
    run(() => toggleFarrierPaidAction(fd));
  }

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center gap-1 shrink-0" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VISIT_KIND_COLOR.farrier }} />
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VISIT_KIND_COLOR.vet }} />
          </span>
          <h2 className="font-display text-xl text-navy-900 truncate">Farrier &amp; vet visits</h2>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => { setError(null); setModal({}); }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: VISIT_KIND_COLOR.farrier }}
          >
            + New visit
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[13px] px-3 py-2">
          {error}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-500">
          {editable
            ? "No farrier or vet visits scheduled this week. Add one to record costs and notify owners."
            : "No farrier or vet visits scheduled for your horses this week."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((v) => (
            <li key={v.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-navy-900 tabular-nums min-w-0">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 mr-2 rounded-md text-[10px] font-semibold text-white align-middle"
                    style={{ background: VISIT_KIND_COLOR[v.kind] ?? VISIT_KIND_COLOR.farrier }}
                  >
                    {VISIT_KIND_LABEL[v.kind] ?? "Visit"}
                  </span>
                  {fmtWhen(v.starts_at)}
                  {v.farrier_name ? <span className="font-normal text-ink-600"> · {v.farrier_name}</span> : null}
                </p>
                {editable && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button type="button" onClick={() => { setError(null); setModal({ edit: v }); }}
                      className="text-[12px] text-ink-500 hover:text-navy-900">Edit</button>
                    <button type="button" onClick={() => handleDelete(v.id)} disabled={pending}
                      className="text-[12px] text-ink-500 hover:text-rose-700 disabled:opacity-50">Delete</button>
                  </div>
                )}
              </div>

              {v.horses.length === 0 ? (
                <p className="mt-2 text-[12px] text-ink-500">No horses attached</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {v.horses.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2 flex-wrap text-[13px]">
                      <span className="font-medium text-navy-900">{h.name}</span>
                      <span className="flex items-center gap-2">
                        {h.cost_cents != null && (
                          <span className="tabular-nums text-ink-700">{eur(h.cost_cents)}</span>
                        )}
                        {h.cost_cents != null && (
                          h.paid_at ? (
                            editable ? (
                              <button type="button" disabled={pending}
                                onClick={() => handleTogglePaid(v.id, h.id, false)}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 disabled:opacity-50">
                                Paid ✓
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Paid ✓</span>
                            )
                          ) : (
                            editable ? (
                              <button type="button" disabled={pending}
                                onClick={() => handleTogglePaid(v.id, h.id, true)}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ink-100 text-ink-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50">
                                Mark paid
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">Unpaid</span>
                            )
                          )
                        )}
                      </span>
                      {h.note && <span className="w-full text-[12px] text-ink-500">“{h.note}”</span>}
                    </li>
                  ))}
                </ul>
              )}
              {v.notes ? <p className="mt-1.5 text-[12px] text-ink-500">{v.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {modal && editable && (
        <CareVisitModal
          horses={horses}
          edit={modal.edit}
          pending={pending}
          onClose={() => setModal(null)}
          onSubmit={(fd) => {
            const action = modal.edit
              ? () => updateFarrierVisitAction(fd)
              : () => createFarrierVisitAction(fd);
            run(action, () => setModal(null));
          }}
        />
      )}
    </section>
  );
}

type HorseRowState = { selected: boolean; cost: string; note: string };

function CareVisitModal({
  horses,
  edit,
  pending,
  onClose,
  onSubmit,
}: {
  horses: HorseOpt[];
  edit?: CalendarFarrierVisit;
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  // Merge any horses already on the visit (edit) so they're selectable
  // even if not in the active-horse list (e.g. archived).
  const horseList: HorseOpt[] = useMemo(() => {
    const map = new Map<string, HorseOpt>();
    horses.forEach((h) => map.set(h.id, { id: h.id, name: h.name }));
    edit?.horses.forEach((h: FarrierVisitHorse) => { if (!map.has(h.id)) map.set(h.id, { id: h.id, name: h.name }); });
    return Array.from(map.values());
  }, [horses, edit]);

  const [rows, setRows] = useState<Record<string, HorseRowState>>(() => {
    const init: Record<string, HorseRowState> = {};
    edit?.horses.forEach((h: FarrierVisitHorse) => {
      init[h.id] = {
        selected: true,
        cost: h.cost_cents != null ? (h.cost_cents / 100).toString() : "",
        note: h.note ?? "",
      };
    });
    return init;
  });

  function rowOf(id: string): HorseRowState {
    return rows[id] ?? { selected: false, cost: "", note: "" };
  }
  function setRow(id: string, patch: Partial<HorseRowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...rowOf(id), ...patch } }));
  }

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("horse_ids");
    Object.entries(rows).forEach(([id, r]) => {
      if (!r.selected) return;
      fd.append("horse_ids", id);
      fd.set(`cost_${id}`, r.cost);
      fd.set(`note_${id}`, r.note);
    });
    onSubmit(fd);
  }

  const fieldCls = "h-10 px-3 rounded-xl bg-cream-soft border border-ink-200 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-lift w-full max-w-md max-h-[90vh] overflow-y-auto p-5 md:p-6 flex flex-col gap-4">
        <h3 className="font-display text-xl text-navy-900">{edit ? "Edit visit" : "New visit"}</h3>
        {edit && <input type="hidden" name="id" defaultValue={edit.id} />}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Type</span>
          <select name="kind" defaultValue={edit?.kind ?? "farrier"} className={fieldCls}>
            <option value="farrier">Farrier (shoeing)</option>
            <option value="vet">Vet visit</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">Date &amp; time</span>
            <input type="datetime-local" name="starts_at" required
              defaultValue={edit ? isoToLocalInput(edit.starts_at) : defaultStartLocal()} className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">Duration</span>
            <select name="duration" defaultValue={String(edit ? durationMinutes(edit.starts_at, edit.ends_at) : 60)} className={fieldCls}>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">Farrier / vet name <span className="text-ink-400 font-normal">(optional)</span></span>
            <input type="text" name="farrier_name" defaultValue={edit?.farrier_name ?? ""} placeholder="e.g. Tom, Dr. Weber" className={fieldCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">Paid to farrier/vet €</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" name="expense"
              defaultValue={edit?.expense_cents != null ? (edit.expense_cents / 100).toString() : ""}
              placeholder="0.00" className={fieldCls} />
          </label>
        </div>
        <span className="-mt-2 text-[12px] text-ink-500">What you paid the farrier/vet — recorded in Expenses.</span>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Horses — tick each, add cost &amp; note</span>
          {horseList.length === 0 ? (
            <p className="text-[13px] text-ink-500">No horses available.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
              {horseList.map((h) => {
                const r = rowOf(h.id);
                return (
                  <div key={h.id} className="px-3 py-2">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={r.selected} onChange={() => setRow(h.id, { selected: !r.selected })} className="accent-brand-600" />
                      <span className="text-sm font-medium text-navy-900">{h.name}</span>
                    </label>
                    {r.selected && (
                      <div className="mt-2 pl-7 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-ink-500 w-12">Cost €</span>
                          <input type="number" min="0" step="0.01" inputMode="decimal" value={r.cost}
                            onChange={(e) => setRow(h.id, { cost: e.target.value })} placeholder="0.00"
                            className="h-9 px-2.5 rounded-lg bg-cream-soft border border-ink-200 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                        </div>
                        <input type="text" value={r.note} onChange={(e) => setRow(h.id, { note: e.target.value })}
                          placeholder="What the farrier/vet said about this horse…"
                          className="h-9 px-2.5 rounded-lg bg-cream-soft border border-ink-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-200" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <span className="text-[12px] text-ink-500">
            Owners of attached horses see the visit, the cost (their debt), and the note in their own calendar &amp; the horse's page.
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">General notes <span className="text-ink-400 font-normal">(optional)</span></span>
          <textarea name="notes" rows={2} defaultValue={edit?.notes ?? ""} placeholder="e.g. whole yard, front shoes only…"
            className="px-3 py-2 rounded-xl bg-cream-soft border border-ink-200 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-medium text-ink-600 hover:text-navy-900">Cancel</button>
          <button type="submit" disabled={pending || selectedCount === 0}
            className="h-10 px-4 rounded-xl text-sm font-medium text-white shadow-sm disabled:opacity-50"
            style={{ background: VISIT_KIND_COLOR.farrier }}>
            {pending ? "Saving…" : edit ? "Save changes" : "Schedule visit"}
          </button>
        </div>
      </form>
    </div>
  );
}
