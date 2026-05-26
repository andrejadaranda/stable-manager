// Runtime guard for Capacitor native APIs.
//
// All call sites use the safe wrappers below — they no-op when running
// in Safari/PWA, and delegate to native plugins inside the iOS shell.
// Lets us keep ONE codebase for web + iOS.
//
// IMPORTANT: @capacitor/* dynamic imports are typed as `any` here so
// the Vercel web build doesn't require Capacitor packages to be
// installed. The packages only need to exist locally when running
// `npx cap sync`. Web build path uses fallback only.

/* eslint-disable @typescript-eslint/no-explicit-any */

type Coords = {
  lat:         number;
  lng:         number;
  alt:         number | null;
  speed:       number | null;
  accuracy:    number;
  recorded_at: string;
};

let _capacitor: any = null;

async function loadCapacitor(): Promise<any> {
  if (_capacitor) return _capacitor;
  if (typeof window === "undefined") return null;
  try {
    // @ts-ignore — Capacitor only installed in the iOS shell
    _capacitor = await import("@capacitor/core");
    return _capacitor;
  } catch {
    return null;
  }
}

export async function isNative(): Promise<boolean> {
  const cap = await loadCapacitor();
  return cap ? cap.Capacitor.isNativePlatform() : false;
}

/**
 * Background-capable geolocation watcher. Returns a stop fn.
 * In Safari/PWA, falls back to browser navigator.geolocation.watchPosition.
 */
export async function watchPositionNative(cb: (coords: Coords) => void): Promise<() => void> {
  const native = await isNative();
  if (native) {
    // @ts-ignore — only resolvable inside iOS shell
    const { Geolocation } = await import("@capacitor/geolocation");
    await Geolocation.requestPermissions({ permissions: ["location"] });
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 15_000 },
      (pos: any, err: any) => {
        if (err || !pos) return;
        cb({
          lat:         pos.coords.latitude,
          lng:         pos.coords.longitude,
          alt:         pos.coords.altitude,
          speed:       pos.coords.speed,
          accuracy:    pos.coords.accuracy,
          recorded_at: new Date(pos.timestamp).toISOString(),
        });
      },
    );
    return () => { void Geolocation.clearWatch({ id: watchId }); };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) => cb({
      lat:         pos.coords.latitude,
      lng:         pos.coords.longitude,
      alt:         pos.coords.altitude,
      speed:       pos.coords.speed,
      accuracy:    pos.coords.accuracy,
      recorded_at: new Date(pos.timestamp).toISOString(),
    }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Native share sheet (iOS) or Web Share API fallback. */
export async function shareNative(opts: { title?: string; text?: string; url: string }): Promise<void> {
  const native = await isNative();
  if (native) {
    // @ts-ignore
    const { Share } = await import("@capacitor/share");
    await Share.share({ title: opts.title, text: opts.text, url: opts.url });
    return;
  }
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    clipboard?: { writeText: (s: string) => Promise<void> };
  };
  if (typeof nav.share === "function") {
    await nav.share(opts);
    return;
  }
  if (nav.clipboard) {
    await nav.clipboard.writeText(opts.url);
  }
}

/** Register for push notifications. Returns the APNs device token. */
export async function registerPushNative(): Promise<string | null> {
  const native = await isNative();
  if (!native) return null;
  // @ts-ignore
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return null;
  return new Promise((resolve) => {
    PushNotifications.addListener("registration", (t: { value: string }) => resolve(t.value));
    PushNotifications.addListener("registrationError", () => resolve(null));
    void PushNotifications.register();
  });
}
