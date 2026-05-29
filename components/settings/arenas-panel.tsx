"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createArenaAction,
  updateArenaAction,
  deactivateArenaAction,
  type ArenasState,
} from "@/app/dashboard/settings/arenas/actions";
import type { ArenaRow } from "@/services/arenas";

const initial: ArenasState = { error: null, success: false };

const SURFACE_OPTIONS = ["sand", "grass", "indoor", "outdoor"];
const COLOR_SWATCHES = ["#1E3A2A", "#7C9A6B", "#B59E5D", "#7C3F4D", "#3C5A7A", "#4D4D52"];

export function ArenasPanel({ arenas }: { arenas: ArenaRow[] }) {
  const [openNew, setOpenNew] = useState(false);
  const active   = arenas.filter((a) => a.active);
  const inactive = arenas.filter((a) => !a.active);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl shadow-soft p-5">
        <header className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-navy-900">
            Active arenas <span className="text-ink-400 font-normal">· {active.length}</span>
          </h3>
          <button
            type="button"
            onClick={() => setOpenNew((v) => !v)}
            className="h-9 px-3 rounded-xl text-[12px] font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            {openNew ? "Cancel" : "+ New arena"}
          </button>
        </header>

        {openNew && (
          <NewArenaForm onDone={() => setOpenNew(false)} />
        )}

        {active.length === 0 && !openNew && (
          <p className="text-[13px] text-ink-500">No arenas yet. Add at least one to start booking.</p>
        )}

        <ul className="flex flex-col divide-y divide-ink-100/70">
          {active.map((a) => (
            <ArenaRowEditor key={a.id} arena={a} />
          ))}
        </ul>
      </div>

      {inactive.length > 0 && (
        <details className="bg-white rounded-2xl shadow-soft p-5">
          <summary className="text-sm font-medium text-ink-700 cursor-pointer">
            Inactive · {inactive.length}
          </summary>
          <ul className="mt-3 flex flex-col divide-y divide-ink-100/70">
            {inactive.map((a) => (
              <li key={a.id} className="py-2 flex items-center gap-2 text-[13px] text-ink-600">
                <span className="w-3 h-3 rounded-sm" style={{ background: a.color }} />
                {a.name}
                {a.surface && <span className="text-ink-400">· {a.surface}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function NewArenaForm({ onDone }: { onDone: () => void }) {
  const [state, dispatch] = useFormState<ArenasState, FormData>(createArenaAction, initial);
  const [color, setColor] = useState("#1E3A2A");

  if (state.success) { onDone(); }

  return (
    <form action={dispatch} className="rounded-xl border border-ink-200 bg-ink-50/30 p-4 flex flex-col gap-3 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-ink-600">
          Name
          <input name="name" required placeholder="Indoor arena" className="h-9 rounded-md border border-ink-200 px-2 text-[13px]" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-600">
          Surface
          <select name="surface" className="h-9 rounded-md border border-ink-200 px-2 text-[13px]">
            <option value="">—</option>
            {SURFACE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-[11px] text-ink-600">
          Color
          <input type="hidden" name="color" value={color} />
          <div className="flex gap-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-md border-2 transition-all ${color === c ? "border-ink-900 scale-110" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
      {state.error && (
        <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{state.error}</p>
      )}
      <div className="flex justify-end">
        <SaveButton label="Add arena" />
      </div>
    </form>
  );
}

function ArenaRowEditor({ arena }: { arena: ArenaRow }) {
  const [state, dispatch] = useFormState<ArenasState, FormData>(updateArenaAction, initial);
  const [, deactivate]    = useFormState<ArenasState, FormData>(deactivateArenaAction, initial);
  const [editing, setEditing] = useState(false);
  const [color, setColor] = useState(arena.color);

  if (!editing) {
    return (
      <li className="py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ink-900">
          <span className="w-3 h-3 rounded-sm" style={{ background: arena.color }} />
          <span className="font-medium">{arena.name}</span>
          {arena.surface && <span className="text-ink-500">· {arena.surface}</span>}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-7 px-2.5 text-[11px] text-ink-700 hover:bg-ink-100 rounded-md"
          >
            Edit
          </button>
          <form action={deactivate} className="inline">
            <input type="hidden" name="id" value={arena.id} />
            <button
              type="submit"
              className="h-7 px-2.5 text-[11px] text-ink-500 hover:bg-rose-50 hover:text-rose-700 rounded-md"
            >
              Deactivate
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className="py-2.5">
      <form action={(fd) => { dispatch(fd); setEditing(false); }} className="flex flex-col gap-2 rounded-lg bg-ink-50/40 p-3">
        <input type="hidden" name="id"    value={arena.id} />
        <input type="hidden" name="color" value={color} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-ink-600">
            Name
            <input name="name" defaultValue={arena.name} required className="h-8 rounded-md border border-ink-200 px-2 text-[12px]" />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-ink-600">
            Surface
            <select name="surface" defaultValue={arena.surface ?? ""} className="h-8 rounded-md border border-ink-200 px-2 text-[12px]">
              <option value="">—</option>
              {SURFACE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-600">Color</span>
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-md border-2 transition-all ${color === c ? "border-ink-900 scale-110" : "border-transparent"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        {state.error && (
          <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">{state.error}</p>
        )}
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(false)} className="h-7 px-2.5 text-[11px] text-ink-600 hover:bg-ink-100 rounded-md">
            Cancel
          </button>
          <SaveButton label="Save" small />
        </div>
      </form>
    </li>
  );
}

function SaveButton({ label, small = false }: { label: string; small?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${small ? "h-7 px-2.5 text-[11px]" : "h-9 px-3 text-[12px]"} font-medium bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50`}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
