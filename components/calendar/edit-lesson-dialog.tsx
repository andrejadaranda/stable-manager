"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateLessonAction,
  cancelLessonAction,
  type UpdateLessonState,
} from "@/app/dashboard/calendar/actions";

const updateLessonInitialState: UpdateLessonState = { error: null, success: false };
import type { CalendarLesson } from "@/services/lessons";
import { fmtTime } from "@/lib/utils/dates";

type Status = CalendarLesson["status"];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show",   label: "No show" },
];

export function EditLessonDialog({
  lesson,
  onClose,
}: {
  lesson: CalendarLesson;
  onClose: () => void;
}) {
  const [editState, editAction]   = useFormState<UpdateLessonState, FormData>(
    updateLessonAction,
    updateLessonInitialState,
  );
  const [cancelState, cancelAction] = useFormState<UpdateLessonState, FormData>(
    cancelLessonAction,
    updateLessonInitialState,
  );

  const [startsLocal, setStartsLocal] = useState<string>(toLocalInput(lesson.starts_at));
  const [endsLocal,   setEndsLocal]   = useState<string>(toLocalInput(lesson.ends_at));
  const startsISO = toISO(startsLocal);
  const endsISO   = toISO(endsLocal);

  useEffect(() => {
    if (editState.success || cancelState.success) onClose();
  }, [editState.success, cancelState.success, onClose]);

  const error = editState.error || cancelState.error;

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md flex flex-col">
        <div className="flex items-start justify-between p-6 pb-3">
          <div>
            <h2 className="text-lg font-semibold">Edit lesson</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {lesson.client?.full_name ?? "—"} · {lesson.horse?.name ?? "—"} ·{" "}
              {lesson.trainer?.full_name ?? "—"}
            </p>
            <p className="text-xs text-neutral-500">
              {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>

        <form action={editAction} className="flex flex-col gap-3.5 px-6 pb-2">
          <input type="hidden" name="lesson_id" value={lesson.id} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Status</span>
            <select
              name="status"
              defaultValue={lesson.status}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Starts</span>
            <input
              type="datetime-local"
              required
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <input type="hidden" name="starts_at" value={startsISO} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Ends</span>
            <input
              type="datetime-local"
              required
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <input type="hidden" name="ends_at" value={endsISO} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Price</span>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              defaultValue={Number(lesson.price).toFixed(2)}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-700 font-medium">Notes</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={lesson.notes ?? ""}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
            />
          </label>

          <SaveButton />
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
        </form>

        {/* Quick-cancel as a separate form so it doesn't carry the rest of the inputs */}
        <div className="border-t border-neutral-200 mt-4 px-6 py-3 flex items-center justify-between bg-neutral-50">
          <span className="text-xs text-neutral-500">
            Or quickly mark this lesson as
          </span>
          <form action={cancelAction}>
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <CancelButton disabled={lesson.status === "cancelled"} />
          </form>
        </div>
      </div>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-neutral-900 text-white py-2.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

function CancelButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md border border-red-300 bg-white text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Cancelling…" : "Cancel lesson"}
    </button>
  );
}

// ---------- date helpers ----------
function toLocalInput(iso: string): string {
  // datetime-local expects "YYYY-MM-DDTHH:mm" in the user's local zone
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
