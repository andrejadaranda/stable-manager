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
import Link from "next/link";
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
  clients:   {
    id: string;
    full_name: string;
    guardian_client_id: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
  } | null;
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
  // Controlled add-form fields. NOTE: this panel is rendered INSIDE the
  // edit-lesson <form>, so the add row must NOT be its own nested <form>
  // (nested forms are invalid HTML — the submit button silently does
  // nothing). We build FormData by hand and call the action on click.
  const [addClientId,   setAddClientId]   = useState("");
  const [addChildName,  setAddChildName]  = useState("");
  const [addHorseId,    setAddHorseId]    = useState("");
  const [addParentName, setAddParentName] = useState("");
  const [addParentPhone,setAddParentPhone]= useState("");
  const [addPrice,      setAddPrice]      = useState("");

  function resetAddForm() {
    setAddClientId(""); setAddChildName(""); setAddHorseId("");
    setAddParentName(""); setAddParentPhone(""); setAddPrice("");
  }

  // Enter inside an add-rider field must NOT bubble up to submit the outer
  // edit-lesson form (which would save + close the whole lesson). Trap it
  // and run the add instead.
  function onAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      startTransition(() => { submitAdd(); });
    }
  }

  async function submitAdd() {
    setError(null);
    if (addMode === "existing" && !addClientId) { setError("Pick a rider."); return; }
    if (addMode === "new" && !addChildName.trim()) { setError("Enter the child's name."); return; }
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    if (addMode === "existing") fd.set("client_id", addClientId);
    else fd.set("new_child_name", addChildName.trim());
    if (addHorseId) fd.set("horse_id", addHorseId);
    if (addParentName.trim())  fd.set("parent_name", addParentName.trim());
    if (addParentPhone.trim()) fd.set("parent_phone", addParentPhone.trim());
    if (addPrice) fd.set("price", addPrice);
    const result = await addParticipantAction({ error: null, success: false }, fd);
    if (result.error) { setError(result.error); return; }
    resetAddForm();
    setPickerOpen(false);
    await refresh();
  }

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

  // Group confirmed riders by their parent (guardian) so the same parent's
  // children sit together. Solo riders (no guardian) fall into their own
  // unlabelled group and render flat.
  type Grp = { key: string; label: string | null; members: Participant[] };
  const groups: Grp[] = [];
  const byKey = new Map<string, Grp>();
  for (const p of confirmed) {
    const g = p.clients;
    const linked = g?.guardian_client_id ?? null;
    const nameKey = (g?.guardian_name || g?.guardian_phone)
      ? `n:${(g?.guardian_name ?? "").trim().toLowerCase()}|${(g?.guardian_phone ?? "").replace(/\s+/g, "")}`
      : null;
    // Group by the ENTERED parent name/phone FIRST — two children typed with
    // different mums must always split, even if an older row still carries a
    // stale guardian_client_id pointing at the lesson payer. Only fall back to
    // the linked parent id when no name/phone was captured.
    const key = nameKey ?? (linked ? `c:${linked}` : `solo:${p.client_id}`);
    const label = nameKey || linked
      ? (g?.guardian_name?.trim() || g?.guardian_phone?.trim() || "Parent")
      : null;
    let grp = byKey.get(key);
    if (!grp) { grp = { key, label, members: [] }; byKey.set(key, grp); groups.push(grp); }
    grp.members.push(p);
  }

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

      <div className="flex flex-col gap-1">
        {confirmed.length === 0 && (
          <p className="py-2 text-[12px] text-ink-500">No riders yet.</p>
        )}
        {groups.map((grp) => (
          <div key={grp.key} className={grp.label ? "rounded-lg bg-brand-50/30 px-2 py-0.5" : ""}>
            {grp.label && (
              <p className="text-[11px] font-semibold text-brand-800 px-1 pt-1 pb-0.5">
                👪 {grp.label}
                {grp.members.length > 1 && <span className="font-normal text-brand-700"> · {grp.members.length} children</span>}
              </p>
            )}
            <ul className="flex flex-col divide-y divide-ink-100/70">
              {grp.members.map((p) => (
                <li key={p.client_id} className="py-2 flex items-center justify-between gap-2">
                  <div className="text-[13px] text-ink-900 min-w-0">
                    {/* Name links into the client profile — where the
                        parent's name/phone live for a child rider. */}
                    <Link
                      href={`/dashboard/clients/${p.client_id}`}
                      className="font-medium text-brand-800 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500"
                    >
                      {p.clients?.full_name ?? "Unknown rider"}
                    </Link>
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
          </div>
        ))}
      </div>

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
        <div className="flex flex-col gap-2 rounded-lg p-3 bg-ink-50/40">
          {/* Existing rider vs. brand-new child. NOT a <form> — this panel
              already lives inside the edit-lesson form; a nested form's submit
              silently no-ops. We call the action on click instead. */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setAddMode("existing"); setError(null); }}
              className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
                addMode === "existing" ? "bg-brand-600 text-white" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
              }`}
            >
              Existing
            </button>
            <button
              type="button"
              onClick={() => { setAddMode("new"); setError(null); }}
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
                  value={addClientId}
                  onChange={(e) => setAddClientId(e.target.value)}
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
                  value={addChildName}
                  onChange={(e) => setAddChildName(e.target.value)}
                  onKeyDown={onAddKeyDown}
                  placeholder="Full name"
                  maxLength={120}
                  className="h-8 rounded-md border border-ink-200 bg-white text-[16px] px-1.5"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-[11px] text-ink-600">
              Horse <span className="text-ink-400">(optional)</span>
              <select
                value={addHorseId}
                onChange={(e) => setAddHorseId(e.target.value)}
                className="h-8 rounded-md border border-ink-200 bg-white text-[12px] px-1.5"
              >
                <option value="">No horse yet</option>
                {horseOptions.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
          </div>

          {addMode === "new" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-ink-600">
                Parent name <span className="text-ink-400">(optional)</span>
                <input
                  value={addParentName}
                  onChange={(e) => setAddParentName(e.target.value)}
                  onKeyDown={onAddKeyDown}
                  placeholder="Parent full name"
                  maxLength={120}
                  className="h-8 rounded-md border border-ink-200 bg-white text-[16px] px-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-ink-600">
                Parent phone <span className="text-ink-400">(optional)</span>
                <input
                  value={addParentPhone}
                  onChange={(e) => setAddParentPhone(e.target.value)}
                  onKeyDown={onAddKeyDown}
                  inputMode="tel"
                  placeholder="+370…"
                  maxLength={40}
                  className="h-8 rounded-md border border-ink-200 bg-white text-[16px] px-1.5"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-[11px] text-ink-600 max-w-[160px]">
            Price · €
            <input
              value={addPrice}
              onChange={(e) => setAddPrice(e.target.value)}
              onKeyDown={onAddKeyDown}
              type="number" min="0" step="0.01"
              placeholder="€"
              className="h-8 rounded-md border border-ink-200 bg-white text-[16px] px-1.5 tabular-nums"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setPickerOpen(false); setError(null); resetAddForm(); }}
              className="h-8 px-3 text-[12px] text-ink-600 hover:bg-ink-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => { submitAdd(); })}
              disabled={pending}
              className="h-8 px-3 text-[12px] font-medium bg-brand-600 text-white hover:bg-brand-700 rounded-md disabled:opacity-50"
            >
              {pending ? "Adding…" : addMode === "new" ? "Add child" : "Add rider"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
