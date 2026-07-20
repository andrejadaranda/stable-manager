"use client";

// External calendar IMPORT panel. Paste a read-only .ics link (e.g. a spouse's
// work calendar) and Longrein turns its events into busy blocks on the calendar
// so lessons aren't booked over them. One-way: external → Longrein.

import { useFormState, useFormStatus } from "react-dom";
import {
  saveExternalCalendarAction,
  resyncExternalCalendarAction,
  clearExternalCalendarAction,
  type ExternalState,
} from "@/app/dashboard/settings/calendar/external-actions";

const INIT: ExternalState = { ok: false, error: null };

export type ExternalCalendarView = {
  url: string | null;
  label: string | null;
  syncedAt: string | null;
  status: string | null;
  blockCount: number;
};

function SubmitBtn({ children, variant = "primary" }: { children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const { pending } = useFormStatus();
  const base = "h-11 px-4 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-60 shrink-0";
  const styles = variant === "primary"
    ? "bg-brand-700 text-white hover:bg-brand-800"
    : "bg-white border border-ink-200 text-ink-800 hover:bg-ink-50";
  return (
    <button type="submit" disabled={pending} className={`${base} ${styles}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

function statusLabel(status: string | null): { text: string; tone: "ok" | "warn" | "muted" } {
  if (!status) return { text: "Not synced yet", tone: "muted" };
  if (status === "ok") return { text: "Synced", tone: "ok" };
  if (status === "timeout") return { text: "Timed out reaching the calendar", tone: "warn" };
  if (status === "not_a_calendar") return { text: "That link isn't a calendar feed", tone: "warn" };
  if (status.startsWith("fetch_failed")) return { text: `Couldn't fetch (${status.replace("fetch_failed_", "HTTP ")})`, tone: "warn" };
  if (status === "fetch_error") return { text: "Couldn't reach the calendar", tone: "warn" };
  if (status === "insert_failed") return { text: "Import error — try again", tone: "warn" };
  return { text: status, tone: "warn" };
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      hour12: false, timeZone: "Europe/Vilnius",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function ExternalCalendarPanel({ initial }: { initial: ExternalCalendarView }) {
  const [saveState, saveAction] = useFormState(saveExternalCalendarAction, INIT);
  const [syncState, syncAction] = useFormState(resyncExternalCalendarAction, INIT);

  const connected = !!initial.url;
  const st = statusLabel(initial.status);
  const toneClass =
    st.tone === "ok" ? "text-brand-700" : st.tone === "warn" ? "text-alert-600" : "text-ink-400";

  return (
    <div className="flex flex-col gap-4 border-t border-ink-100 pt-6">
      <div>
        <h3 className="font-serif font-semibold text-[19px] text-ink-900">Import a calendar</h3>
        <p className="text-[13.5px] text-ink-500 mt-1 leading-relaxed">
          Subscribe Longrein to a read-only calendar link — for example your partner&apos;s work
          calendar. Its events show up as <b>busy blocks</b> so you don&apos;t book a lesson over them.
          One-way: nothing you do here is written back to that calendar.
        </p>
      </div>

      {connected ? (
        <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink-900 truncate">
                {initial.label || "Imported calendar"}
              </div>
              <div className="text-[12px] text-ink-400 font-mono truncate mt-0.5">{initial.url}</div>
            </div>
            <span className={`text-[12px] font-semibold shrink-0 ${toneClass}`}>{st.text}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-500">
            <span><b className="text-ink-700">{initial.blockCount}</b> busy block{initial.blockCount === 1 ? "" : "s"}</span>
            <span>Last checked {fmtWhen(initial.syncedAt)}</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <form action={syncAction}>
              <SubmitBtn>Sync now</SubmitBtn>
            </form>
            <form action={clearExternalCalendarAction}>
              <SubmitBtn variant="ghost">Remove</SubmitBtn>
            </form>
          </div>

          {syncState.error && <p className="text-[12.5px] text-alert-600">{syncState.error}</p>}
          {syncState.ok && (
            <p className="text-[12.5px] text-brand-700">
              Synced — {syncState.blocks ?? 0} busy block{(syncState.blocks ?? 0) === 1 ? "" : "s"} imported.
            </p>
          )}

          {/* Allow replacing the URL by re-submitting the form below. */}
          <details className="mt-1">
            <summary className="text-[12.5px] text-ink-500 cursor-pointer select-none">Change the link</summary>
            <ConnectForm action={saveAction} state={saveState} initialUrl={initial.url ?? ""} initialLabel={initial.label ?? ""} compact />
          </details>
        </div>
      ) : (
        <div className="bg-white border border-ink-100 rounded-2xl shadow-soft p-4">
          <ConnectForm action={saveAction} state={saveState} />
        </div>
      )}

      <div className="bg-ink-50 rounded-2xl p-4 text-[13px] text-ink-600 leading-relaxed">
        <p className="font-bold text-ink-800 mb-1.5">Where to find the link</p>
        <p className="mb-1"><b>Google Calendar:</b> Settings → your calendar → Integrate calendar → <i>Secret address in iCal format</i> (ends in <span className="font-mono">.ics</span>).</p>
        <p className="mb-1"><b>Apple / iCloud:</b> right-click the calendar → Share → Public Calendar → copy the <span className="font-mono">webcal://</span> link.</p>
        <p><b>TimeTree:</b> doesn&apos;t give a subscribe link, so paste the underlying Google/iCloud calendar you both share instead.</p>
      </div>
    </div>
  );
}

function ConnectForm({
  action, state, initialUrl = "", initialLabel = "", compact = false,
}: {
  action: (fd: FormData) => void;
  state: ExternalState;
  initialUrl?: string;
  initialLabel?: string;
  compact?: boolean;
}) {
  return (
    <form action={action} className={`flex flex-col gap-3 ${compact ? "mt-3" : ""}`}>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Calendar link (.ics / webcal)</label>
        <input
          name="url"
          type="text"
          required
          defaultValue={initialUrl}
          placeholder="https://calendar.google.com/…/basic.ics"
          className="h-11 px-3 rounded-xl border border-ink-200 bg-ink-50 text-[13px] font-mono text-ink-800"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400">Label (optional)</label>
        <input
          name="label"
          type="text"
          defaultValue={initialLabel}
          placeholder="e.g. Tomas — work"
          className="h-11 px-3 rounded-xl border border-ink-200 bg-white text-[13px] text-ink-800"
        />
      </div>
      <div className="flex items-center gap-2">
        <SubmitBtn>{compact ? "Update & sync" : "Connect & sync"}</SubmitBtn>
      </div>
      {state.error && <p className="text-[12.5px] text-alert-600">{state.error}</p>}
      {state.ok && (
        <p className="text-[12.5px] text-brand-700">
          Connected — {state.blocks ?? 0} busy block{(state.blocks ?? 0) === 1 ? "" : "s"} imported.
        </p>
      )}
    </form>
  );
}
