"use client";

// Beacon share dialog (Sprint 4 W3). Lives in the session detail header.
// Only renders for live sessions. Lets the rider mint a public link
// they can SMS/WhatsApp to an emergency contact + revoke any time.

import { useEffect, useState, useTransition } from "react";
import {
  ensureBeaconAction,
  getBeaconAction,
  revokeBeaconAction,
  type BeaconState,
} from "@/app/dashboard/sessions/[id]/beacon-actions";

export function BeaconShareDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BeaconState | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // On open, fetch current beacon (if any) — surface "already shared" state.
  useEffect(() => {
    if (!open) return;
    void getBeaconAction(sessionId).then(setState);
  }, [open, sessionId]);

  function mint() {
    setCopied(false);
    startTransition(async () => {
      const res = await ensureBeaconAction(sessionId);
      setState(res);
    });
  }

  function copy() {
    if (state?.ok) {
      void navigator.clipboard.writeText(state.shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }

  function revoke() {
    if (!confirm("Stop sharing your live location? The link will stop working immediately.")) return;
    startTransition(async () => {
      await revokeBeaconAction(sessionId);
      setState({ ok: false, error: "no_active_beacon" });
    });
  }

  function nativeShare() {
    if (state?.ok && navigator.share) {
      void navigator.share({
        title: "Follow my ride",
        text:  "Live ride tracking. The page updates while I'm riding.",
        url:   state.shareUrl,
      }).catch(() => { /* user cancelled */ });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          inline-flex items-center justify-center gap-1.5
          h-10 px-3.5 rounded-xl text-sm font-medium
          bg-red-600 text-white border border-red-600
          hover:bg-red-700 active:bg-red-800
          transition-colors
        "
        title="Share your live location with an emergency contact"
      >
        ▶ Beacon
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lift border border-ink-200 p-6 flex flex-col gap-4">
            <header className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg text-navy-900">Live safety beacon</h2>
                <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                  Send a public link to one person who'll check in on you. They'll see your live position + speed + last GPS update. If your phone goes quiet for 10 min, the page shows a red alarm.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-sm text-ink-500 hover:text-ink-900">✕</button>
            </header>

            {!state && <p className="text-sm text-ink-500">Loading…</p>}

            {state?.ok && (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex flex-col gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-emerald-900">
                    Beacon active · expires {new Date(state.share.expires_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="flex items-stretch gap-2">
                    <input
                      readOnly
                      value={state.shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 min-w-0 border border-emerald-300 rounded-md px-2.5 py-1.5 text-xs bg-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      {copied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Viewed {state.share.view_count} times.
                    {state.share.last_viewed_at && ` Last opened ${formatRelative(state.share.last_viewed_at)}.`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {typeof window !== "undefined" && "share" in navigator && (
                    <button
                      type="button"
                      onClick={nativeShare}
                      className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Share via…
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={revoke}
                    disabled={isPending}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Stop sharing
                  </button>
                </div>
              </div>
            )}

            {state && !state.ok && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-ink-700">
                  No beacon active. Tap below to mint a link — it works for 4 hours and you can revoke it any time.
                </p>
                <button
                  type="button"
                  onClick={mint}
                  disabled={isPending}
                  className="self-start rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Starting…" : "Start beacon"}
                </button>
                {state.error && state.error !== "no_active_beacon" && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {state.error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function formatRelative(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}
