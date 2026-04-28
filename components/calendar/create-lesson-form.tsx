"use client";

// Create-lesson modal. Fixed for production UX (2026-04-28):
//   * Modal is scrollable when content exceeds viewport — was getting
//     cut off below "Save" on shorter laptops / phones.
//   * Price auto-fills from the selected client's default_lesson_price
//     (set by owner on the client detail page). Editable per-lesson.
//   * Duration defaults to 45 min — picking Starts auto-fills Ends.
//   * Starts defaults to "now rounded up to next 15 min".
//   * Design system: cream surface, navy headings, orange CTA, soft
//     shadow, 16px radius — matches the post-2026-04-28 refresh.

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createLessonAction,
  type CreateLessonState,
} from "@/app/dashboard/calendar/actions";

const initialState: CreateLessonState = { error: null, success: false };

const DEFAULT_DURATION_MIN = 45;

type ClientOpt  = { id: string; full_name: string; default_lesson_price?: number | null };
type HorseOpt   = { id: string; name: string };
type TrainerOpt = { id: string; full_name: string | null; role: string };

export function CreateLessonPanel({
  clients,
  horses,
  trainers,
}: {
  clients: ClientOpt[];
  horses: HorseOpt[];
  trainers: TrainerOpt[];
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
        {open ? "Close" : "+ Naujas lessons"}
      </button>
      {open && (
        <CreateLessonForm
          clients={clients}
          horses={horses}
          trainers={trainers}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ---------- helpers ---------------------------------------------

/** Local datetime-local string for "now rounded up to next 15 min". */
function nowRoundedLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(local: string, minutes: number): string {
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

// ---------- form ------------------------------------------------

function CreateLessonForm({
  clients,
  horses,
  trainers,
  onClose,
}: {
  clients: ClientOpt[];
  horses: HorseOpt[];
  trainers: TrainerOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useFormState<CreateLessonState, FormData>(
    createLessonAction, initialState,
  );

  // Controlled fields so we can auto-fill defaults intelligently.
  const [clientId, setClientId] = useState("");
  const [horseId, setHorseId]   = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [startsLocal, setStartsLocal] = useState(() => nowRoundedLocal());
  const [endsLocal, setEndsLocal]     = useState(() => addMinutes(nowRoundedLocal(), DEFAULT_DURATION_MIN));
  const [price, setPrice] = useState("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [notes, setNotes] = useState("");

  // When client changes, fill price from their default_lesson_price —
  // unless the user already typed a custom price, then keep it.
  useEffect(() => {
    if (priceManuallyEdited) return;
    const c = clients.find((x) => x.id === clientId);
    if (c?.default_lesson_price != null) {
      setPrice(String(c.default_lesson_price));
    }
  }, [clientId, clients, priceManuallyEdited]);

  // When Starts changes, recompute Ends if user hasn't custom-edited it.
  // We track this implicitly: if the current Ends matches Starts+45, we
  // assume default behavior and re-derive.
  const [endsManuallyEdited, setEndsManuallyEdited] = useState(false);
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Naujas lessons"
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
          <h2 className="text-base font-semibold text-navy-900">Naujas lessons</h2>
          <button
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
          <Select label="Klientas" name="client_id" required value={clientId} onChange={setClientId} options={clients.map((c) => ({ id: c.id, label: c.full_name }))} placeholder="Pasirink…" />
          <Select label="Arklys"   name="horse_id"   required value={horseId}  onChange={setHorseId}  options={horses.map((h) => ({ id: h.id, label: h.name }))} placeholder="Pasirink…" />
          <Select label="Treneris" name="trainer_id" required value={trainerId} onChange={setTrainerId} options={trainers.map((t) => ({ id: t.id, label: `${t.full_name ?? "(no name)"} (${t.role})` }))} placeholder="Pasirink…" />

          <Field
            label="Pradžia"
            type="datetime-local"
            required
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
          <input type="hidden" name="starts_at" value={startsISO} />

          <Field
            label="Pabaiga"
            type="datetime-local"
            required
            value={endsLocal}
            onChange={(e) => { setEndsLocal(e.target.value); setEndsManuallyEdited(true); }}
            hint={!endsManuallyEdited ? `Standartas: pradžia + ${DEFAULT_DURATION_MIN} min` : undefined}
          />
          <input type="hidden" name="ends_at" value={endsISO} />

          <Field
            label="Kaina · €"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => { setPrice(e.target.value); setPriceManuallyEdited(true); }}
            hint={
              !priceManuallyEdited && clientId && clients.find((c) => c.id === clientId)?.default_lesson_price != null
                ? "Iš kliento default"
                : !clientId ? "Pasirink klientą — kaina užsipildys automatiškai" : undefined
            }
          />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Užrašai (nebūtina)</span>
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

          {state.error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}
        </div>

        {/* Sticky footer — always visible. */}
        <div className="px-5 py-3.5 border-t border-ink-100 bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
          >
            Atšaukti
          </button>
          <Submit label="Sukurti lessons" />
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

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Kuriama…" : label}
    </button>
  );
}
