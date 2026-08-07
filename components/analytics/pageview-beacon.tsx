"use client";

// The traffic beacon. One fire-and-forget request per page view.
//
// Deliberately tiny and deliberately dumb: no library, no cookie, no
// identifier, no retries. If it fails, nothing happens and nobody
// notices — a counter must never be able to affect the page it counts.
//
// "Visit" (a session, rather than a page view) is decided here rather
// than on the server, using sessionStorage. That is what lets the server
// count sessions without ever receiving anything that identifies the
// browser: it is told "this is a new session", not "this is browser X".

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PageviewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect Do Not Track. The data is anonymous either way, but
    // ignoring an explicit signal to not be counted is rude.
    if (navigator.doNotTrack === "1") return;

    let isNewSession = false;
    try {
      if (!sessionStorage.getItem("lr_seen")) {
        sessionStorage.setItem("lr_seen", "1");
        isNewSession = true;
      }
    } catch {
      // Private mode / storage disabled. Count the view, skip the visit —
      // better to undercount sessions than to invent them.
    }

    const payload = JSON.stringify({
      host: window.location.hostname,
      path: pathname || window.location.pathname,
      visit: isNewSession,
    });

    try {
      // sendBeacon survives the page being closed mid-navigation, which
      // fetch does not. It is also fire-and-forget by definition, so it
      // cannot delay anything.
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/pageview", new Blob([payload], { type: "application/json" }));
      } else {
        void fetch("/api/pageview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* never let counting break a render */
    }
  }, [pathname]);

  return null;
}
