"use client";

// Participants panel for the edit-lesson dialog.
//
// Renders the rider × horse pairs already attached to a lesson, lets
// the owner/employee add another rider+horse (subject to capacity),
// remove an existing rider, and adjust capacity.
//
// Foundation lives in services/lessons.ts (Sprint 5 #1) — this panel
// just exposes those functions as UI without rewriting the rest of
// the edit dialog. Wires server actions defined in
// app/dashboard/calendar/participants-actions.ts.

import { useEffect, useState, useTransition } from "react";
import {
  addParticipantAction,
  removeParticipantAction,
  setCapacityAction,
  setParticipantPriceAction,
  loadParticipants,
  promoteWaitlistAction,
} from "@/app/dashboard/calendar/participants-actions";

type Participant = {
  client_id: string;
  horse_id:  string | null;
  status:    string;
  no_show:   boolean;
  joined_at: string;
  price:     number | null;
  clients:   { id: string; full_name: string } | null;
  horses:    { id: string; name: string }      | null;
};

export function LessonParticipantsPanel({
  lessonId,
  maxParticipants: initialMax,
  clientOptions,
  horseOptions,
}: {
  lessonId: string;
  maxParticipants: number;
  clientOptions: Array<{ id: string; full_name: string }>;
  horseOptions:  Array<{ id: string; name: string }>;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [capacity,     setCapacity]     = useState(initialMax);
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [pending,      startTransition] = useTransition();

  const refresh = async () => {
    const rows = await loadParticipants(lessonId);
    setParticipants(rows as unknown as Participant[]);
  };

  useEffect(() => {
    if (!lessonId) return;
    refresh().catch(() => { /* table may be empty pre-mirror */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const filled = participants.filter((p) => p.status === "confirmed").length;
  // Capacity isn't exposed anymore — a group just grows as riders are added.
  const hasRoom = true;
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");

  // Riders / horses not yet in this lesson — picker source.
  const usedClientIds = new Set(participants.map((p) => p.client_id));
  const availableClients = clientOptions.filter((c) => !usedClientIds.has(c.id));
  // We don't block horses already in the lesson — same horse in the
  // same slot is rare but the trigger will catch overlap with other
  // lessons; in-slot dup would be unusual and server returns
  // CLIENT_ALREADY_IN_LESSON which the user sees as a clear error.

  async function handleAdd(formData: FormData) {
    setError(null);
    formData.set("lesson_id", lessonId);
    const result = await addParticipantAction({ error: null, success: false }, formData);
    if (result.error) {
      setError(result.error);
    } else {
      setPickerOpen(false);
      await refresh();
    }
  }

  async function handleRemove(clientId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("client_id", clientId);
    const result = await removeParticipantAction({ error: null, success: false }, fd);
    if (result.error) setError(result.error);
    else              await refresh();
  }

  async function handleCapacity(newCap: number) {
    setError(null);
    setCapacity(newCap); // optimistic
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("max_participants", String(newCap));
    const result = await setCapacityAction({ error: null, success: false }, fd);
    if (result.error) setError(result.error);
  }

  async function handleSetPrice(clientId: string, value: string) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) return;
    setError(null);
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("client_id", clientId);
    fd.set("price", String(price));
    const result = await setParticipantPriceAction({ error: null, success: false }, fd);
    if (result.error) setError(result.error);
    else              await refresh();
  }

  async function handlePromote(clientId: string) {
    setError(null);
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("client_id", clientId);
    const result = await promoteWaitlistAction({ error: null, success: false }, fd);
    if (result.error) setError(result.error);
    else              await refresh();
  }

  const confirmed = participants.filter((p) => p.status === "confirmed");
  const waitlist  = participants.filter((p) => p.status === "waitlist");

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-[13px] font-semibold text-navy-900">Riders &amp; horses</h4>
          <p className="text-[11px] text-ink-500 mt-0.5">
            {filled} {filled === 1 ? "rider" : "riders"}
            {filled > 1 && <span className="text-brand-700 font-medium ml-1">· Group lesson</span>}
          </p>
        </div>
      </header>

      {error && (
        <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-ink-100/80">
        {confirmed.length === 0 && (
          <li className="py-2 text-[12px] text-ink-500">No riders yet.</li>
        )}
        {confirmed.map((p) => (
          <li key={p.client_id} className="py-2 flex items-center justify-between gap-2">
            <div className="text-[13px] text-ink-900 min-w-0">
              <span className="font-medium">{p.clients?.full_name ?? "Unknown rider"}</span>
              <span className="text-ink-500"> on </span>
              <span className="font-medium">{p.horses?.name ?? "no horse yet"}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5 text-[12px] text-ink-500">
                €
                <input
                  type="number" min="0" step="0.01"
                  defaultValue={p.price ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== String(p.price ?? "")) {
                      startTransition(() => handleSetPrice(p.client_id, e.target.value));
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                  placeholder="—"
                  aria-label={`Price for ${p.clients?.full_name ?? "rider"}`}
                  className="w-16 h-7 rounded-md border border-ink-200 bg-white text-[12px] px-1.5 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </div>
              <button
                type="button"
                onClick={() => startTransition(() => handleRemove(p.client_id))}
                disabled={pending}
                className="h-7 px-2 text-[11px] text-ink-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Waitlist section — only visible when at least one waitlisted */}
      {waitlist.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-[0.12em] text-amber-800 font-semibold mb-1">
            Waitlist · {waitlist.length}
          </p>
          <ul className="flex flex-col divide-y divide-amber-100/80">
            {waitlist.map((p) => (
              <li key={p.client_id} className="py-1.5 flex items-center justify-between gap-2">
                <div className="text-[13px] text-amber-900">
                  <span className="font-medium">{p.clients?.full_name ?? "Unknown rider"}</span>
                  <span className="text-amber-700"> on </span>
                  <span className="font-medium">{p.horses?.name ?? "Unknown horse"}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => startTransition(() => handlePromote(p.client_id))}
                    disabled={pending || !hasRoom}
                    title={!hasRoom ? "Raise capacity or remove someone first" : "Promote to confirmed"}
                    className="h-7 px-2 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-40"
                  >
                    Promote
                  </button>
                  <button
                    type="button"
                    onClick={() => startTransition(() => handleRemove(p.client_id))}
                    disabled={pending}
                    className="h-7 px-2 text-[11px] text-ink-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!pickerOpen && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={`h-9 self-start px-3 rounded-xl text-[12px] font-medium transition-colors ${
            hasRoom
              ? "bg-brand-50 text-brand-800 hover:bg-brand-100"
              : "bg-amber-50 text-amber-900 hover:bg-amber-100"
          }`}
        >
          {hasRoom ? "+ Add another rider" : "+ Add to waitlist"}
        </button>
      )}

      {pickerOpen && (
        <form
          action={(fd) => startTransition(() => { handleAdd(fd); })}
          className="flex flex-col gap-2 rounded-lg p-3 bg-ink-50/40"
        >
          {/* Existing rider vs. brand-new child */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAddMode("existing")}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                addMode === "existing" ? "bg-brand-600 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
              }`}
            >
              Existing
            </button>
            <button
              type="button"
              onClick={() => setAddMode("new")}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                addMode === "new" ? "bg-brand-600 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
              }`}
            >
              New child
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {addMode === "existing" ? (
              <label className="flex flex-col gap-1 text-[11px] text-ink-600">
                Rider
                <select
                  name="client_id"
                  className="h-8 rounded-md border border-ink-200 bg-white text-[12px] px-1.5"
                >
                  <option value="">Pick a rider…</option>
                  {availableClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-[11px] text-ink-600">
                Child name
                <input
                  name="new_child_name"
                  placeholder="Full name"
                  maxLength={120}
                  className="h-8 rounded-md border border-ink-200 bg-white text-[12px] px-1.5"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-[11px] text-ink-600">
              Horse <span className="text-ink-400">(optional)</span>
              <select
                name="horse_id"
                className="h-8 rounded-md border border-ink-200 bg-white text-[12px] px-1.5"
              >
                <option value="">No horse yet</option>
                {horseOptions.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-[11px] text-ink-600 max-w-[160px]">
            Price · €
            <input
              name="price"
              type="number" min="0" step="0.01"
              placeholder="€"
              className="h-8 rounded-md border border-ink-200 bg-white text-[12px] px-1.5 tabular-nums"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setPickerOpen(false); setError(null); }}
              className="h-8 px-3 text-[12px] text-ink-600 hover:bg-ink-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-8 px-3 text-[12px] font-medium bg-brand-600 text-white hover:bg-brand-700 rounded-md disabled:opacity-50"
            >
              {pending ? "Adding…" : addMode === "new" ? "Add child" : "Add rider"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
