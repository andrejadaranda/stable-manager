"use client";

// Registers the iOS app's APNs device token with the backend on launch.
// No-op on web and on native builds without the Push Notifications capability
// (registerPushNative returns null → nothing is sent). Once build 5 ships the
// entitlement + APNS_* env is set, this quietly wires each device up for the
// 15-minutes-before + morning-digest lesson pushes.

import { useEffect } from "react";
import { registerPushNative } from "@/lib/native";

export function NativePushRegister() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await registerPushNative();
        if (!token || cancelled) return;
        await fetch("/api/push/register-native", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, platform: "ios" }),
        });
      } catch {
        /* dormant until the entitlement build + APNs keys exist — ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
