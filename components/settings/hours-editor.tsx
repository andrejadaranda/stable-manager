"use client";

import { useState, useTransition } from "react";
import {
  saveDayAction,
  closeDayAction,
  addHolidayAction,
  removeHolidayAction,
} from "@/app/dashboard/settings/hours/actions";
import { DAY_LABELS, type WorkingHour, type Holiday } from "@/services/workingHours";

export function HoursEditor({
  initialHours,
  initialHolidays,
}: {
  initialHours: WorkingHour[];
  initialHolidays: Holiday[];
}) {
  const [, startT] = useTransition();
  const byDay = new Map<number, WorkingHour>();
  for (const h of initialHours) byDay.set(h.day_of_week, h);

  async function onSaveDay(day: number, open: string, close: string) {
    const fd = new FormData();
    fd.set("day_of_week", String(day));
    fd.set("open_time",   open);
    fd.set("close_time",  close);
    const res = await saveDayAction(fd);
    if (res.error) alert(res.error);
    else window.location.reload();
  }

  async function onClose(day: number) {
    if (!confirm(`Close ${DAY_LABELS[day]}?`)) return;
    startT(async () => { await closeDayAction(day); window.location.reload(); });
  }

  return (
    <div className="space-y-8">
      {/* Working hours */}
      <section className="bg-white border border-ink-100 rounded-2xl p-5 shadow-soft">
        <h3 className="font-display text-base text-navy-700 mb-4">Weekly schedule</h3>
        <ul className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const h = byDay.get(day);
            return <DayRow key={day} day={day} hour={h} onSave={onSaveDay} onClose={onClose} />;
          })}
        </ul>
      </section>

      {/* Holidays */}
      <section className="bg-white border border-ink-100 rounded-2xl p-5 shadow-soft">
        <h3 className="font-display text-base text-navy-700 mb-4">Holidays &amp; closures</h3>
        <HolidayAdd />
        {initialHolidays.length === 0 ? (
          <p className="text-sm text-ink-500 mt-4">No holidays set.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {initialHolidays.map((hd) => (
              <li key={hd.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono tabular-nums text-ink-900">{hd.closed_date}</span>
                <span className="flex-1 text-ink-700">{hd.label ?? "Closed"}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("Remove this holiday?")) return;
                    startT(async () => { await removeHolidayAction(hd.id); window.location.reload(); });
                  }}
                  className="text-xs text-red-700 hover:text-red-900"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DayRow({
  day,
  hour,
  onSave,
  onClose,
}: {
  day: number;
  hour: WorkingHour | undefined;
  onSave: (day: number, open: string, close: string) => Promise<void>;
  onClose: (day: number) => void;
}) {
  const [open,  setOpen]  = useState(hour?.open_time?.slice(0, 5)  ?? "07:00");
  const [close, setClose] = useState(hour?.close_time?.slice(0, 5) ?? "21:00");
  const isClosed = !hour;

  return (
    <li className={`flex items-center gap-3 py-2 px-3 rounded-xl ${isClosed ? "bg-ink-50/50" : "bg-cream-50"}`}>
      <span className="w-24 text-sm font-medium text-ink-900">{DAY_LABELS[day]}</span>
      {isClosed ? (
        <span className="flex-1 text-sm text-ink-500">Closed</span>
      ) : (
        <span className="flex-1 flex items-center gap-2 text-sm tabular-nums">
          <input
            type="time"
            value={open}
            onChange={(e) => setOpen(e.target.value)}
            className="h-9 px-2 rounded-lg border border-ink-200"
          />
          <span className="text-ink-500">→</span>
          <input
            type="time"
            value={close}
            onChange={(e) => setClose(e.target.value)}
            className="h-9 px-2 rounded-lg border border-ink-200"
          />
        </span>
      )}
      <button
        type="button"
        onClick={() => onSave(day, open, close)}
        className="h-9 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors"
      >
        {isClosed ? "Open" : "Save"}
      </button>
      {!isClosed && (
        <button
          type="button"
          onClick={() => onClose(day)}
          className="h-9 px-3 rounded-lg border border-ink-200 text-xs text-ink-700 hover:bg-ink-50 transition-colors"
        >
          Close
        </button>
      )}
    </li>
  );
}

function HolidayAdd() {
  const [date,  setDate]  = useState("");
  const [label, setLabel] = useState("");
  const [, startT] = useTransition();
  const [err,   setErr]   = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!date) { setErr("Pick a date."); return; }
    const fd = new FormData();
    fd.set("closed_date", date);
    fd.set("label", label);
    startT(async () => {
      const res = await addHolidayAction(fd);
      if (res.error) setErr(res.error);
      else { setDate(""); setLabel(""); window.location.reload(); }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-10 px-3 rounded-xl border border-ink-200 text-sm"
      />
      <input
        type="text"
        placeholder="Label (e.g. Christmas)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 h-10 px-3 rounded-xl border border-ink-200 text-sm"
      />
      <button
        type="submit"
        className="h-10 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
      >
        Add
      </button>
      {err && <span className="text-sm text-red-700 self-center">{err}</span>}
    </form>
  );
}
