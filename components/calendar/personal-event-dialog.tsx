"use client";

// Create / edit / view a personal calendar event.
//
// Three modes, one component:
//   * create  — blank form seeded from a clicked slot (or now).
//   * edit    — a Longrein-origin personal event; full form + delete.
//   * view    — a Google-imported event (source='google'); read-only
//               detail card with a link back to Google Calendar.
//
// Times are entered as wall-clock local (Vilnius for this user); the
// server action converts to ISO. Keeps the create-lesson modal's look.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPersonalEventAction,
  updatePersonalEventAction,
  deletePersonalEventAction,
} from "@/app/dashboard/calendar/personal-event-actions";
import { EVENT_TYPE_META, eventHex, isOvernight, type CalendarPersonalEvent, type PersonalEventType } from "@/services/calendarEvents.pure";
import { fmtTime } from "@/lib/utils/dates";

const TYPES = Object.keys(EVENT_TYPE_META) as PersonalEventType[];

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addMinutes(local: string, min: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setMinutes(d.getMinutes() + min);
  return toLocalInput(d);
}

export function PersonalEventDialog({
  onClose,
  initial,
  event,
  googleConnected = false,
}: {
  onClose: () => void;
  /** Slot seed for a fresh event (local "YYYY-MM-DDTHH:mm"). */
  initial?: { startsLocal?: string; endsLocal?: string };
  /** Existing event for edit/view. */
  event?: CalendarPersonalEvent | null;
  /** Whether a Google account is connected (controls the sync toggle). */
  googleConnected?: boolean;
}) {
  const router = useRouter();
  const isEdit = !!event && event.source === "longrein";
  const isView = !!event && event.source === "google";

  const seedStart = initial?.startsLocal || toLocalInput(roundedNow());
  const seedEnd = initial?.endsLocal || addMinutes(seedStart, 60);

  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<PersonalEventType>(event?.event_type ?? "personal");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startsLocal, setStartsLocal] = useState(event ? toLocalInput(new Date(event.starts_at)) : seedStart);
  const [endsLocal, setEndsLocal] = useState(event ? toLocalInput(new Date(event.ends_at)) : seedEnd);
  const [allDayDate, setAllDayDate] = useState((event ? toLocalInput(new Date(event.starts_at)) : seedStart).slice(0, 10));
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [repeat, setRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");
  const [syncToGoogle, setSyncToGoogle] = useState(event?.sync_to_google ?? false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  async function submit() {
    setErr(null);
    setBusy(true);
    const fd = new FormData();
    if (event) fd.set("id", event.id);
    fd.set("title", title);
    fd.set("event_type", type);
    fd.set("all_day", String(allDay));
    if (allDay) {
      fd.set("all_day_date", allDayDate);
      fd.set("all_day_end", allDayDate);
    } else {
      fd.set("starts_at", startsLocal);
      fd.set("ends_at", endsLocal);
    }
    fd.set("location", location);
    fd.set("notes", notes);
    fd.set("repeat", repeat);
    fd.set("sync_to_google", String(syncToGoogle));
    const res = isEdit ? await updatePersonalEventAction(fd) : await createPersonalEventAction(fd);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!event) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", event.id);
    const res = await deletePersonalEventAction(fd);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    router.refresh();
    onClose();
  }

  const accent = event ? eventHex(event) : EVENT_TYPE_META[type].hex;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isView ? "Event details" : isEdit ? "Edit event" : "New event"}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface rounded-2xl shadow-lift flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden my-auto"
      >
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-navy-900 inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: accent }} aria-hidden />
            {isView ? "Event" : isEdit ? "Edit event" : "New event"}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="text-ink-400 hover:text-navy-900 p-1 -mr-1 rounded-lg" aria-label="Close">✕</button>
        </div>

        {/* ---------- VIEW (Google-imported, read-only) ---------- */}
        {isView && event ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            <div>
              <div className="text-lg font-semibold text-navy-900">
                {isOvernight(event) && <span className="mr-1" aria-hidden>🌙</span>}
                {event.title}
              </div>
              <div className="mt-1 text-sm text-ink-600 tabular-nums">
                {event.all_day
                  ? "All day"
                  : `${new Date(event.starts_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${fmtTime(event.starts_at)} – ${fmtTime(event.ends_at)}`}
                {isOvernight(event) && (
                  <span className="text-ink-400"> (overnight)</span>
                )}
              </div>
            </div>
            {event.location && <Detail label="Location">{event.location}</Detail>}
            {event.notes && <Detail label="Description">{event.notes}</Detail>}
            <Detail label="Source">Google Calendar{event.calendar_name ? ` · ${event.calendar_name}` : ""}</Detail>
            {event.google_html_link && (
              <a href={event.google_html_link} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 mt-1">
                Open in Google Calendar ↗
              </a>
            )}
            <p className="text-[11px] text-ink-400 mt-1">Imported from Google — edit it in Google Calendar and it syncs back here.</p>
          </div>
        ) : (
          /* ---------- CREATE / EDIT form ---------- */
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
            <L label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Doctor, Family dinner, Work shift"
                className="rounded-xl border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </L>

            <L label="Type">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`h-8 px-3 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors ${type === t ? "text-white shadow-sm" : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"}`}
                    style={type === t ? { background: EVENT_TYPE_META[t].hex } : undefined}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: EVENT_TYPE_META[t].hex }} />
                    {EVENT_TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </L>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-navy-900">All day</span>
            </label>

            {allDay ? (
              <L label="Date">
                <input type="date" value={allDayDate} onChange={(e) => setAllDayDate(e.target.value)}
                  className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </L>
            ) : (
              <>
                <L label="Starts">
                  <input type="datetime-local" step={900} value={startsLocal}
                    onChange={(e) => { setStartsLocal(e.target.value); if (new Date(endsLocal) <= new Date(e.target.value)) setEndsLocal(addMinutes(e.target.value, 60)); }}
                    className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </L>
                <L label="Ends">
                  <input type="datetime-local" step={900} value={endsLocal} onChange={(e) => setEndsLocal(e.target.value)}
                    className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </L>
                {new Date(endsLocal) > new Date(startsLocal) && new Date(startsLocal).toDateString() !== new Date(endsLocal).toDateString() && (
                  <p className="text-[11px] text-indigo-600 -mt-1.5">🌙 Overnight — spans past midnight. Shows on both days.</p>
                )}
              </>
            )}

            <L label="Location (optional)">
              <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200}
                className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </L>

            <L label="Repeat">
              <select value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)}
                className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500">
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </L>

            <L label="Notes (optional)">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000}
                className="rounded-xl border border-ink-200 bg-white text-sm px-3 py-2.5 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </L>

            <div className="rounded-xl border border-ink-100 bg-white px-3 py-2.5">
              <label className={`flex items-start gap-2.5 ${googleConnected ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}>
                <input type="checkbox" checked={syncToGoogle && googleConnected} disabled={!googleConnected}
                  onChange={(e) => setSyncToGoogle(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900">Sync to Google Calendar</p>
                  <p className="text-[11.5px] text-ink-600 mt-0.5">
                    {googleConnected ? "Also create this event in your selected Google calendar." : "Connect Google in Settings → Integrations to enable."}
                  </p>
                </div>
              </label>
            </div>

            {err && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-ink-100 bg-surface/95 flex items-center justify-between gap-2 shrink-0">
          <div>
            {isEdit && (
              <button type="button" onClick={remove} disabled={busy}
                className="h-10 px-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl text-sm text-ink-700 hover:bg-ink-100/60">
              {isView ? "Close" : "Cancel"}
            </button>
            {!isView && (
              <button type="button" onClick={submit} disabled={busy}
                className="h-10 px-5 rounded-xl text-sm font-medium bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50">
                {busy ? "Saving…" : isEdit ? "Save" : "Create event"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function roundedNow(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15);
  return d;
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[12px] font-medium tracking-[0.04em] uppercase text-ink-500">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-ink-400">{label}</div>
      <div className="text-sm text-ink-800 mt-0.5 whitespace-pre-wrap">{children}</div>
    </div>
  );
}
