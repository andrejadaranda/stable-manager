"use client";

// "Enable push notifications" control. Registers the service worker, asks
// permission, subscribes via the VAPID public key, and saves the
// subscription. Dormant (shows a hint) until NEXT_PUBLIC_VAPID_PUBLIC_KEY
// is set. iOS only allows push once the PWA is added to the Home Screen.

import { useEffect, useState } from "react";

type Status = "idle" | "unsupported" | "unconfigured" | "granted" | "denied" | "working";

export function EnableNotificationsButton() {
  const [status, setStatus] = useState<Status>("idle");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (!vapid) { setStatus("unconfigured"); return; }
    if (Notification.permission === "granted") setStatus("granted");
    else if (Notification.permission === "denied") setStatus("denied");
  }, [vapid]);

  async function enable() {
    if (!vapid) return;
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus("denied"); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      setStatus("granted");
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {status === "granted" ? (
        <span className="inline-flex items-center gap-2 text-[13px] text-emerald-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Push notifications on
        </span>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={status === "working" || status === "unsupported" || status === "unconfigured"}
          className="h-10 px-4 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 w-fit"
        >
          {status === "working" ? "Enabling…" : "Enable lesson notifications"}
        </button>
      )}
      {status === "denied" && (
        <span className="text-[12px] text-ink-500">Notifications are blocked in your browser settings — allow them there, then try again.</span>
      )}
      {status === "unsupported" && (
        <span className="text-[12px] text-ink-500">This device/browser doesn&apos;t support push. On iPhone, add Longrein to your Home Screen first.</span>
      )}
      {status === "unconfigured" && (
        <span className="text-[12px] text-ink-500">Push isn&apos;t configured yet (VAPID keys pending).</span>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
