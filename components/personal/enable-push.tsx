"use client";

// The "turn on the morning notification" control.
//
// Everything about Web Push on iOS is fiddly, and every one of those
// fiddly bits is a place where a user taps a button, nothing happens, and
// they conclude the feature is broken. So this component is explicit
// about each state rather than showing one button that sometimes works:
//
//   * iOS delivers Web Push ONLY to a PWA that has been added to the Home
//     Screen (16.4+). In Safari's normal tab the subscribe call fails
//     with a vague error. We detect the tab case and say what to do.
//   * Permission is a one-shot prompt per origin. Once denied, no amount
//     of button-pressing brings it back — it has to be changed in iOS
//     Settings. We detect "denied" and say that too.
//   * The subscription belongs to the /personal/ service worker
//     registration, not the root one, so we wait for that specific
//     registration rather than whichever worker happens to be ready.

import { useEffect, useState } from "react";
import { cn } from "@/components/ui/cn";

type State =
  | "checking"
  | "unsupported"
  | "needs-install" // iOS Safari tab, not installed to the Home Screen
  | "denied"
  | "off"
  | "on"
  | "working";

export function EnablePush() {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;

      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        typeof Notification !== "undefined";

      if (!supported) {
        // On iOS this is the "opened in a Safari tab" case, which is
        // fixable, rather than a genuinely unsupported browser.
        if (!cancelled) setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }

      if (isIos() && !isStandalone()) {
        if (!cancelled) setState("needs-install");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      try {
        const reg = await registration();
        const existing = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(existing ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg = await registration();
      if (!reg) throw new Error("Nepavyko paruošti fono tarnybos.");

      // The public key is fetched rather than baked into the bundle: it
      // is generated server-side on first use, so at build time there is
      // nothing to bake in.
      const keyRes = await fetch("/api/personal/push/subscribe");
      if (!keyRes.ok) throw new Error("Nepavyko gauti rakto.");
      const { publicKey } = (await keyRes.json()) as { publicKey: string };

      const sub = await reg.pushManager.subscribe({
        // Required by every browser that implements Web Push: a silent
        // push (userVisibleOnly:false) is not permitted.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const saveRes = await fetch("/api/personal/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!saveRes.ok) throw new Error("Nepavyko išsaugoti prenumeratos.");

      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko įjungti.");
      setState("off");
    }
  }

  async function disable() {
    setError(null);
    setState("working");
    try {
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();

      // Tell the server first. If the local unsubscribe succeeded but the
      // DELETE didn't, we would keep pushing to an endpoint that no
      // longer exists — noisy, and it takes a 410 from the push service
      // to clean up.
      await fetch("/api/personal/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub?.endpoint ?? "" }),
      });
      await sub?.unsubscribe();

      setState("off");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko išjungti.");
      setState("on");
    }
  }

  const body = (() => {
    switch (state) {
      case "checking":
        return <p className="text-[12px] text-ink-400">Tikrinu…</p>;

      case "needs-install":
        return (
          <p className="text-[12px] leading-relaxed text-ink-500">
            iPhone pranešimus siunčia tik tada, kai programėlė pridėta į pradinį
            ekraną. Safari apačioje spausk <strong>Bendrinti</strong> →{" "}
            <strong>Į pradinį ekraną</strong>, tada atidaryk iš ten ir grįžk čia.
          </p>
        );

      case "unsupported":
        return (
          <p className="text-[12px] leading-relaxed text-ink-500">
            Ši naršyklė pranešimų nepalaiko. Atidaryk Safari (iPhone) arba
            Chrome (kompiuteris).
          </p>
        );

      case "denied":
        return (
          <p className="text-[12px] leading-relaxed text-ink-500">
            Pranešimai uždrausti. Įjungti galima tik telefono nustatymuose:{" "}
            <strong>Nustatymai → Pranešimai → Andrėja</strong>.
          </p>
        );

      case "on":
        return (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] leading-relaxed text-ink-600">
              Įjungta. Kas rytą apie 8 val. atsiųsiu dienos santrauką.
            </p>
            <button
              type="button"
              onClick={disable}
              className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-500 active:text-ink-800"
            >
              Išjungti
            </button>
          </div>
        );

      case "working":
        return <p className="text-[12px] text-ink-400">Palauk…</p>;

      case "off":
      default:
        return (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[12px] leading-relaxed text-ink-600">
              Kas rytą — kiek treniruočių, kam paskambinti, kas laukia pašte.
            </p>
            <button
              type="button"
              onClick={enable}
              className={cn(
                "shrink-0 rounded-full bg-brand-600 px-3.5 py-1.5",
                "text-[12px] font-semibold text-white active:bg-brand-700",
              )}
            >
              Įjungti
            </button>
          </div>
        );
    }
  })();

  return (
    <div>
      {body}
      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

// -------------------------------------------------------------------

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // Ask for the /personal/ worker specifically. `navigator.serviceWorker
  // .ready` would resolve to whichever registration controls the page,
  // which on a cold load can still be Longrein's root /sw.js.
  const existing = await navigator.serviceWorker.getRegistration("/personal/");
  if (existing) return existing;
  try {
    return await navigator.serviceWorker.register("/sw-personal.js", { scope: "/personal/" });
  } catch {
    return null;
  }
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac; the touch-point count is the
    // standard way to tell an iPad from a desktop Safari.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // The non-standard iOS Safari flag, which is the only one that is
    // reliable on older iOS versions.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
