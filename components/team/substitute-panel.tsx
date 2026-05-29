"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  reassignAction,
  type SubstituteState,
} from "@/app/dashboard/team/substitute/actions";

type TrainerOpt = { id: string; full_name: string | null; role: string };

const initial: SubstituteState = { error: null, result: null };

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function weekFromTodayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function SubstitutePanel({ trainers }: { trainers: TrainerOpt[] }) {
  const [state, dispatch] = useFormState<SubstituteState, FormData>(reassignAction, initial);
  const [fromId, setFromId] = useState("");
  const [toId,   setToId]   = useState("");
  const [from,   setFrom]   = useState(todayISO());
  const [to,     setTo]     = useState(weekFromTodayISO());

  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <form action={dispatch} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select label="Move lessons FROM" name="from_id" value={fromId} onChange={setFromId} options={trainers} placeholder="Pick a trainer…" />
        <Select label="TO trainer"        name="to_id"   value={toId}   onChange={setToId}   options={trainers.filter((t) => t.id !== fromId)} placeholder="Pick a trainer…" />

        <label className="flex flex-col gap-1 text-[12px] text-ink-700">
          From date
          <input
            type="date" name="from_date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700">
          To date
          <input
            type="date" name="to_date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3"
          />
        </label>

        <div className="md:col-span-2 flex justify-end">
          <ReassignButton />
        </div>
      </form>

      {state.error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 text-[13px]">
          {state.error}
        </p>
      )}
      {state.result && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2.5 text-[13px]">
          <p className="font-semibold">
            Reassigned {state.result.reassigned} lesson{state.result.reassigned === 1 ? "" : "s"}.
          </p>
          {state.result.skipped.length > 0 && (
            <>
              <p className="mt-1 opacity-90">
                Skipped {state.result.skipped.length}:
              </p>
              <ul className="list-disc pl-5 mt-0.5 space-y-0.5">
                {state.result.skipped.slice(0, 5).map((s) => (
                  <li key={s.lesson_id}>
                    {new Date(s.starts_at).toLocaleString("en-GB")} — {s.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Select({
  label, name, value, onChange, options, placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: TrainerOpt[];
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] text-ink-700">
      {label}
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-xl border border-ink-200 bg-white text-sm px-3"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.full_name ?? "(no name)"} ({o.role})
          </option>
        ))}
      </select>
    </label>
  );
}

function ReassignButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Reassigning…" : "Reassign lessons"}
    </button>
  );
}
