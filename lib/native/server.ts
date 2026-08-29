// Server-side detection of the Capacitor native shell.
//
// The iOS app appends a marker to its webview User-Agent (see
// `appendUserAgent` in capacitor.config.ts), so every request that
// originates inside the app carries it and no ordinary browser does.
// This is how server components + middleware know they're rendering
// inside the App Store build — which matters for Apple compliance:
// the native app must NOT present in-app purchase flows or links to an
// external subscription checkout (App Store Review Guideline 3.1.1 /
// 3.1.3). We use this to swap those surfaces for a neutral "manage your
// plan on the web" notice.
//
// Pure + dependency-free so it's safe to import from Edge middleware.

export const NATIVE_UA_MARKER = "LongreinApp";

export function isNativeUserAgent(ua: string | null | undefined): boolean {
  return typeof ua === "string" && ua.includes(NATIVE_UA_MARKER);
}
