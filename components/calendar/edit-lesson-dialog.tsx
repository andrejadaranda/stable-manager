"use client";

// Edit-lesson modal. Refresh notes (2026-04-28):
//   * Matches the create-lesson form: cream surface, navy heading, orange
//     primary CTA, sticky footer, scrollable body, 16px radius inputs.
//   * Fully English copy.
//   * 15-min step on datetime-local inputs.

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateLessonAction,
  cancelLessonAction,
  markLessonPaidAction,
  markLessonUnpaidAction,
  type UpdateLessonState,
} from "@/app/dashboard/calendar/actions";
import { useFocusTrap } from "@/lib/utils/useFocusTrap";

const updateLessonInitialState: UpdateLessonState = { error: null, success: false };
import type { CalendarLesson } from "@/services/lessons";
import type { PackageSummaryRow } from "@/services/packages";
import type { ServiceRow } from "@/services/services";
import { fmtTime } from "@/lib/utils/dates";

type Status = CalendarLesson["status"];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show",   label: "No-show" },
];

export function EditLessonDialog({
  lesson,
  services = [],
  activePackage,
  onClose,
}: {
  lesson: CalendarLesson;
  /** Stable's active services. Used to render a swap-service select. */
  services?: ServiceRow[];
  /** Active package for this lesson's client — used to offer "Use package"
   *  on a lesson that isn't currently package-covered. Null if none. */
  activePackage?: PackageSummaryRow | null;
  onClose: () => void;
}) {
  const [editState,   editAction]   = useFormState<UpdateLessonState, FormData>(
    updateLessonAction,   updateLessonInitialState,
  );
  const [cancelState, cancelAction] = useFormState<UpdateLessonState, FormData>(
    cancelLessonAction,   updateLessonInitialState,
  );
  const [paidState,   paidAction]   = useFormState<UpdateLessonState, FormData>(
    markLessonPaidAction, updateLessonInitialState,
  );
  const [unpaidState, unpaidAction] = useFormState<UpdateLessonState, FormData>(
    markLessonUnpaidAction, updateLessonInitialState,
  );

  const [status,      setStatus]      = useState<Status>(lesson.status);
  const [startsLocal, setStartsLocal] = useState<string>(toLocalInput(lesson.starts_at));
  const [endsLocal,   setEndsLocal]   = useState<string>(toLocalInput(lesson.ends_at));
  const [serviceId,   setServiceId]   = useState<string>(lesson.service_id ?? "");

  // Use-package toggle. Initial state matches the lesson's current state
  // (package_id non-null = currently using a package).
  const initiallyOnPackage = Boolean(lesson.package_id);
  const [usePackage, setUsePackage] = useState(initiallyOnPackage);
  // The package id sent to the server: empty string = leave unchanged,
  // "__none__" = detach, otherwise the package id.
  const packageIdValue =
    usePackage === initiallyOnPackage
      ? ""
      : usePackage
      ? activePackage?.id ?? ""
      : "__none__";

  const startsISO = toISO(startsLocal);
  const endsISO   = toISO(endsLocal);

  useEffect(() => {
    if (
      editState.success || cancelState.success ||
      paidState.success || unpaidState.success
    ) onClose();
  }, [editState.success, cancelState.success, paidState.success, unpaidState.success, onClose]);

  // Body scroll lock while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Pull keyboard focus into the modal on open + trap Tab/Shift+Tab
  // inside the panel so it can't escape to the page below.
  const closeBtnRef  = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);
  useFocusTrap(containerRef);

  const error = editState.error || cancelState.error || paidState.error || unpaidState.error;
  const isPaid = lesson.payment_status === "paid";
  const isPackage = lesson.payment_status === "package";
  const isPartial = lesson.payment_status === "partial";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit lesson"
    >
      <div
        ref={containerRef}
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
        <div className="px-5 py-4 border-b border-ink-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Edit lesson</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {lesson.client?.full_name ?? "—"} · {lesson.horse?.name ?? "—"} ·{" "}
              {lesson.trainer?.full_name ?? "—"}
            </p>
            <p className="text-xs text-ink-500 tabular-nums">
              {fmtTime(lesson.starts_at)}–{fmtTime(lesson.ends_at)}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-navy-900 p-1 -mr-1 rounded-lg shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <form action={editAction} id="edit-lesson-form" className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5 min-h-0">
          <input type="hidden" name="lesson_id" value={lesson.id} />
          {/* service_id encoding: same as packageIdValue — empty string
              leaves it unchanged, "__none__" detaches, otherwise the id. */}
          <input
            type="hidden"
            name="service_id"
            value={
              serviceId === (lesson.service_id ?? "") ? "" :
              serviceId === "" ? "__none__" :
              serviceId
            }
          />
          {packageIdValue && <input type="hidden" name="package_id" value={packageIdValue} />}

          {/* Payment / package status panel ------------------- */}
          <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-500 font-semibold">
                Payment
              </p>
              <p className={`text-sm font-medium mt-0.5 ${
                isPackage  ? "text-brand-700" :
                isPaid     ? "text-emerald-700" :
                isPartial  ? "text-amber-700" :
                            "text-ink-700"
              }`}>
                {isPackage  ? "Covered by package"
                 : isPaid    ? `Paid · €${Number(lesson.price).toFixed(2)}`
                 : isPartial ? `Partial · €${lesson.paid_amount.toFixed(2)} of €${Number(lesson.price).toFixed(2)}`
                 :             `Unpaid · €${Number(lesson.price).toFixed(2)}`}
              </p>
            </div>
            {!isPackage && (
              <PaidQuickActions
                lessonId={lesson.id}
                isPaid={isPaid || isPartial}
                priceIsZero={Number(lesson.price) <= 0}
                paidAction={paidAction}
                unpaidAction={unpaidAction}
              />
            )}
          </div>

          {/* Use-package toggle — only when the lesson is not already
              on a package and the client has an active one. */}
          {!initiallyOnPackage && activePackage && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePackage}
                  onChange={(e) => setUsePackage(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">Move to package</p>
                  <p className="text-[11.5px] text-ink-600 mt-0.5">
                    {activePackage.lessons_remaining} of {activePackage.total_lessons} lessons left
                    {activePackage.expires_at
                      ? ` · expires ${new Date(activePackage.expires_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Detach toggle — when the lesson IS on a package, allow
              moving it back to per-lesson billing. */}
          {initiallyOnPackage && (
            <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!usePackage}
                  onChange={(e) => setUsePackage(!e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">Detach from package</p>
                  <p className="text-[11.5px] text-ink-600 mt-0.5">
                    Bills this lesson separately. Refunds the package slot.
                  </p>
                </div>
              </label>
            </div>
          )}

          {services.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Service</span>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="
                  rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                  px-3 py-2.5
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                "
              >
                <option value="">— No service —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.default_duration_minutes} min · €{Number(s.base_price).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Status</span>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                px-3 py-2.5
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Starts</span>
            <input
              type="datetime-local"
              step={900}
              required
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                px-3 py-2.5
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>
          <input type="hidden" name="starts_at" value={startsISO} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Ends</span>
            <input
              type="datetime-local"
              step={900}
              required
              value={endsLocal}
              onChange={(e) => setEndsLocal(e.target.value)}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                px-3 py-2.5
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>
          <input type="hidden" name="ends_at" value={endsISO} />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Price · €</span>
            <input
              type="number"
              name="price"
              min="0"
              step="0.01"
              defaultValue={Number(lesson.price).toFixed(2)}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                px-3 py-2.5
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Notes</span>
            <textarea
              name="notes"
              rows={2}
              defaultValue={lesson.notes ?? ""}
              className="
                rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                placeholder:text-ink-400 px-3 py-2.5 leading-relaxed
                focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
              "
            />
          </label>

          <p
            id="edit-lesson-error"
            role="alert"
            aria-live="polite"
            className={
              error
                ? "text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
                : "sr-only"
            }
          >
            {error || ""}
          </p>

          {/* Welfare override prompt — only shows when the server flagged
              that the move would push the horse over its cap. */}
          {error?.toLowerCase().includes("limit") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex flex-col gap-2">
              <p className="text-[12.5px] font-medium text-amber-900">
                Welfare override
              </p>
              <p className="text-[11.5px] text-amber-800 leading-relaxed">
                Moving despite the cap requires a reason — saved on the
                lesson for audit.
              </p>
              <textarea
                name="over_limit_reason"
                rows={2}
                required
                maxLength={500}
                placeholder="e.g. Show prep, owner approved the extra session."
                className="
                  rounded-xl border border-amber-300 bg-white text-sm text-ink-900
                  placeholder:text-ink-400 px-3 py-2
                  focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                "
              />
            </div>
          )}

          {/* If the lesson is already an override (welfare reason set),
              show it inline so the editor knows. Read-only. */}
          {lesson.over_limit_reason && !error?.toLowerCase().includes("limit") && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900 leading-relaxed">
              <span className="font-semibold">Welfare override on file:</span>{" "}
              {lesson.over_limit_reason}
            </div>
          )}

          {/* Quick-cancel rendered inside the scroll area so it stays
              accessible on small phones. Submitting it is a separate
              form via formAction below — kept below the field stack. */}
          <div className="mt-1 pt-3 border-t border-ink-100 flex items-center justify-between gap-2">
            <span className="text-xs text-ink-500">Quick action</span>
            <CancelButton
              disabled={lesson.status === "cancelled"}
              formAction={cancelAction}
              lessonId={lesson.id}
            />
          </div>
        </form>

        {/* Sticky footer — always visible. */}
        <div className="px-5 py-3.5 border-t border-ink-100 bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60"
          >
            Cancel
          </button>
          <SaveButton />
        </div>
      </div>
    </div>
  );
}

// Tiny side panel: "Mark paid" / "Mark unpaid" quick actions.
// Each is its own <form> so the action stays distinct from the main
// edit form's save action.
function PaidQuickActions({
  lessonId,
  isPaid,
  priceIsZero,
  paidAction,
  unpaidAction,
}: {
  lessonId: string;
  isPaid: boolean;
  priceIsZero: boolean;
  paidAction: (formData: FormData) => void;
  unpaidAction: (formData: FormData) => void;
}) {
  if (priceIsZero) return null;

  if (isPaid) {
    return (
      <form action={unpaidAction}>
        <input type="hidden" name="lesson_id" value={lessonId} />
        <UnpaidSubmit />
      </form>
    );
  }
  return (
    <form action={paidAction}>
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="method"    value="cash"    />
      <PaidSubmit />
    </form>
  );
}

function PaidSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap
        bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Marking…" : "Mark paid"}
    </button>
  );
}

function UnpaidSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="
        h-10 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap
        border border-ink-200 bg-white text-ink-700 hover:bg-ink-100/60
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Reverting…" : "Mark unpaid"}
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      form="edit-lesson-form"
      disabled={pending}
      aria-describedby="edit-lesson-error"
      className="
        h-10 px-5 rounded-xl text-sm font-medium
        bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

// Quick-cancel button. We render an inline mini-form so it has its own
// action distinct from the edit form's action.
function CancelButton({
  disabled,
  formAction,
  lessonId,
}: {
  disabled?: boolean;
  formAction: (formData: FormData) => void;
  lessonId: string;
}) {
  return (
    <form action={formAction}>
      <input type="hidden" name="lesson_id" value={lessonId} />
      <CancelSubmit disabled={disabled} />
    </form>
  );
}

function CancelSubmit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="
        h-10 px-3.5 rounded-xl text-xs font-medium
        border border-rose-200 bg-white text-rose-700
        hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Cancelling…" : "Mark cancelled"}
    </button>
  );
}

// ---------- date helpers ----------
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
