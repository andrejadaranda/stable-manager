"use client";

// Farrier-visit panel — sits on the calendar page (staff: create + delete)
// and on the owner's /my-lessons page (read-only). A farrier visit is a
// scheduled appointment with one or more horses attached; if a horse is
// owned by a client, RLS surfaces the same visit on that owner's page too.
//
// Self-contained (plain Tailwind, no grid coupling) so it can't affect the
// lessons time-grid. Data + RLS live in migration 66.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalendarFarrierVisit } from "@/services/farrierVisits.pure";
import { FARRIER_EVENT_COLOR } from "@/services/farrierVisits.pure";
import {
  createFarrierVisitAction,
  deleteFarrierVisitAction,
} from "@/app/dashboard/calendar/farrier-actions";

type HorseOpt = { id: string; name: string };

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultStartLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...visits].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [visits],
  );

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteFarrierVisitAction(fd);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: FARRIER_EVENT_COLOR }}
            aria-hidden
          />
          <h2 className="font-display text-xl text-navy-900 truncate">Farrier visits</h2>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => { setError(null); setOpen(true); }}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: FARRIER_EVENT_COLOR }}
          >
            + Farrier visit
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
            ? "No farrier visits scheduled this week. Add one to notify the horses' owners."
            : "No farrier visits scheduled for your horses this week."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((v) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-3 py-2.5 border-b border-ink-100 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy-900 tabular-nums">
                  {fmtWhen(v.starts_at)}
                  {v.farrier_name ? <span className="font-normal text-ink-600"> · {v.farrier_name}</span> : null}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {v.horses.length === 0 ? (
                    <span className="text-[12px] text-ink-500">No horses attached</span>
                  ) : (
                    v.horses.map((h) => (
                      <span
                        key={h.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-ink-100/70 text-ink-700"
                      >
                        {h.name}
                      </span>
                    ))
                  )}
                </div>
                {v.notes ? <p className="mt-1 text-[12.5px] text-ink-500">{v.notes}</p> : null}
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => handleDelete(v.id)}
                  disabled={pending}
                  className="shrink-0 text-[12px] text-ink-500 hover:text-rose-700 disabled:opacity-50"
                  aria-label="Delete farrier visit"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && editable && (
        <CreateFarrierModal
          horses={horses}
          pending={pending}
          onClose={() => setOpen(false)}
          onSubmit={(fd) => {
            setError(null);
            startTransition(async () => {
              const res = await createFarrierVisitAction(fd);
              if (!res.ok) {
                setError(res.error);
              } else {
                setOpen(false);
                router.refresh();
              }
            });
          }}
        />
      )}
    </section>
  );
}

function CreateFarrierModal({
  horses,
  pending,
  onClose,
  onSubmit,
}: {
  horses: HorseOpt[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("horse_ids");
    selected.forEach((id) => fd.append("horse_ids", id));
    onSubmit(fd);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-lift w-full max-w-md max-h-[90vh] overflow-y-auto p-5 md:p-6 flex flex-col gap-4"
      >
        <h3 className="font-display text-xl text-navy-900">New farrier visit</h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Date & time</span>
          <input
            type="datetime-local"
            name="starts_at"
            required
            defaultValue={defaultStartLocal()}
            className="h-10 px-3 rounded-xl bg-cream-soft border border-ink-200 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Duration</span>
          <select
            name="duration"
            defaultValue="60"
            className="h-10 px-3 rounded-xl bg-cream-soft border border-ink-200 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="30">30 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Farrier name <span className="text-ink-400 font-normal">(optional)</span></span>
          <input
            type="text"
            name="farrier_name"
            placeholder="e.g. Tom the farrier"
            className="h-10 px-3 rounded-xl bg-cream-soft border border-ink-200 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Horses being shod</span>
          {horses.length === 0 ? (
            <p className="text-[13px] text-ink-500">No horses available.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
              {horses.map((h) => (
                <label key={h.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-ink-100/40">
                  <input
                    type="checkbox"
                    checked={selected.has(h.id)}
                    onChange={() => toggle(h.id)}
                    className="accent-brand-600"
                  />
                  <span className="text-sm text-navy-900">{h.name}</span>
                </label>
              ))}
            </div>
          )}
          <span className="text-[12px] text-ink-500">
            Owners of attached horses see this visit in their own calendar.
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">Notes <span className="text-ink-400 font-normal">(optional)</span></span>
          <textarea
            name="notes"
            rows={2}
            placeholder="e.g. full set, front shoes only…"
            className="px-3 py-2 rounded-xl bg-cream-soft border border-ink-200 text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none"
          />
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm font-medium text-ink-600 hover:text-navy-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || selected.size === 0}
            className="h-10 px-4 rounded-xl text-sm font-medium text-white shadow-sm disabled:opacity-50"
            style={{ background: FARRIER_EVENT_COLOR }}
          >
            {pending ? "Saving…" : "Schedule visit"}
          </button>
        </div>
      </form>
    </div>
  );
}
