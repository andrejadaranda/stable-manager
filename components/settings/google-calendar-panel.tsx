"use client";

// Settings → Integrations → Google Calendar.
// Connect / disconnect, pick which Google calendars to READ into Longrein,
// pick ONE write-target calendar for Longrein→Google push, and a master
// sync toggle + manual "Sync now".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setCalendarReadAction,
  setWriteTargetAction,
  setSyncEnabledAction,
  refreshCalendarsAction,
  syncNowAction,
  disconnectGoogleAction,
} from "@/app/dashboard/settings/integrations/actions";
import type { GoogleConnectionPublic, GoogleCalendarRow } from "@/services/googleCalendar";

export function GoogleCalendarPanel({
  connection,
  calendars,
  flash,
}: {
  connection: GoogleConnectionPublic | null;
  calendars: GoogleCalendarRow[];
  flash?: "connected" | "denied" | "error" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error: string | null }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.error);
      router.refresh();
    });
  }

  const connected = connection?.status === "connected";
  const needsReauth = connection?.status === "needs_reauth";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Google Calendar</h2>
        <p className="text-sm text-ink-500 mt-1">
          See your Google events inside Longrein and push Longrein events to Google — one unified calendar.
        </p>
      </div>

      {flash === "connected" && (
        <Banner tone="ok">Google Calendar connected. Pick which calendars to show below.</Banner>
      )}
      {flash === "denied" && <Banner tone="warn">Connection cancelled — you didn’t grant access.</Banner>}
      {flash === "error" && <Banner tone="warn">Something went wrong connecting Google. Please try again.</Banner>}
      {msg && <Banner tone="warn">{msg}</Banner>}

      {/* Not connected ------------------------------------------------ */}
      {!connection && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 flex flex-col items-start gap-3">
          <p className="text-sm text-ink-700">Connect your Google account to start syncing.</p>
          <a
            href="/api/google/oauth/start"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white shadow-sm hover:bg-brand-700"
          >
            Connect Google Calendar
          </a>
        </div>
      )}

      {/* Connected / needs reauth ------------------------------------- */}
      {connection && (
        <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  {connected ? "Connected" : needsReauth ? "Reconnection needed" : "Connection issue"}
                </p>
                <p className="text-[12.5px] text-ink-500 truncate">{connection.google_account_email ?? "Google account"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(needsReauth || connection.status === "error") && (
                <a href="/api/google/oauth/start" className="inline-flex items-center h-9 px-3.5 rounded-lg text-[13px] font-medium bg-brand-600 text-white hover:bg-brand-700">
                  Reconnect
                </a>
              )}
              <button type="button" disabled={pending} onClick={() => run(syncNowAction)}
                className="inline-flex items-center h-9 px-3.5 rounded-lg text-[13px] font-medium bg-white ring-1 ring-ink-200 text-ink-700 hover:bg-ink-50 disabled:opacity-50">
                Sync now
              </button>
            </div>
          </div>

          {needsReauth && (
            <Banner tone="warn">Google access expired or was revoked. Click Reconnect to resume syncing.</Banner>
          )}

          {/* Master Longrein→Google toggle */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={connection.sync_enabled} disabled={pending}
              onChange={(e) => run(() => { const fd = new FormData(); fd.set("enabled", String(e.target.checked)); return setSyncEnabledAction(fd); })}
              className="mt-0.5 w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
            <div>
              <p className="text-sm font-medium text-ink-900">Push Longrein events to Google</p>
              <p className="text-[12px] text-ink-500">Personal events marked “Sync to Google” are written to your chosen calendar below.</p>
            </div>
          </label>

          {/* Calendar list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-500">Your calendars</p>
              <button type="button" disabled={pending} onClick={() => run(refreshCalendarsAction)}
                className="text-[12px] font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50">Refresh list</button>
            </div>
            {calendars.length === 0 ? (
              <p className="text-[13px] text-ink-500">No calendars yet — click “Refresh list”.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {calendars.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
                    <label className="flex items-center gap-2.5 min-w-0 cursor-pointer">
                      <input type="checkbox" checked={c.read_enabled} disabled={pending}
                        onChange={(e) => run(() => { const fd = new FormData(); fd.set("calendar_pk", c.id); fd.set("read", String(e.target.checked)); return setCalendarReadAction(fd); })}
                        className="w-4 h-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.background_color ?? "#7c3aed" }} />
                      <span className="text-sm text-ink-900 truncate">{c.summary ?? c.google_calendar_id}{c.primary_cal ? " (primary)" : ""}</span>
                    </label>
                    <label className="flex items-center gap-1.5 shrink-0 cursor-pointer" title="Write Longrein events here">
                      <input type="radio" name="write_target" checked={c.is_write_target} disabled={pending || (c.access_role !== "owner" && c.access_role !== "writer")}
                        onChange={() => run(() => { const fd = new FormData(); fd.set("calendar_pk", c.id); return setWriteTargetAction(fd); })}
                        className="w-4 h-4 border-ink-300 text-brand-600 focus:ring-brand-500" />
                      <span className="text-[11.5px] text-ink-500">Write here</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-ink-400">Checked calendars appear in Longrein. The “Write here” one receives Longrein events you choose to sync.</p>
          </div>

          {/* Disconnect */}
          <div className="pt-1 border-t border-ink-100">
            <DisconnectButton disabled={pending} onConfirm={() => run(disconnectGoogleAction)} />
          </div>
        </div>
      )}
    </div>
  );
}

function DisconnectButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" disabled={disabled} onClick={() => setConfirming(true)}
        className="text-[13px] font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50 mt-3">
        Disconnect Google
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 flex flex-col gap-2">
      <p className="text-[12.5px] text-rose-800">
        Disconnecting stops syncing and removes imported Google events from Longrein. Your Longrein events stay, and your actual Google Calendar is never changed.
      </p>
      <div className="flex items-center gap-2">
        <button type="button" disabled={disabled} onClick={onConfirm}
          className="h-9 px-3.5 rounded-lg text-[13px] font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
          Disconnect
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="h-9 px-3.5 rounded-lg text-[13px] text-ink-600 hover:bg-white">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-900";
  return <div className={`rounded-xl border px-4 py-2.5 text-[13px] ${cls}`}>{children}</div>;
}
