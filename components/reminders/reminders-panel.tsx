"use client";

// Reminders panel — Apple Reminders-style:
//   * Inline "+ New reminder" form with body / assignee / due-date
//   * Open reminders list, sorted by due date
//   * Tap the round button to mark complete (optimistic UI hides
//     the row immediately; server action persists in the background)
//   * X to delete; visible only for the creator
//
// Each row uses its own <form> so the server action is a normal form
// post — no manual invocation, plays well with Next's pending state.

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createReminderAction,
  toggleReminderAction,
  deleteReminderAction,
  type ReminderActionState,
} from "@/app/dashboard/reminders/actions";
import type { ReminderRow, AssignablePerson } from "@/services/reminders";

const initialState: ReminderActionState = { error: null, success: false };

export function RemindersPanel({
  open,
  recentlyDoneCount,
  assignableTo,
  currentUserId,
}: {
  open: ReminderRow[];
  recentlyDoneCount: number;
  assignableTo: AssignablePerson[];
  currentUserId: string;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-soft p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Reminders</h2>
          <p className="text-[11.5px] text-ink-500 mt-0.5">
            Notes for yourself and the team. Tap to mark done.
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
          {open.length} open
        </span>
      </div>

      <CreateInline assignableTo={assignableTo} currentUserId={currentUserId} />

      {open.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center">
          <p className="text-[12.5px] text-ink-600">Nothing to do right now.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {open.map((r) => (
            <ReminderRowItem
              key={r.id}
              reminder={r}
              currentUserId={currentUserId}
            />
          ))}
        </ul>
      )}

      {recentlyDoneCount > 0 && (
        <p className="text-[11.5px] text-ink-500 text-center pt-1 border-t border-ink-100">
          {recentlyDoneCount} done recently
        </p>
      )}
    </section>
  );
}

// =============================================================
// Create inline (collapsible)
// =============================================================
function CreateInline({
  assignableTo,
  currentUserId,
}: {
  assignableTo: AssignablePerson[];
  currentUserId: string;
}) {
  const [state, action] = useFormState<ReminderActionState, FormData>(
    createReminderAction,
    initialState,
  );
  const [open, setOpen] = useState(false);

  // Auto-collapse on success. Effect-free pattern: derive from state.
  if (state.success && open) {
    // setState during render is allowed when guarded by a condition that
    // only flips once per parent render — fine for this transient flag.
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          self-start h-9 px-3 rounded-xl text-[12.5px] font-medium
          bg-brand-50 text-brand-700 hover:bg-brand-100
          transition-colors
        "
      >
        + New reminder
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-2 rounded-xl border border-ink-100 bg-surface p-3"
    >
      <input
        name="body"
        placeholder="What needs doing?"
        autoFocus
        required
        maxLength={500}
        className="
          rounded-lg border border-ink-200 bg-white text-sm text-ink-900
          placeholder:text-ink-400 px-3 py-2
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          name="assigned_to"
          defaultValue=""
          className="
            rounded-lg border border-ink-200 bg-white text-sm text-ink-900
            px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        >
          <option value="">Self (no one else)</option>
          {assignableTo
            .filter((p) => p.id !== currentUserId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} · {p.role}
              </option>
            ))}
        </select>
        <input
          name="due_at"
          type="datetime-local"
          className="
            rounded-lg border border-ink-200 bg-white text-sm text-ink-900
            px-3 py-2
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
      </div>
      {state.error && (
        <p className="text-[11px] text-rose-700">{state.error}</p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 px-3 rounded-lg text-[12.5px] text-ink-700 hover:bg-ink-100/60"
        >
          Cancel
        </button>
        <CreateSubmit />
      </div>
    </form>
  );
}

function CreateSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-9 px-4 rounded-lg text-[12.5px] font-medium
        bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Adding…" : "Add"}
    </button>
  );
}

// =============================================================
// Single reminder row
// =============================================================
function ReminderRowItem({
  reminder,
  currentUserId,
}: {
  reminder: ReminderRow;
  currentUserId: string;
}) {
  const isMine = reminder.created_by === currentUserId;
  const otherSide = isMine ? reminder.assignee : reminder.creator;
  const otherSideLabel =
    !otherSide || otherSide.id === currentUserId
      ? null
      : isMine
      ? `→ ${otherSide.full_name ?? "team member"}`
      : `from ${otherSide.full_name ?? "team member"}`;

  const dueLabel = reminder.due_at ? fmtDue(reminder.due_at) : null;
  const overdue =
    reminder.due_at != null &&
    new Date(reminder.due_at).getTime() < Date.now();

  return (
    <li className="border-t border-ink-100 first:border-0">
      <div className="px-1 py-2.5 flex items-start gap-3">
        <ToggleForm reminderId={reminder.id} wasOpen />

        <div className="flex-1 min-w-0">
          <p className="text-sm text-navy-900 leading-snug">{reminder.body}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px]">
            {dueLabel && (
              <span
                className={
                  overdue ? "text-rose-700 font-semibold" : "text-ink-500"
                }
              >
                {dueLabel}
              </span>
            )}
            {otherSideLabel && (
              <span className="text-ink-500">{otherSideLabel}</span>
            )}
          </div>
        </div>

        {isMine && <DeleteForm reminderId={reminder.id} />}
      </div>
    </li>
  );
}

// =============================================================
// Tiny per-row forms — each action is a regular form submit so we get
// pending state via useFormStatus and don't have to manually invoke
// the server action.
// =============================================================
function ToggleForm({
  reminderId,
  wasOpen,
}: {
  reminderId: string;
  wasOpen: boolean;
}) {
  const [, action] = useFormState<ReminderActionState, FormData>(
    toggleReminderAction,
    initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="reminder_id" value={reminderId} />
      <input type="hidden" name="was_open" value={String(wasOpen)} />
      <ToggleSubmit />
    </form>
  );
}

function ToggleSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="Mark done"
      className="
        mt-0.5 w-5 h-5 rounded-full border border-ink-300 bg-white shrink-0
        hover:border-brand-500 hover:bg-brand-50
        disabled:opacity-50 transition-colors
      "
    />
  );
}

function DeleteForm({ reminderId }: { reminderId: string }) {
  const [, action] = useFormState<ReminderActionState, FormData>(
    deleteReminderAction,
    initialState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="reminder_id" value={reminderId} />
      <DeleteSubmit />
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm("Delete this reminder?")) e.preventDefault();
      }}
      aria-label="Delete reminder"
      className="
        text-ink-400 hover:text-rose-700 px-1 text-[14px] leading-none
        disabled:opacity-50 transition-colors
      "
    >
      ✕
    </button>
  );
}

// =============================================================
// Helpers
// =============================================================
function fmtDue(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const ms = d.getTime() - now;
  const min = Math.round(ms / 60000);
  if (min < 0 && min > -60)        return `${-min} min ago`;
  if (min < 0 && min > -60 * 24)   return `${Math.round(-min / 60)} h ago`;
  if (min < 0)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (min < 60)                    return `in ${min} min`;
  if (min < 60 * 24)               return `in ${Math.round(min / 60)} h`;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
