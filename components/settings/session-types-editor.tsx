"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createTypeAction,
  toggleActiveAction,
  renameAction,
  recolorAction,
  deleteTypeAction,
  type CrudState,
} from "@/app/dashboard/settings/session-types/actions";
import type { StableSessionType } from "@/services/stableSessionTypes";

const PALETTE = ["#1E3A2A", "#B5793E", "#2C6BB5", "#7A1F2B", "#6B2C7A", "#588157", "#1B1B1B"];
const initial: CrudState = { error: null, success: false };

export function SessionTypesEditor({ initialTypes }: { initialTypes: StableSessionType[] }) {
  const [types, setTypes] = useState(initialTypes);
  const [state, action] = useFormState(createTypeAction, initial);
  const [color, setColor] = useState("#1E3A2A");
  const [, startT] = useTransition();

  function refresh() {
    // Server actions revalidate, but local UI optimism = snappier.
    // Real refresh happens on navigation; for now reload from window.
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <form action={action} className="bg-white border border-ink-100 rounded-2xl p-5 shadow-soft space-y-3">
        <h3 className="font-display text-base text-navy-700">Add a new type</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            name="label"
            required
            minLength={2}
            maxLength={50}
            placeholder="e.g. Vaikų natūralus jojimas"
            className="flex-1 h-11 px-3 rounded-xl border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <div className="flex items-center gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-lg border-2 transition-all ${
                  color === c ? "border-ink-900 scale-110" : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input type="hidden" name="color" value={color} />
          </div>
          <AddBtn />
        </div>
        {state.error   && <p className="text-sm text-red-700">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-700">✓ Added.</p>}
      </form>

      {/* List */}
      {types.length === 0 ? (
        <div className="bg-cream-50 border border-ink-100 rounded-2xl p-8 text-center">
          <p className="text-sm text-ink-700">No custom types yet — your stable uses the default 11 session types.</p>
          <p className="text-xs text-ink-500 mt-1.5">Add a type above to override.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {types.map((t) => (
            <li
              key={t.id}
              className={`bg-white border border-ink-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-soft ${
                !t.active ? "opacity-60" : ""
              }`}
            >
              <span
                className="h-5 w-5 rounded-md shrink-0"
                style={{ backgroundColor: t.color ?? "#1E3A2A" }}
              />
              <span className="flex-1 text-sm font-medium text-ink-900">{t.label}</span>
              <button
                type="button"
                onClick={() => {
                  const name = prompt("Rename to:", t.label);
                  if (!name) return;
                  startT(async () => { await renameAction(t.id, name); refresh(); });
                }}
                className="text-xs text-ink-500 hover:text-ink-900 px-2"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  startT(async () => { await toggleActiveAction(t.id, !t.active); refresh(); });
                }}
                className="text-xs text-ink-500 hover:text-ink-900 px-2"
              >
                {t.active ? "Disable" : "Enable"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Delete "${t.label}"?`)) return;
                  startT(async () => { await deleteTypeAction(t.id); refresh(); });
                }}
                className="text-xs text-red-700 hover:text-red-900 px-2"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}
