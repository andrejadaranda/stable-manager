"use server";

// The one way a client-side error boundary can reach the error log.
//
// A server action is a public HTTP endpoint, so this is written as if
// anyone can call it — because anyone can. The defences are:
//
//   * everything is truncated before it is stored;
//   * an empty message is rejected outright;
//   * a per-instance burst throttle caps how many rows a single warm
//     lambda will write per minute.
//
// What this deliberately does NOT do is require a session. An error
// boundary fires precisely when things are broken, sometimes including
// auth, and an error reporter that only works when everything works is
// not worth having.
//
// The consequence to be honest about: the "klaidos per 24 h" figure is a
// signal, not an audited metric. It is good for "something started
// breaking this morning" and should not be quoted as an SLA.

import { logAppError, type ErrorScope } from "@/lib/personal/error-log";

/** Per-instance burst cap. Resets whenever the lambda goes cold, which
 *  is fine — this exists to stop a loop, not to be a global rate limit. */
const MAX_PER_WINDOW = 20;
const WINDOW_MS = 60_000;

let windowStartedAt = 0;
let writtenInWindow = 0;

export async function reportClientError(input: {
  scope?: ErrorScope;
  route?: string;
  message?: string;
  digest?: string;
}): Promise<void> {
  const message = typeof input.message === "string" ? input.message.trim() : "";
  if (!message) return;

  const now = Date.now();
  if (now - windowStartedAt > WINDOW_MS) {
    windowStartedAt = now;
    writtenInWindow = 0;
  }
  if (writtenInWindow >= MAX_PER_WINDOW) return;
  writtenInWindow += 1;

  await logAppError({
    scope: input.scope === "personal" ? "personal" : "app",
    route: typeof input.route === "string" ? input.route.slice(0, 300) : null,
    message: message.slice(0, 500),
    digest: typeof input.digest === "string" ? input.digest.slice(0, 100) : null,
    // No stack: a client-side stack is minified to uselessness, and the
    // digest already ties this back to the real server-side trace in the
    // platform logs.
    stack: null,
  });
}
