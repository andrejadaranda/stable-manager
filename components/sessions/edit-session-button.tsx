"use client";

// Edit a logged session — type, duration, notes, rating. Wraps the
// already-built updateSessionAction. Lives on the session detail page so
// the owner can fix a mistake without delete-and-relog.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { updateSessionAction, type UpdateSessionState } from "@/app/dashboard/sessions/actions";
import { SESSION_TYPES, SESSION_TYPE_LABEL } from "@/services/sessions.types";

const initial: UpdateSessionState = { error: null, success: false };

export function EditSessionButton({
  session,
}: {
  session: { id: string; type: string; duration_minutes: number; notes: string | null; rating: number | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-10 px-3.5 rounded-xl text-sm font-medium bg-white border border-ink-200 text-ink-800 hover:bg-ink-50 active:bg-ink-100 transition-colors"
      >
        Edit
      </button>
      {open && <EditDialog session={session} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditDialog({
  session,
  onClose,
}: {
  session: { id: string; type: string; duration_minutes: number; notes: string | null; rating: number | null };
  onClose: () => void;
}) {
  const [state, action] = useFormState<UpdateSessionState, FormData>(updateSessionAction, initial);
  const router = useRouter();
  useEffect(() => { if (state.success) { router.refresh(); onClose(); } }, [state.success, onClose, router]);

  return (
    <form
      action={action}
      className="fixed inset-0 z-40 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 p-6 w-full max-w-sm flex flex-col gap-3.5 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Edit session</h2>
          <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-900">✕</button>
        </div>
        <input type="hidden" name="session_id" value={session.id} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Type</span>
          <select name="type" defaultValue={session.type} className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white">
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Duration · min</span>
          <input name="duration_minutes" type="number" min="1" max="600" defaultValue={session.duration_minutes}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Rating (1–5, optional)</span>
          <input name="rating" type="number" min="1" max="5" defaultValue={session.rating ?? ""}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-700 font-medium">Notes</span>
          <textarea name="notes" rows={3} defaultValue={session.notes ?? ""}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm" />
        </label>

        {state.error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{state.error}</p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60">Cancel</button>
          <SaveBtn />
        </div>
      </div>
    </form>
  );
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-10 px-4 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
