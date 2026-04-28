"use client";

// Inline notes editor for a single session row. Click → expand textarea,
// Save (or Cmd/Ctrl+Enter) → persist via updateSessionAction → optimistic
// UI. Esc cancels.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSessionAction } from "@/app/dashboard/sessions/actions";
import { SESSION_TYPES, type SessionType } from "@/services/sessions";

export function SessionNoteEditor({
  sessionId,
  initialNotes,
  currentType,
}: {
  sessionId: string;
  initialNotes: string | null;
  currentType: SessionType;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (notes.trim() === (savedNotes ?? "").trim()) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("session_id", sessionId);
      fd.set("notes", notes.trim());
      // updateSessionAction requires type, so pass the current type so we
      // don't accidentally rewrite it. Other fields (duration, rating)
      // are left blank → action treats them as "don't touch".
      fd.set("type", currentType);
      const result = await updateSessionAction(
        { error: null, success: false },
        fd,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedNotes(notes.trim());
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setNotes(savedNotes);
    setEditing(false);
    setError(null);
  }

  if (!editing) {
    return (
      <div className="mt-2">
        {savedNotes ? (
          <p
            onClick={() => setEditing(true)}
            className="text-[12.5px] text-ink-700 leading-relaxed line-clamp-2 cursor-text hover:bg-ink-50/40 -mx-1 px-1 rounded"
          >
            {savedNotes}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11.5px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
          >
            <span aria-hidden>＋</span> add note
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") cancel();
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        autoFocus
        rows={2}
        maxLength={2000}
        placeholder="Trainer note…"
        className="w-full rounded-lg border border-ink-200 bg-white text-[13px] text-ink-900 placeholder:text-ink-400 px-2.5 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600"
      />
      {error && <p className="text-[11px] text-rose-600 mt-1">{error}</p>}
      <div className="flex items-center justify-end gap-2 mt-1.5">
        <button
          type="button"
          onClick={cancel}
          className="text-[11.5px] text-ink-500 hover:text-ink-900 px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="text-[11.5px] text-white bg-brand-600 hover:bg-brand-700 px-2.5 py-1 rounded-md disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
