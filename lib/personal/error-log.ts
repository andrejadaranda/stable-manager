// Error recording for the "klaidos per 24 h" card.
//
// This codebase has no Sentry, no APM and no log drain, so the error-rate
// number had nothing behind it. This module is the smallest thing that
// gives it a real source: a coarse append-only log written with the
// service-role client.
//
// Three rules it follows, because an error logger is a great way to
// accidentally build a personal-data store:
//
//   1. No PII. Message, route, digest and stack only. Never a request
//      body, never a user id, never an email.
//   2. Never throws, never blocks. Every call is fire-and-forget and
//      wrapped; a failure to record an error must not itself become an
//      error the user sees.
//   3. Migration-state noise is filtered out. Before migration 110/111
//      are applied, every dashboard query fails with "relation does not
//      exist" — logging those would fill the table with hundreds of rows
//      describing a state that is expected and temporary.

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type ErrorScope = "personal" | "app" | "api";

export type LoggedError = {
  scope: ErrorScope;
  route?: string | null;
  message: string;
  digest?: string | null;
  stack?: string | null;
};

/**
 * Record an error. Awaiting this is optional — callers on a render path
 * should not.
 */
export async function logAppError(input: LoggedError): Promise<void> {
  try {
    if (isSchemaNoise(input.message)) return;

    const admin = createSupabaseAdminClient();
    await admin.from("dashboard_errors").insert({
      scope: input.scope,
      route: trim(input.route, 300),
      message: trim(input.message, 1000) ?? "(no message)",
      digest: trim(input.digest, 100),
      // Enough stack to identify the call site, not enough to be a
      // second copy of the source tree in the database.
      stack: trim(input.stack, 4000),
    });
  } catch {
    // Deliberately silent. The console.error at the original call site
    // has already recorded this in the platform logs.
  }
}

/** Turn an unknown thrown value into something loggable. */
export function describeError(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) {
    return { message: err.message || err.name, stack: err.stack ?? null };
  }
  if (err && typeof err === "object") {
    // Supabase returns plain objects: { message, code, details, hint }.
    const e = err as Record<string, unknown>;
    const message =
      typeof e.message === "string"
        ? e.message
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
    return { message, stack: null };
  }
  return { message: String(err), stack: null };
}

/**
 * "The migration hasn't been applied yet" is not an incident.
 *
 * PGRST205 / PGRST202 are PostgREST's schema-cache misses, and 42P01 is
 * Postgres's own "undefined table". All three mean the same thing here.
 */
function isSchemaNoise(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("pgrst205") ||
    m.includes("pgrst202") ||
    m.includes("42p01") ||
    m.includes("could not find the table") ||
    m.includes("does not exist")
  );
}

function trim(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (v.length === 0) return null;
  return v.length > max ? `${v.slice(0, max)}…` : v;
}
