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
  activePackagesByClient = {},
  label = "+ New lesson",
}: {
  clients: ClientOpt[];
  horses: HorseOpt[];
  trainers: TrainerOpt[];
  services?: ServiceRow[];
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
  activePackagesByClient = {},
  onClose,
  initial,
}: {
  clients: ClientOpt[];
  horses: HorseOpt[];
  trainers: TrainerOpt[];
  /** Active services from the stable's price list. Picking a service
   *  seeds price + suggests duration. Empty array => no service picker
   *  (back-compat with stables that haven't curated a list yet). */
  services?: ServiceRow[];
  /** Keyed by client_id; one active (non-expired, has remaining) package
   *  per client. Used to render a "Use package" toggle when applicable. */
  activePackagesByClient?: Record<string, PackageSummaryRow>;
  onClose: () => void;
  initial?: { startsLocal?: string; endsLocal?: string };
}) {
  const [state, formAction] = useFormState<CreateLessonState, FormData>(
    createLessonAction, initialState,
  );

  // Controlled fields so we can auto-fill defaults intelligently.
  const [clientId, setClientId] = useState("");
  const [horseId, setHorseId]   = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const seedStart = initial?.startsLocal || nowRoundedLocal();
  const seedEnd   = initial?.endsLocal   || addMinutes(seedStart, DEFAULT_DURATION_MIN);
  const [startsLocal, setStartsLocal] = useState(seedStart);
  const [endsLocal, setEndsLocal]     = useState(seedEnd);
  const [price, setPrice] = useState("");
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
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
    setPrice(String(selectedService.base_price));
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
          <Select label="Client" name="client_id" required value={clientId} onChange={setClientId} options={clients.map((c) => ({ id: c.id, label: c.full_name }))} placeholder="Select…" />
          <Select label="Horse"   name="horse_id"   required value={horseId}  onChange={setHorseId}  options={horses.map((h) => ({ id: h.id, label: h.name }))} placeholder="Select…" />
          <Select label="Trainer" name="trainer_id" required value={trainerId} onChange={setTrainerId} options={trainers.map((t) => ({ id: t.id, label: `${t.full_name ?? "(no name)"} (${t.role})` }))} placeholder="Select…" />

          {services.length > 0 && (
            <Select
              label="Service (optional)"
              name="service_id"
              value={serviceId}
              onChange={setServiceId}
              options={services.map((s) => ({
                id: s.id,
                label: `${s.name} · ${s.default_duration_minutes} min · €${Number(s.base_price).toFixed(2)}`,
              }))}
              placeholder="Pick from price list…"
            />
          )}

          {/* Use-package toggle — only renders when the picked client
              has an active (non-expired, remaining > 0) package. */}
          {activePackage && (
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

          {/* Repeat panel — expands into a weekly series. */}
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
            <span className="text-[11.5px] text-ink-600">Total occurrences</span>
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
