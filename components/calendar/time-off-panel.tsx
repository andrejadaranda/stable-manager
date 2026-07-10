"use client";

// Block-out (time off) manager — mark days or hours when you can't take
// lessons. Shown red on the calendar so nothing gets booked into them.

import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createBlockAction, deleteBlockAction, type BlockState } from "@/app/dashboard/calendar/availability-actions";
import type { AvailabilityBlock } from "@/services/availability.pure";

const initial: BlockState = { ok: false, error: null };

function fmt(iso: string, withTime: boolean): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Vilnius" }) +
    (withTime ? ` ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })}` : "");
}

export function TimeOffPanel({ blocks }: { blocks: AvailabilityBlock[] }) {
  const router = useRouter();
  const [state, dispatch] = useFormState(createBlockAction, initial);
  const [allDay, setAllDay] = useState(true);

  // Refresh the list once a block is saved (revalidatePath already ran
  // server-side; this pulls the new row into the panel).
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "#B23838" }} aria-hidden />
        <h2 className="font-display text-xl text-navy-900">Time off / blocked</h2>
      </div>
      <p className="text-[13px] text-ink-500 mb-4">
        Mark days or hours when you can&apos;t take lessons. They show red on the calendar.
      </p>

      <form action={dispatch} className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-1 bg-ink-50 rounded-xl p-1 w-fit">
          <button type="button" onClick={() => setAllDay(true)}
            className={`h-8 px-3 rounded-lg text-[12.5px] font-medium ${allDay ? "bg-brand-600 text-white" : "text-ink-600"}`}>All day</button>
          <button type="button" onClick={() => setAllDay(false)}
            className={`h-8 px-3 rounded-lg text-[12.5px] font-medium ${!allDay ? "bg-brand-600 text-white" : "text-ink-600"}`}>Time range</button>
        </div>
        <input type="hidden" name="all_day" value={allDay ? "true" : "false"} />

        {allDay ? (
          <label className="flex flex-col gap-1 text-[12px] text-ink-700">
            Date
            <input type="date" name="date" required
              className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3" />
          </label>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-[12px] text-ink-700">
              From
              <input type="datetime-local" name="starts_at" step={900}
                className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-700">
              To
              <input type="datetime-local" name="ends_at" step={900}
                className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3" />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1 text-[12px] text-ink-700">
          Reason (optional)
          <input type="text" name="reason" placeholder="e.g. Away / personal / vet day"
            className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3" />
        </label>

        {state.error && (
          <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-[13px]">{state.error}</p>
        )}
        <BlockSubmit />
      </form>

      {blocks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-ink-100 pt-3">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink-800">
                <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: "#B23838" }} />
                {b.all_day ? `${fmt(b.starts_at, false)} · all day` : `${fmt(b.starts_at, true)} – ${fmt(b.ends_at, true)}`}
                {b.reason ? <span className="text-ink-500"> · {b.reason}</span> : null}
              </span>
              <form action={deleteBlockAction}>
                <input type="hidden" name="id" value={b.id} />
                <button type="submit" className="text-[12px] text-ink-400 hover:text-rose-700">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BlockSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-10 px-4 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 w-fit">
      {pending ? "Saving…" : "Block this time"}
    </button>
  );
}
