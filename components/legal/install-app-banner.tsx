"use client";

// PWA install prompt — bottom banner that nudges iOS Safari users to
// "Add to Home Screen" and offers Android Chrome users a one-tap install.
// Without this banner, the manifest + apple-touch metadata is functional
// but invisible — users never discover the install option.
//
// Lifecycle:
//   - Hidden if already running in standalone (display-mode: standalone)
//   - Hidden if user dismissed (localStorage flag, 30 days)
//   - iOS Safari → shows Share → Add to Home Screen instructions
//   - Android Chrome → captures beforeinstallprompt + offers Install button

import { useEffect, useState } from "react";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY        = "longrein_install_dismissed_at";
const DISMISS_TTL_DAYS   = 30;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isiOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isiOS = /iPhone|iPad|iPod/.test(ua);
  // Safari, not Chrome/Firefox/Edge on iOS (they use WebKit but block install)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isiOS && isSafari;
}

function isDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  const at = localStorage.getItem(DISMISS_KEY);
  if (!at) return false;
  const ageDays = (Date.now() - Number(at)) / (1000 * 60 * 60 * 24);
  return ageDays < DISMISS_TTL_DAYS;
}

export function InstallAppBanner() {
  const [show, setShow]                 = useState(false);
  const [mode, setMode]                 = useState<"ios" | "android" | null>(null);
  const [deferred, setDeferred]         = useState<DeferredPrompt | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;   // already installed
    if (isDismissed())   return;  // user said no

    if (isiOSSafari()) {
      // Wait a beat so banner doesn't blast on first paint.
      const t = window.setTimeout(() => { setMode("ios"); setShow(true); }, 4000);
      return () => window.clearTimeout(t);
    }

    // Android Chrome flow — fires when browser deems PWA install-worthy.
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
      setMode("android");
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    return () => window.removeEventListener("beforeinstallprompt", onBefore);
  }, []);

  function dismiss() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setShow(false);
  }

  async function installAndroid() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") dismiss();
    setDeferred(null);
  }

  if (!show || !mode) return null;

  return (
    <div
      className="
        fixed bottom-4 left-4 right-4 z-40
        md:left-auto md:right-4 md:max-w-sm
        bg-white border border-ink-200 rounded-2xl shadow-lift
        p-4 flex items-start gap-3
        animate-in slide-in-from-bottom duration-300
      "
      role="dialog"
      aria-label="Install Longrein on your home screen"
    >
      {/* App icon */}
      <div className="shrink-0 w-12 h-12 rounded-xl bg-brand-700 flex items-center justify-center">
        <span
          className="text-white text-2xl leading-none"
          style={{ fontFamily: "Georgia, serif", fontWeight: 600 }}
        >
          L<span className="text-saddle-300">.</span>
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-900">
          Install Longrein on your phone
        </p>
        {mode === "ios" ? (
          <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
            Tap{" "}
            <span className="inline-flex items-center align-middle px-1 py-0.5 rounded bg-ink-100 mx-0.5">
              <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
                <path d="M6 1V9M6 1L3 4M6 1L9 4M2 7V12C2 12.5523 2.44772 13 3 13H9C9.5523 13 10 12.5523 10 12V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>{" "}
            then <strong>Add to Home Screen</strong>. Looks and feels like a real app — no App Store needed.
          </p>
        ) : (
          <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
            One tap to add Longrein to your Home Screen — fullscreen, no browser bar, just like a regular app.
          </p>
        )}

        {mode === "android" && (
          <button
            type="button"
            onClick={installAndroid}
            className="mt-2.5 inline-flex items-center justify-center rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-800 transition-colors"
          >
            Install Longrein
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 -mt-1 w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
      >
        ✕
      </button>
    </div>
  );
}
