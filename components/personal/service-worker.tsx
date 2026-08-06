"use client";

// Registers the command centre's own service worker.
//
// Scope is pinned to /personal/ even though the script is served from
// the root. A service worker may claim any scope at or below its own
// path, so a root-hosted script narrowing itself to /personal/ is legal
// and needs no Service-Worker-Allowed header.
//
// That narrowing matters: Longrein already registers /sw.js at root
// scope for Web Push. Two workers coexist — the most specific scope wins
// for a given page — so /personal is handled by sw-personal.js and every
// other Longrein page keeps using /sw.js exactly as before. Nothing
// about the existing push flow changes.

import { useEffect } from "react";

export function PersonalServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Service workers don't run in the Capacitor WKWebView shell. Skip
    // there rather than logging a failed registration on every launch.
    const cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    }).Capacitor;
    if (cap?.isNativePlatform?.()) return;

    navigator.serviceWorker
      .register("/sw-personal.js", { scope: "/personal/" })
      .catch(() => {
        // Offline caching is a progressive enhancement. If registration
        // fails (private mode, unsupported browser) the app still works
        // — it just won't render anything without a network.
      });
  }, []);

  return null;
}
