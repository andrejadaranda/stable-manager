"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import {
  createSessionAction,
  type CreateSessionState,
} from "@/app/dashboard/sessions/actions";
import { SESSION_TYPES } from "@/services/sessions.types";

type HorseOpt  = { id: string; name: string };
type ClientOpt = { id: string; full_name: string };

const initialState: CreateSessionState = { error: null, success: false };

// Local-storage key for "last selection" — pre-fills the trainer's most
// recent picks so the next session is one tap away. This is the wedge.
const LAST_KEY = "sessions:last_pick_v1";

type LastPick = {
  horse_id?: string;
  rider_client_id?: string;
  type?: string;
  duration_minutes?: string;
};

export function LogSessionForm({
  horses,
  clients,
}: {
  horses: HorseOpt[];
  clients: ClientOpt[];
}) {
  const [state, formAction] = useActionState(createSessionAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [last, setLast] = useState<LastPick>({});

  // Read last pick on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KEY);
      if (raw) setLast(JSON.parse(raw));
    } catch {}
  }, []);

  // On success: persist last pick + reset the form so the next entry is fast.
  useEffect(() => {
    if (!state.success || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const next: LastPick = {
      horse_id:         String(fd.get("horse_id") ?? ""),
      rider_client_id:  String(fd.get("rider_client_id") ?? ""),
      type:             String(fd.get("type") ?? ""),
      duration_minutes: String(fd.get("duration_minutes") ?? ""),
    };
    try { localStorage.setItem(LAST_KEY, JSON.stringify(next)); } catch {}
    formRef.current.reset();
    // Re-apply defaults from the *just-saved* pick so the next session
    // is literally a single tap.
    setLast(next);
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4"
    >
      {/* Horse ----------------------------------------------------- */}
      <label className="md:col-span-4 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Horse</span>
        <select
          name="horse_id"
          required
          defaultValue={last.horse_id ?? ""}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
        >
          <option value="" disabled>Select…</option>
          {horses.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </label>

      {/* Rider — client picker -------------------------------------- */}
      <label className="md:col-span-4 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Rider (client)</span>
        <select
          name="rider_client_id"
          defaultValue={last.rider_client_id ?? ""}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
        >
          <option value="">— or type a name →</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
      </label>

      {/* Rider — freeform fallback ---------------------------------- */}
      <label className="md:col-span-4 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">…or rider name</span>
        <input
          type="text"
          name="rider_name"
          maxLength={80}
          placeholder="e.g. Anna (drop-in)"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
        />
      </label>

      {/* Type ------------------------------------------------------ */}
      <label className="md:col-span-3 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Type</span>
        <select
          name="type"
          required
          defaultValue={last.type ?? "flat"}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
        >
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      {/* Duration -------------------------------------------------- */}
      <label className="md:col-span-2 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Min</span>
        <input
          type="number"
          name="duration_minutes"
          min={1}
          max={600}
          required
          defaultValue={last.duration_minutes ?? "45"}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
        />
      </label>

      {/* Rating (optional) ----------------------------------------- */}
      <label className="md:col-span-2 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Rating</span>
        <select
          name="rating"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
          defaultValue=""
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      {/* When (optional, defaults to now) -------------------------- */}
      <label className="md:col-span-5 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">When (blank = now)</span>
        <input
          type="datetime-local"
          name="started_at"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus"
        />
      </label>

      {/* Notes ----------------------------------------------------- */}
      <label className="md:col-span-12 block">
        <span className="block text-xs font-medium text-ink-700 mb-1">Notes</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Optional — what happened, what to work on next."
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:shadow-focus resize-y"
        />
      </label>

      {/* Submit + status ------------------------------------------- */}
      <div className="md:col-span-12 flex items-center justify-between gap-3 pt-1">
        <div aria-live="polite" className="text-sm">
          {state.error   && <span className="text-rose-700">{state.error}</span>}
          {state.success && <span className="text-emerald-700">Logged. Next?</span>}
        </div>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-60 px-4 py-2 text-sm font-medium text-white shadow-soft focus:outline-none focus:shadow-focus transition-colors"
    >
      {pending ? "Logging…" : "Log session"}
    </button>
  );
}
