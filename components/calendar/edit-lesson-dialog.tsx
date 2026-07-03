"use client";

// Edit-lesson modal. Refresh notes (2026-04-28):
//   * Matches the create-lesson form: cream surface, navy heading, orange
//     primary CTA, sticky footer, scrollable body, 16px radius inputs.
//   * Fully English copy.
//   * 15-min step on datetime-local inputs.

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  updateLessonAction,
  cancelLessonAction,
  deleteLessonAction,
  duplicateLessonAction,
  markLessonPaidAction,
  markLessonUnpaidAction,
  fetchLessonChangesAction,
  sellPackageForLessonAction,
  type UpdateLessonState,
} from "@/app/dashboard/calendar/actions";
import type { LessonChange } from "@/services/lessons";
import { useFocusTrap } from "@/lib/utils/useFocusTrap";

const updateLessonInitialState: UpdateLessonState = { error: null, success: false };
import type { CalendarLesson } from "@/services/lessons";
import type { PackageSummaryRow } from "@/services/packages";
import type { ServiceRow } from "@/services/services";
import { fmtTime } from "@/lib/utils/dates";
import { LessonParticipantsPanel } from "./lesson-participants-panel";

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
  clients = [],
  horses = [],
  arenas = [],
  onClose,
}: {
  lesson: CalendarLesson;
  /** Stable's active services. Used to render a swap-service select. */
  services?: ServiceRow[];
  /** Active package for this lesson's client — used to offer "Use package"
   *  on a lesson that isn't currently package-covered. Null if none. */
  activePackage?: PackageSummaryRow | null;
  /** Roster for the group-lesson participants panel — "+ Add another rider". */
  clients?: Array<{ id: string; full_name: string }>;
  /** Active, lesson-eligible horses for the participants panel. */
  horses?:  Array<{ id: string; name: string }>;
  /** Active arenas — feeds the arena dropdown. Migration 63. */
  arenas?:  Array<{ id: string; name: string; color: string }>;
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
  const [deleteState, deleteAction] = useFormState<UpdateLessonState, FormData>(
    deleteLessonAction, updateLessonInitialState,
  );
  const [bookAgainState, bookAgainAction] = useFormState<UpdateLessonState, FormData>(
    duplicateLessonAction, updateLessonInitialState,
  );
  const [sellPkgState, sellPkgAction] = useFormState<UpdateLessonState, FormData>(
    sellPackageForLessonAction, updateLessonInitialState,
  );

  // Close once a just-sold package has covered the lesson.
  useEffect(() => {
    if (sellPkgState.success) onClose();
  }, [sellPkgState.success, onClose]);

  // Close the dialog once a delete succeeds (the row is gone).
  useEffect(() => {
    if (deleteState.success) onClose();
  }, [deleteState.success, onClose]);

  // Change history — load on open, refresh after an edit/cancel.
  const [changes, setChanges] = useState<LessonChange[]>([]);
  useEffect(() => {
    let active = true;
    fetchLessonChangesAction(lesson.id).then((c) => { if (active) setChanges(c); });
    return () => { active = false; };
  }, [lesson.id, editState.success, cancelState.success]);

  const [status,      setStatus]      = useState<Status>(lesson.status);
  const [startsLocal, setStartsLocal] = useState<string>(toLocalInput(lesson.starts_at));
  const [endsLocal,   setEndsLocal]   = useState<string>(toLocalInput(lesson.ends_at));
  const [serviceId,   setServiceId]   = useState<string>(lesson.service_id ?? "");
  const [arenaId,     setArenaId]     = useState<string>((lesson as CalendarLesson & { arena_id?: string | null }).arena_id ?? "");

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

  // When the lesson will be covered by a package after save, per-lesson
  // Service and Price are irrelevant (the package covers it) — hide them
  // to keep the dialog clean. Reactive: toggling Move/Detach re-shows them.
  const coveredByPackage = usePackage;

  // "2 of 4" — which lesson of the subscription this is (from getCalendar).
  const pkgPos   = (lesson as CalendarLesson & { package_position?: number | null }).package_position ?? null;
  const pkgTotal = (lesson as CalendarLesson & { package_total?: number | null }).package_total ?? null;

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
              {lesson.client?.id ? (
                <Link
                  href={`/dashboard/clients/${lesson.client.id}`}
                  onClick={onClose}
                  className="text-brand-700 font-medium hover:text-brand-800 hover:underline"
                  title="Atidaryti kliento profilį"
                >
                  {lesson.client.full_name ?? "—"} ↗
                </Link>
              ) : (
                lesson.client?.full_name ?? "—"
              )}
              {" · "}{lesson.horse?.name ?? "—"} · {lesson.trainer?.full_name ?? "—"}
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
          {/* arena_id — same encoding pattern */}
          <input
            type="hidden"
            name="arena_id"
            value={
              arenaId === ((lesson as CalendarLesson & { arena_id?: string | null }).arena_id ?? "") ? "" :
              arenaId === "" ? "__none__" :
              arenaId
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
                {isPackage  ? `Covered by package${pkgPos && pkgTotal ? ` · lesson ${pkgPos} of ${pkgTotal}` : ""}`
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

          {/* Billing & packages — tucked behind a disclosure so the
              everyday fields (time, status, price, notes) lead. Opens
              itself only when there's actually a package action to take.
              A closed <details> keeps its inputs in the DOM, so the
              Move/Detach checkbox still submits — logic unchanged. */}
          {(initiallyOnPackage || activePackage || lesson.client?.id) && (
            <details className="rounded-xl border border-ink-100 bg-white group" open={initiallyOnPackage}>
              <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500 hover:text-ink-800 select-none">
                <span className="transition-transform group-open:rotate-90 text-ink-400">›</span>
                Billing &amp; packages
              </summary>
              <div className="px-3 pb-3 pt-0.5 flex flex-col gap-2.5">

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

                {/* No active package yet — let the owner sell one on the spot and
                    cover this lesson with it (client decided to take a subscription
                    mid-edit). */}
                {!initiallyOnPackage && !activePackage && lesson.client?.id && (
                  <SellPackageInline
                    lessonId={lesson.id}
                    clientId={lesson.client.id}
                    packageServices={services.filter((s) => (s.sessions_included ?? 1) > 1)}
                    sellAction={sellPkgAction}
                    error={sellPkgState.error}
                  />
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
              </div>
            </details>
          )}

          {!coveredByPackage && services.length > 0 && (
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

          {arenas.length > 0 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Arena</span>
              <select
                value={arenaId}
                onChange={(e) => setArenaId(e.target.value)}
                className="
                  rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                  px-3 py-2.5
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                "
              >
                <option value="">— TBD arena —</option>
                {arenas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
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

          {/* Starts + Ends — side by side to save vertical space. */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm min-w-0">
              <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Starts</span>
              <input
                type="datetime-local"
                step={900}
                required
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
                className="
                  w-full rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                  px-3 py-2.5
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                "
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm min-w-0">
              <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">Ends</span>
              <input
                type="datetime-local"
                step={900}
                required
                value={endsLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
                className="
                  w-full rounded-xl border border-ink-200 bg-white text-sm text-ink-900
                  px-3 py-2.5
                  focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
                "
              />
            </label>
          </div>
          <input type="hidden" name="starts_at" value={startsISO} />
          <input type="hidden" name="ends_at" value={endsISO} />

          {/* Price — hidden entirely when a package covers the lesson (the
              subscription pays for it). Keep the value submitting via a
              hidden input so a Save doesn't wipe the stored price. */}
          {coveredByPackage ? (
            <input type="hidden" name="price" value={Number(lesson.price).toFixed(2)} />
          ) : (
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
          )}

          {/* Group lesson participants — multi-rider picker. Always
              rendered: solo lessons show as 1/1, owner can raise capacity
              to turn this into a group. */}
          <LessonParticipantsPanel
            lessonId={lesson.id}
            maxParticipants={(lesson as CalendarLesson & { max_participants?: number }).max_participants ?? 1}
            clientOptions={clients}
            horseOptions={horses}
          />

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
          {changes.length > 0 && (
            <div className="mt-1 pt-3 border-t border-ink-100">
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-500 font-semibold mb-1.5">Change history</p>
              <ul className="flex flex-col gap-1">
                {changes.map((c) => (
                  <li key={c.id} className="text-[12px] text-ink-700 flex items-baseline gap-2">
                    <span className="text-ink-400 shrink-0 tabular-nums">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    <span>{c.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-1 pt-3 border-t border-ink-100 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-ink-500">Quick action</span>
            <div className="flex items-center gap-2">
              <BookAgainButton formAction={bookAgainAction} lessonId={lesson.id} />
              <DeleteLessonButton formAction={deleteAction} lessonId={lesson.id} />
              <CancelButton
                disabled={lesson.status === "cancelled"}
                formAction={cancelAction}
                lessonId={lesson.id}
              />
            </div>
          </div>
          {(deleteState.error || bookAgainState.error) && (
            <p className="mt-2 text-[12px] text-rose-700">{deleteState.error || bookAgainState.error}</p>
          )}
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
//
// BUGFIX 2026-05-22: this component is rendered INSIDE the parent
// <form id="edit-lesson-form"> (line 164). HTML forbids nested <form>
// elements; browsers silently drop the inner form, so submit clicks
// on the inner buttons would bubble to the outer form (or do nothing).
// User-visible symptom: "Mark paid" did nothing on mobile (and desktop).
//
// Fix: drop the inner <form> entirely. Use plain <button type="button">
// that programmatically builds FormData and dispatches the server-action
// reducer via useTransition. This works correctly while sitting inside
// the parent form because no nested <form> element is emitted.
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
  const [pending, startTransition] = useTransition();
  if (priceIsZero) return null;

  function handleMarkPaid() {
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("method",    "cash");
    startTransition(() => paidAction(fd));
  }

  function handleMarkUnpaid() {
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    startTransition(() => unpaidAction(fd));
  }

  if (isPaid) {
    return (
      <button
        type="button"
        onClick={handleMarkUnpaid}
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
  return (
    <button
      type="button"
      onClick={handleMarkPaid}
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

// "Book again" — clones this lesson to the same time next week and jumps
// there. Same nested-form rule: no inner <form>.
function BookAgainButton({
  formAction,
  lessonId,
}: {
  formAction: (formData: FormData) => void;
  lessonId: string;
}) {
  const [pending, startTransition] = useTransition();
  function handle() {
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    startTransition(() => formAction(fd));
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      className="
        h-10 px-3.5 rounded-xl text-xs font-medium
        text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-50
        transition-colors
      "
    >
      {pending ? "Booking…" : "Book again"}
    </button>
  );
}

// Delete (destructive) — permanently removes the lesson. Confirm first.
// Same nested-form rule as CancelButton: no inner <form>.
function DeleteLessonButton({
  formAction,
  lessonId,
}: {
  formAction: (formData: FormData) => void;
  lessonId: string;
}) {
  const [pending, startTransition] = useTransition();
  function handleDelete() {
    if (!window.confirm("Delete this lesson permanently? This can't be undone. (To keep the record, use Mark cancelled instead.)")) return;
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    startTransition(() => formAction(fd));
  }
  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="
        h-10 px-3.5 rounded-xl text-xs font-medium
        text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      "
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}

// Quick-cancel button. Like PaidQuickActions, this sits INSIDE the parent
// <form id="edit-lesson-form">, so it must NOT render a nested <form>
// (HTML forbids it — browsers silently drop the inner form and the click
// does nothing; that was the "Mark cancelled does nothing" bug). Instead
// use a plain button that builds FormData and dispatches the action.
function CancelButton({
  disabled,
  formAction,
  lessonId,
}: {
  disabled?: boolean;
  formAction: (formData: FormData) => void;
  lessonId: string;
}) {
  const [pending, startTransition] = useTransition();
  function handleCancel() {
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    startTransition(() => formAction(fd));
  }
  return (
    <button
      type="button"
      onClick={handleCancel}
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

// Inline "sell a package" — shown in the edit dialog when the lesson's
// client has no active package. Lets the owner create the subscription and
// cover this lesson in one go. Plain button (no nested <form>) per the
// nested-form rule that bit Mark-paid/Cancel earlier.
function SellPackageInline({
  lessonId,
  clientId,
  packageServices,
  sellAction,
  error,
}: {
  lessonId: string;
  clientId: string;
  /** Services from the price list that represent subscriptions
   *  (sessions_included > 1). Picking one prefills lessons + price. */
  packageServices: ServiceRow[];
  sellAction: (fd: FormData) => void;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [lessons, setLessons] = useState("10");
  const [price, setPrice] = useState("");
  const [payStatus, setPayStatus] = useState<"none" | "full" | "partial">("none");
  const [method, setMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [pending, startTransition] = useTransition();

  // Picking a subscription from the price list fills in the count + price
  // (still editable — the owner can override either).
  function pickService(id: string) {
    setServiceId(id);
    const s = packageServices.find((x) => x.id === id);
    if (s) {
      setLessons(String(s.sessions_included));
      setPrice(String(Number(s.base_price)));
    }
  }

  function submit() {
    const fd = new FormData();
    fd.set("lesson_id", lessonId);
    fd.set("client_id", clientId);
    fd.set("total_lessons", lessons);
    fd.set("price", price);
    fd.set("pay_status", payStatus);
    fd.set("method", method);
    if (payStatus === "partial") fd.set("paid_amount", paidAmount);
    startTransition(() => sellAction(fd));
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[12.5px] font-medium text-brand-700 hover:text-brand-800"
      >
        + Client is taking a subscription — create &amp; assign
      </button>
    );
  }

  const fieldCls =
    "rounded-lg border border-ink-200 bg-white text-sm text-ink-900 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-3 py-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-navy-900">New subscription</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-ink-500 hover:text-navy-900">
          Cancel
        </button>
      </div>

      {packageServices.length > 0 && (
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Pick from price list <span className="text-ink-400">(optional)</span>
          <select value={serviceId} onChange={(e) => pickService(e.target.value)} className={fieldCls}>
            <option value="">— Choose a subscription —</option>
            {packageServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.sessions_included}× · €{Number(s.base_price).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Lessons
          <input type="number" min={1} value={lessons} onChange={(e) => setLessons(e.target.value)} className={fieldCls} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-600">
          Price · €
          <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className={fieldCls} />
        </label>
      </div>
      {/* Payment — owner chooses; nothing is auto-marked paid. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-ink-600">Payment</span>
        <div className="flex gap-1.5">
          {([["none", "Not paid"], ["full", "Paid"], ["partial", "Partial"]] as const).map(([val, lbl]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPayStatus(val)}
              className={`flex-1 h-8 rounded-lg text-[12.5px] font-medium border transition-colors ${
                payStatus === val
                  ? "border-brand-500 bg-brand-100 text-brand-800"
                  : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        {payStatus !== "none" && (
          <div className="grid grid-cols-2 gap-2.5 mt-0.5">
            <label className="flex flex-col gap-1 text-[12px] text-ink-600">
              Method
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldCls}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
            {payStatus === "partial" && (
              <label className="flex flex-col gap-1 text-[12px] text-ink-600">
                Amount paid · €
                <input type="number" min={0} step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" className={fieldCls} />
              </label>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-ink-600 leading-snug">
        Creates the subscription and covers this lesson — its price becomes €0. The payment is logged only as you choose above.
      </p>
      {error && <p className="text-[11.5px] text-rose-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="h-9 px-3.5 rounded-lg text-[13px] font-medium bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed self-start transition-colors"
      >
        {pending ? "Creating…" : "Create & assign"}
      </button>
    </div>
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
