"use client";

// Create-lesson modal. Refresh notes (2026-04-28):
//   * Fully localized to English — was a Lithuanian/English mix.
//   * Form is now an exported named export so the calendar grid can open
//     it directly with prefilled date/time when the user clicks an empty
//     slot. CreateLessonPanel still wraps it for the standalone CTA.
//   * Accepts optional `initial` to prefill starts/ends in the user's local
//     zone (already snapped to 15min by the caller).
//   * Modal is scrollable when content exceeds viewport.
//   * Price auto-fills from the selected client's default_lesson_price.
//   * Duration defaults to 45 min — picking Starts auto-fills Ends.
//   * Starts defaults to "now rounded up to next 15 min" (or `initial`).
//   * Design system: cream surface, navy headings, orange CTA, 16px radius.

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createLessonAction,
  type CreateLessonState,
} from "@/app/dashboard/calendar/actions";
import { useFocusTrap } from "@/lib/utils/useFocusTrap";
import type { PackageSummaryRow } from "@/services/packages";
import type { ServiceRow } from "@/services/services";
import { parseIntake } from "@/lib/intake/parse";

const initialState: CreateLessonState = { error: null, success: false };

const DEFAULT_DURATION_MIN = 45;

type ClientOpt  = { id: string; full_name: string; default_lesson_price?: number | null };
type HorseOpt   = { id: string; name: string };
type TrainerOpt = { id: string; full_name: string | null; role: string };

/** Local datetime-local string for "now rounded up to next 15 min". */
function nowRoundedLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return toLocalInput(d);
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(local: string, minutes: number): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  return toLocalInput(d);
}

function toISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// ---------- panel (button + modal) -----------------------------

export function CreateLessonPanel({
  clients,
  horses,
  trainers,
  services = [],
  arenas   = [],
  activePackagesByClient = {},
  label = "+ New lesson",
}: {
  clients: ClientOpt[];
  horses: HorseOpt[];
  trainers: TrainerOpt[];
  services?: ServiceRow[];
  arenas?:   Array<{ id: string; name: string; color: string }>;
  activePackagesByClient?: Record<string, PackageSummaryRow>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          inline-flex items-center justify-center gap-1.5
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
          transition-colors
        "
      >
        {open ? "Close" : label}
      </button>
      {open && (
        <CreateLessonForm
          clients={clients}
          horses={horses}
          trainers={trainers}
          services={services}
          arenas={arenas}
          activePackagesByClient={activePackagesByClient}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------- form (named export for direct use) -----------------

export function CreateLessonForm({
  clients,
  horses,
  trainers,
  services = [],
  arenas   = [],
  activePackagesByClient = {},
  onClose,
  initial,
  prefill,
}: {
  clients: ClientOpt[];
  horses: HorseOpt[];
  trainers: TrainerOpt[];
  /** Active services from the stable's price list. Picking a service
   *  seeds price + suggests duration. Empty array => no service picker
   *  (back-compat with stables that haven't curated a list yet). */
  services?: ServiceRow[];
  /** Active arenas — feeds the arena dropdown. Migration 63. */
  arenas?:   Array<{ id: string; name: string; color: string }>;
  /** Keyed by client_id; one active (non-expired, has remaining) package
   *  per client. Used to render a "Use package" toggle when applicable. */
  activePackagesByClient?: Record<string, PackageSummaryRow>;
  onClose: () => void;
  initial?: { startsLocal?: string; endsLocal?: string };
  /** "Book again" prefill — seed client/horse/service/price from an existing
   *  lesson, leaving the day + time for the owner to pick. */
  prefill?: { clientId?: string; horseId?: string; serviceId?: string; price?: number | null };
}) {
  const [state, formAction] = useFormState<CreateLessonState, FormData>(
    createLessonAction, initialState,
  );

  // Controlled fields so we can auto-fill defaults intelligently.
  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [horseId, setHorseId]   = useState(prefill?.horseId ?? "");
  // Single-trainer stables (e.g. an owner who is the only coach) shouldn't
  // be asked "who will train?" — auto-assign the only trainer and hide the
  // picker. Multi-trainer stables still get the dropdown.
  const soleTrainer = trainers.length === 1 ? trainers[0] : null;
  const [trainerId, setTrainerId] = useState(soleTrainer?.id ?? "");
  const [serviceId, setServiceId] = useState(prefill?.serviceId ?? "");
  // Default to the first active arena (typically "Main arena") so single-
  // arena stables don't need to touch the picker at all.
  const [arenaId,   setArenaId]   = useState(arenas[0]?.id ?? "");
  // Quick-add: trainer can type a new client name + phone right here
  // instead of switching pages. The server creates (or finds-by-phone
  // dedup) and uses that id for the lesson.
  const [addingClient, setAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");

  // ----- Smart intake: paste ONE free-text message → prefill a DRAFT -----
  // Never commits: parses name/phone/date/time and fills the fields below;
  // the owner reviews and hits "Create lesson" as usual.
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeText, setIntakeText] = useState("");
  const [intakeMsg, setIntakeMsg]   = useState<string | null>(null);

  const seedStart = initial?.startsLocal || nowRoundedLocal();
  const seedEnd   = initial?.endsLocal   || addMinutes(seedStart, DEFAULT_DURATION_MIN);
  const [startsLocal, setStartsLocal] = useState(seedStart);
  const [endsLocal, setEndsLocal]     = useState(seedEnd);
  const [price, setPrice] = useState(prefill?.price != null ? String(prefill.price) : "");
  // Treat a prefilled price as user-set so the client-default effect doesn't
  // clobber it. (A prefilled service will still re-seed price on mount.)
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(prefill?.price != null && !prefill?.serviceId);
  const [notes, setNotes] = useState("");
  // Use-package toggle. Defaults to true when an active package exists
  // for the picked client — covering by package is what owners do most
  // of the time. Unchecking falls back to per-lesson billing.
  const [usePackage, setUsePackage] = useState(true);
  // Recurrence — when "Repeat" is on, server expands into N weekly
  // instances starting from `startsLocal`.
  const [repeat, setRepeat] = useState(false);
  const [repeatCount, setRepeatCount] = useState(8);
  const [repeatInterval, setRepeatInterval] = useState(1);

  // ----- Group-lesson state (parent pays; children each with a price) -----
  const [lessonType, setLessonType] = useState<"private" | "group">("private");
  const [payerMode, setPayerMode]   = useState<"existing" | "new">("new");
  const [payerClientId, setPayerClientId] = useState("");
  const [payerName, setPayerName]   = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  type ChildRow = { key: string; mode: "new" | "existing"; existingClientId: string; name: string; price: string };
  const newChildRow = (): ChildRow => ({
    key: Math.random().toString(36).slice(2),
    mode: "new", existingClientId: "", name: "", price: "",
  });
  const [groupChildren, setGroupChildren] = useState<ChildRow[]>([newChildRow()]);
  const groupTotal = groupChildren.reduce((s, c) => s + (Math.max(0, Number(c.price) || 0)), 0);
  const groupChildrenJSON = JSON.stringify(
    groupChildren
      .map((c) => c.mode === "existing"
        ? { existingClientId: c.existingClientId, price: Number(c.price) || 0 }
        : { name: c.name.trim(), price: Number(c.price) || 0 })
      .filter((c) => ("existingClientId" in c ? c.existingClientId : c.name)),
  );
  function updateChild(key: string, patch: Partial<ChildRow>) {
    setGroupChildren((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function removeChild(key: string) {
    setGroupChildren((prev) => prev.filter((c) => c.key !== key));
  }

  // Parse the pasted message and fill the DRAFT fields. Only fills what it
  // finds — never blanks a field the parser didn't detect.
  function applyIntake() {
    const d = parseIntake(intakeText, new Date());
    if (d.name || d.phone) {
      setAddingClient(true);
      if (d.name)  setNewClientName(d.name);
      if (d.phone) setNewClientPhone(d.phone);
    }
    if (d.date || d.time) {
      const date = d.date ?? toLocalInput(new Date()).slice(0, 10);
      const time = d.time ?? "09:00";
      const local = `${date}T${time}`;
      setStartsLocal(local);
      setEndsManuallyEdited(false);
      setEndsLocal(addMinutes(local, DEFAULT_DURATION_MIN));
    }
    if (d.notes) setNotes(d.notes);
    const found = [
      d.name  ? "name"  : null,
      d.phone ? "phone" : null,
      d.date  ? "date"  : null,
      d.time  ? "time"  : null,
    ].filter(Boolean);
    setIntakeMsg(
      found.length
        ? `Filled: ${found.join(", ")}. Review below, then Create lesson.`
        : "Couldn't read a name/date/time — fill the fields manually.",
    );
  }

  const activePackage = clientId ? activePackagesByClient[clientId] ?? null : null;
  const selectedService = serviceId ? services.find((s) => s.id === serviceId) ?? null : null;

  // When client changes, fill price from their default_lesson_price —
  // unless the user already typed a custom price, then keep it.
  useEffect(() => {
    if (priceManuallyEdited) return;
    if (selectedService) return; // service price wins over client default
    const c = clients.find((x) => x.id === clientId);
    if (c?.default_lesson_price != null) {
      setPrice(String(c.default_lesson_price));
    }
  }, [clientId, clients, priceManuallyEdited, selectedService]);

  // When the service changes, snap price to the service's base price
  // and re-derive ends from the service's default duration. The user
  // can still override either field afterwards.
  useEffect(() => {
    if (!selectedService) return;
    // A lesson is ONE session. If the service is a bundle/club
    // (sessions_included > 1) seed the per-lesson price, not the total.
    const perLesson =
      selectedService.sessions_included > 1
        ? Number(selectedService.base_price) / selectedService.sessions_included
        : Number(selectedService.base_price);
    setPrice(String(Number(perLesson.toFixed(2))));
    setPriceManuallyEdited(false);
    if (!endsManuallyEdited && startsLocal) {
      const d = selectedService.default_duration_minutes;
      setEndsLocal(addMinutes(startsLocal, d));
    }
    // Intentionally only re-fire on service change — we don't want
    // typing in startsLocal to keep snapping ends back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id]);

  // When the user toggles "Use package" on, snap price to 0 (the
  // package payment was already logged when the package was created).
  // When they toggle back off, restore the client default.
  useEffect(() => {
    if (!activePackage) return;
    if (usePackage) {
      setPrice("0");
      setPriceManuallyEdited(false);
    }
  }, [usePackage, activePackage]);

  // When Starts changes, recompute Ends if the user hasn't custom-edited it.
  const [endsManuallyEdited, setEndsManuallyEdited] = useState(
    Boolean(initial?.endsLocal && initial?.startsLocal &&
            initial.endsLocal !== addMinutes(initial.startsLocal, DEFAULT_DURATION_MIN)),
  );
  useEffect(() => {
    if (endsManuallyEdited) return;
    setEndsLocal(addMinutes(startsLocal, DEFAULT_DURATION_MIN));
  }, [startsLocal, endsManuallyEdited]);

  const startsISO = toISO(startsLocal);
  const endsISO   = toISO(endsLocal);

  // Auto-close on success.
  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const formRef = useRef<HTMLFormElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Pull keyboard focus into the modal on open so Tab walks the form
  // instead of the page behind it. Returning focus to the trigger is
  // handled by the parent (which re-renders to drop the modal).
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // Wrap Tab/Shift+Tab inside the form so focus can't escape.
  useFocusTrap(formRef);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="New lesson"
    >
      <form
        ref={formRef}
        action={formAction}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-md
          bg-surface rounded-2xl shadow-lift
          flex flex-col
          max-h-[calc(100vh-2rem)]
          overflow-hidden
          my-auto
        "
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-navy-900">New lesson</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-navy-900 p-1 -mr-1 rounded-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5 min-h-0">
          {/* Private vs Group toggle */}
          <div className="flex gap-2">
            {(["private", "group"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLessonType(t)}
                className={`flex-1 h-9 rounded-xl text-[13px] font-medium transition-colors ${
                  lessonType === t
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
                }`}
              >
                {t === "private" ? "Private lesson" : "Group lesson"}
              </button>
            ))}
          </div>
          <input type="hidden" name="lesson_type" value={lessonType} />

          {/* Smart intake — paste a phone/chat message, we draft the lesson.
              Private lessons only (single client). Fills the fields below;
              never auto-creates. */}
          {lessonType === "private" && (
            <div className="rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2.5">
              {!intakeOpen ? (
                <button
                  type="button"
                  onClick={() => setIntakeOpen(true)}
                  className="flex items-center gap-1.5 text-[12.5px] font-medium text-navy-700 hover:text-navy-900"
                >
                  <span aria-hidden>✨</span> Paste a message to fill this in
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[12.5px] font-medium text-navy-900">Smart intake</p>
                    <button
                      type="button"
                      onClick={() => { setIntakeOpen(false); setIntakeText(""); setIntakeMsg(null); }}
                      className="text-[11px] text-ink-500 hover:text-navy-900"
                    >
                      Hide
                    </button>
                  </div>
                  <textarea
                    value={intakeText}
                    onChange={(e) => setIntakeText(e.target.value)}
                    rows={2}
                    placeholder='e.g. "Justė 8 m. be patirties +37061234567 gruodžio 12 15:00"'
                    className="rounded-lg border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={applyIntake}
                      disabled={!intakeText.trim()}
                      className="h-8 px-3 rounded-lg text-[12.5px] font-medium bg-navy-800 text-white hover:bg-navy-900 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Fill from message
                    </button>
                    {intakeMsg && <span className="text-[11px] text-ink-600 leading-snug">{intakeMsg}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GROUP: paying parent + children each with a price */}
          {lessonType === "group" && (
            <>
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[12.5px] font-medium text-navy-900">Paying parent</p>
                  <button
                    type="button"
                    onClick={() => setPayerMode(payerMode === "new" ? "existing" : "new")}
                    className="text-[11px] text-ink-500 hover:text-navy-900"
                  >
                    {payerMode === "new" ? "Pick existing" : "New parent"}
                  </button>
                </div>
                {payerMode === "existing" ? (
                  <>
                    <select
                      value={payerClientId}
                      onChange={(e) => setPayerClientId(e.target.value)}
                      className="rounded-lg border border-ink-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    >
                      <option value="" disabled>Select parent…</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                    <input type="hidden" name="payer_client_id" value={payerClientId} />
                  </>
                ) : (
                  <>
                    <input
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Parent full name"
                      maxLength={120}
                      className="rounded-lg border border-ink-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                    <input
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="Parent phone (optional)"
                      inputMode="tel"
                      maxLength={40}
                      className="rounded-lg border border-ink-200 bg-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                    />
                    <input type="hidden" name="payer_name" value={payerName} />
                    <input type="hidden" name="payer_phone" value={payerPhone} />
                  </>
                )}
                <p className="text-[11px] text-ink-600">The parent gets one bill covering all their children below.</p>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Children</p>
                {groupChildren.map((c) => (
                  <div key={c.key} className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {c.mode === "existing" ? (
                        <select
                          value={c.existingClientId}
                          onChange={(e) => updateChild(c.key, { existingClientId: e.target.value })}
                          className="flex-1 min-w-0 rounded-lg border border-ink-200 bg-white text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                        >
                          <option value="" disabled>Select child…</option>
                          {clients.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}
                        </select>
                      ) : (
                        <input
                          value={c.name}
                          onChange={(e) => updateChild(c.key, { name: e.target.value })}
                          placeholder="Child name"
                          maxLength={120}
                          className="flex-1 min-w-0 rounded-lg border border-ink-200 bg-white text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                        />
                      )}
                      <input
                        type="number" min="0" step="0.01"
                        value={c.price}
                        onChange={(e) => updateChild(c.key, { price: e.target.value })}
                        placeholder="€"
                        className="w-20 shrink-0 rounded-lg border border-ink-200 bg-white text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                      {groupChildren.length > 1 && (
                        <button type="button" onClick={() => removeChild(c.key)} className="shrink-0 text-ink-400 hover:text-rose-600 px-1" aria-label="Remove child">✕</button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateChild(c.key, { mode: c.mode === "new" ? "existing" : "new" })}
                      className="self-start text-[11px] text-brand-700 hover:text-brand-800"
                    >
                      {c.mode === "new" ? "Pick existing child" : "New child"}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setGroupChildren((p) => [...p, newChildRow()])}
                  className="self-start text-[12px] font-medium text-brand-700 hover:text-brand-800"
                >
                  + Add child
                </button>
                <p className="text-[12px] text-ink-600">
                  Total (parent pays): <span className="font-semibold text-navy-900">€{groupTotal.toFixed(2)}</span>
                </p>
                <input type="hidden" name="group_children" value={groupChildrenJSON} />
              </div>
            </>
          )}

          {/* Existing-client picker. Required UNLESS the quick-add form
              below is open — server handles either path. */}
          {lessonType === "private" && !addingClient && (
            <Select
              label="Client"
              name="client_id"
              required
              value={clientId}
              onChange={setClientId}
              options={clients.map((c) => ({ id: c.id, label: c.full_name }))}
              placeholder="Select…"
            />
          )}

          {/* Quick-add: walked-in rider, phone call, no time to switch
              pages. Type name + phone, server creates the client (or
              finds existing by phone) and uses that id for the lesson. */}
          {lessonType === "private" && addingClient && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-navy-900">New client</p>
                <button
                  type="button"
                  onClick={() => {
                    setAddingClient(false);
                    setNewClientName("");
                    setNewClientPhone("");
                  }}
                  className="text-[11px] text-ink-500 hover:text-navy-900"
                >
                  Pick existing instead
                </button>
              </div>
              <input
                name="new_client_name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                required
                maxLength={120}
                placeholder="Full name"
                className="
                  rounded-lg border border-ink-200 bg-white text-sm text-ink-900
                  placeholder:text-ink-400 px-3 py-2
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                "
              />
              <input
                name="new_client_phone"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                maxLength={40}
                placeholder="Phone (optional — add it later)"
                inputMode="tel"
                className="
                  rounded-lg border border-ink-200 bg-white text-sm text-ink-900
                  placeholder:text-ink-400 px-3 py-2
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                "
              />
              <p className="text-[11px] text-ink-600">
                Only a name is required — phone, email and skill level can be
                filled in later from the client profile. If you do add a phone,
                typing the same number reuses the existing client.
              </p>
            </div>
          )}

          {lessonType === "private" && !addingClient && (
            <button
              type="button"
              onClick={() => setAddingClient(true)}
              className="self-start text-[12px] font-medium text-brand-700 hover:text-brand-800 -mt-2"
            >
              + Add new client
            </button>
          )}
          {lessonType === "private" && (
            <Select label="Horse (optional)" name="horse_id" value={horseId} onChange={setHorseId} options={horses.map((h) => ({ id: h.id, label: h.name }))} placeholder="No horse yet — assign later" />
          )}
          {soleTrainer ? (
            // Only one trainer in the stable — no choice to make. Assign them
            // silently and skip the picker entirely.
            <input type="hidden" name="trainer_id" value={trainerId} />
          ) : (
            <Select label="Trainer" name="trainer_id" value={trainerId} onChange={setTrainerId} options={trainers.map((t) => ({ id: t.id, label: `${t.full_name ?? "(no name)"} (${t.role})` }))} placeholder="No trainer yet — assign later" />
          )}

          {lessonType === "private" && services.length > 0 && (
            <Select
              label="Service (optional)"
              name="service_id"
              value={serviceId}
              onChange={setServiceId}
              options={services.map((s) => ({
                id: s.id,
                label:
                  s.sessions_included > 1
                    ? `${s.name} · ${s.default_duration_minutes} min · €${(Number(s.base_price) / s.sessions_included).toFixed(2)}/lesson (${s.sessions_included}× = €${Number(s.base_price).toFixed(2)})`
                    : `${s.name} · ${s.default_duration_minutes} min · €${Number(s.base_price).toFixed(2)}`,
              }))}
              placeholder="Pick from price list…"
            />
          )}
          {lessonType === "private" && services.length > 0 && (
            <p className="text-[11px] text-ink-500 -mt-1.5">
              Picking a service fills in the price and length below.
            </p>
          )}

          {/* Arena picker only when the stable actually has more than one.
              Single-arena stables just submit that arena silently. */}
          {arenas.length > 1 ? (
            <Select
              label="Arena"
              name="arena_id"
              value={arenaId}
              onChange={setArenaId}
              options={arenas.map((a) => ({ id: a.id, label: a.name }))}
              placeholder="No arena set"
            />
          ) : (
            <input type="hidden" name="arena_id" value={arenaId} />
          )}

          {/* Use-package toggle — only renders when the picked client
              has an active (non-expired, remaining > 0) package. */}
          {lessonType === "private" && activePackage && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePackage}
                  onChange={(e) => setUsePackage(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">
                    Use package
                  </p>
                  <p className="text-[11.5px] text-ink-600 mt-0.5">
                    {activePackage.lessons_remaining} of {activePackage.total_lessons} lessons left
                    {activePackage.expires_at
                      ? ` · expires ${new Date(activePackage.expires_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              </label>
              {usePackage && <input type="hidden" name="package_id" value={activePackage.id} />}
            </div>
          )}

          <Field
            label="Starts"
            type="datetime-local"
            step={900 /* 15 min */}
            required
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
          <input type="hidden" name="starts_at" value={startsISO} />

          <Field
            label="Ends"
            type="datetime-local"
            step={900}
            required
            value={endsLocal}
            onChange={(e) => { setEndsLocal(e.target.value); setEndsManuallyEdited(true); }}
            hint={!endsManuallyEdited ? `Default: starts + ${DEFAULT_DURATION_MIN} min` : undefined}
          />
          <input type="hidden" name="ends_at" value={endsISO} />

          {lessonType === "private" && (
            <Field
              label="Price · €"
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setPriceManuallyEdited(true); }}
              hint={
                activePackage && usePackage
                  ? "Covered by package — €0 by default. Override if you're billing extra."
                  : !priceManuallyEdited && clientId && clients.find((c) => c.id === clientId)?.default_lesson_price != null
                  ? "Pulled from client default"
                  : !clientId ? "Pick a client — price will fill in automatically" : undefined
              }
            />
          )}

          {/* Repeat panel — expands into a weekly series. Private lessons only. */}
          {lessonType === "private" && (
            <>
              <RepeatPanel
                on={repeat}
                onToggle={setRepeat}
                count={repeatCount}
                setCount={setRepeatCount}
                interval={repeatInterval}
                setInterval={setRepeatInterval}
                startsLocal={startsLocal}
              />
              {repeat && (
                <>
                  <input type="hidden" name="repeat_count" value={String(repeatCount)} />
                  <input type="hidden" name="repeat_interval_weeks" value={String(repeatInterval)} />
                </>
              )}
            </>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Notes (optional)</span>
            <textarea
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                placeholder:text-ink-400 px-3 py-2.5 leading-relaxed
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>

          {/* aria-live="polite" so SR users hear validation errors when
              they appear, without interrupting whatever they were typing.
              role="alert" gives the message higher priority than the
              implicit live region from a status update. */}
          <p
            id="create-lesson-error"
            role="alert"
            aria-live="polite"
            className={
              state.error
                ? "text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
                : "sr-only"
            }
          >
            {state.error || ""}
          </p>

          {/* Recurring summary — shown after a series finishes if any
              instances were skipped, so the user knows what to fix. */}
          {state.summary && state.summary.skipped > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 leading-relaxed">
              <p className="font-semibold">
                Created {state.summary.created} of {state.summary.created + state.summary.skipped}.
              </p>
              <p className="mt-0.5">
                {state.summary.skipped} skipped — usually because of an
                existing booking or the horse&apos;s welfare cap.
              </p>
            </div>
          )}

          {/* Welfare override — appears only when the server rejected
              the booking for hitting the horse's daily/weekly cap. The
              trainer types a reason and re-submits; the reason is saved
              on the lesson row for audit. */}
          {state.error?.toLowerCase().includes("limit") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
              <p className="text-[12.5px] font-medium text-amber-900">
                Welfare override
              </p>
              <p className="text-[11.5px] text-amber-800 leading-relaxed">
                Booking despite the cap requires a reason. The horse&apos;s
                workload audit will reflect this entry.
              </p>
              <textarea
                name="over_limit_reason"
                rows={2}
                required
                maxLength={500}
                placeholder="e.g. Show prep — agreed with the owner to add today's session."
                className="
                  rounded-xl border border-amber-300 bg-white text-sm text-ink-900
                  placeholder:text-ink-400 px-3 py-2
                  focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                "
              />
            </div>
          )}
        </div>

        {/* Sticky footer — always visible. */}
        <div className="px-5 py-3.5 border-t border-ink-100 bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
          >
            Cancel
          </button>
          <Submit label="Create lesson" />
        </div>
      </form>
    </div>
  );
}

// ---------- primitives ------------------------------------------

type SelectOption = { id: string; label: string };

function Select({
  label,
  name,
  required,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      <select
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          rounded-xl border border-ink-200 bg-white text-sm text-ink-900
          px-3 py-2.5
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
      >
        <option value="" disabled>{placeholder ?? "Select…"}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Field(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string },
) {
  const { label, hint, ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      <input
        className="
          rounded-xl border border-ink-200 bg-white text-sm text-ink-900
          placeholder:text-ink-400 px-3 py-2.5
          focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
        "
        {...rest}
      />
      {hint && <span className="text-[11px] text-ink-500 mt-0.5">{hint}</span>}
    </label>
  );
}

// =============================================================
// Repeat panel — turns a single booking into a weekly series.
// =============================================================
function RepeatPanel({
  on,
  onToggle,
  count,
  setCount,
  interval,
  setInterval,
  startsLocal,
}: {
  on: boolean;
  onToggle: (v: boolean) => void;
  count: number;
  setCount: (n: number) => void;
  interval: number;
  setInterval: (n: number) => void;
  startsLocal: string;
}) {
  // Compute the last booking's date so the user sees what they're
  // committing to before submitting.
  let lastLabel: string | null = null;
  if (on && startsLocal) {
    const start = new Date(startsLocal);
    if (!Number.isNaN(start.getTime()) && count > 1) {
      const last = new Date(start);
      last.setDate(last.getDate() + (count - 1) * interval * 7);
      lastLabel = last.toLocaleDateString(undefined, {
        weekday: "short",
        month:   "short",
        day:     "numeric",
        year:    "numeric",
      });
    }
  }

  return (
    <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy-900">Repeat weekly</p>
          <p className="text-[11.5px] text-ink-600 mt-0.5">
            Books the same slot on this weekday for N weeks. Conflicts skip
            individually so you don&apos;t lose the rest of the series.
          </p>
        </div>
      </label>

      {on && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[11.5px] text-ink-600">How many lessons</span>
            <input
              type="number"
              min={2}
              max={52}
              value={count}
              onChange={(e) => setCount(Math.max(2, Math.min(52, Number(e.target.value) || 2)))}
              className="
                rounded-lg border border-ink-200 bg-white text-sm text-ink-900
                px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[11.5px] text-ink-600">Every N weeks</span>
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value) || 1)}
              className="
                rounded-lg border border-ink-200 bg-white text-sm text-ink-900
                px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            >
              <option value={1}>Every week</option>
              <option value={2}>Every 2 weeks</option>
              <option value={3}>Every 3 weeks</option>
              <option value={4}>Every 4 weeks</option>
            </select>
          </label>
          {lastLabel && (
            <p className="col-span-2 text-[11.5px] text-ink-500">
              Last lesson: <span className="font-medium text-navy-900">{lastLabel}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-describedby="create-lesson-error"
      className="
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Creating…" : label}
    </button>
  );
}
