"use client";

// ShareRideDialog — opens from the session detail page. Shows a preview
// of the auto-generated share card (PNG) for both IG Story (9:16) and
// IG Post (1:1). Lets the user download or use the Web Share API to
// pop the system share sheet directly.
//
// The image source is /api/sessions/[id]/share-card?format=story|post —
// generated on the fly via @vercel/og.

import { useState } from "react";

type Format = "story" | "post";

export function ShareRideDialog({ sessionId }: { sessionId: string }) {
  const [open, setOpen]     = useState(false);
  const [format, setFormat] = useState<Format>("story");
  const [busy, setBusy]     = useState(false);
  const [note, setNote]     = useState<string | null>(null);

  // Append a cache-buster so changes to the card show up immediately.
  const src = `/api/sessions/${sessionId}/share-card?format=${format}&v=1`;

  async function onDownload() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `longrein-ride-${format}-${sessionId.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSystemShare() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `longrein-ride-${format}.png`, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Longrein ride",
          text: "Tracked with Longrein — premium stable management.",
        });
      } else if (navigator.share) {
        await navigator.share({
          title: "My Longrein ride",
          url: window.location.href,
        });
      } else {
        setNote("System share isn't supported on this device — use Download.");
      }
    } catch (e) {
      // User cancellation throws AbortError — ignore.
      const m = e instanceof Error ? e.message : "";
      if (!/cancel|abort/i.test(m)) setNote(m || "Share failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link copied — paste into chat or stories.");
    } catch {
      setNote("Couldn't copy. Long-press the URL bar.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="
          inline-flex items-center justify-center gap-1.5
          h-10 px-4 rounded-xl text-sm font-medium
          bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800
          transition-colors
        "
      >
        ↗ Share ride
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-stretch sm:items-center sm:justify-center sm:p-6 bg-ink-900/50 backdrop-blur-sm"
    >
      <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:shadow-lg sm:max-w-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-ink-100 shrink-0">
          <div>
            <h2 className="font-display text-xl text-navy-700 leading-tight">Share your ride</h2>
            <p className="text-[12.5px] text-ink-500 mt-1">
              Auto-generated card for Instagram, Facebook, or anywhere you post.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="-mt-1 -mr-1 h-8 w-8 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Format toggle */}
        <div className="px-6 pt-4 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFormat("story")}
            className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors ${
              format === "story"
                ? "bg-brand-600 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            IG Story (9:16)
          </button>
          <button
            type="button"
            onClick={() => setFormat("post")}
            className={`h-9 px-4 rounded-lg text-xs font-semibold transition-colors ${
              format === "post"
                ? "bg-brand-600 text-white"
                : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            IG Post (1:1)
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div
            className={`mx-auto bg-cream-50 rounded-xl overflow-hidden border border-ink-100 ${
              format === "story" ? "max-w-[280px]" : "max-w-[360px]"
            }`}
            style={{ aspectRatio: format === "story" ? "9 / 16" : "1 / 1" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Share card preview"
              className="w-full h-full object-cover"
            />
          </div>

          {note && (
            <p className="mt-4 text-center text-sm text-ink-700">{note}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-ink-100 flex flex-col sm:flex-row gap-2 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCopyLink}
            disabled={busy}
            className="flex-1 h-11 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-900 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            🔗 Copy link
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="flex-1 h-11 rounded-xl border border-ink-200 bg-white text-sm font-medium text-ink-900 hover:bg-ink-50 transition-colors disabled:opacity-50"
          >
            ⬇ Download PNG
          </button>
          <button
            type="button"
            onClick={onSystemShare}
            disabled={busy}
            className="flex-1 h-11 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            ↗ Share
          </button>
        </div>
      </div>
    </div>
  );
}
