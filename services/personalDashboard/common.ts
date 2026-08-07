// Shared plumbing for the personal-dashboard services.
//
// Every function in this folder is called only from /personal, which is
// already behind the allowlist gate. They still call
// requirePersonalContext() themselves rather than trusting the caller:
// a service that is safe only because of where it happens to be imported
// is one refactor away from being unsafe.

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePersonalContext, type PersonalContext } from "@/lib/personal/access";
import { logAppError, describeError } from "@/lib/personal/error-log";

export type { PersonalContext };

/** Fallback when the stable has no timezone set. She operates in Vilnius. */
const DEFAULT_TZ = "Europe/Vilnius";

/**
 * Her stable's display timezone. Cached per request — several screens
 * need it and it never changes mid-render.
 */
export const getStableTimeZone = cache(async (): Promise<string> => {
  try {
    const ctx = await requirePersonalContext();
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("stables")
      .select("timezone")
      .eq("id", ctx.stableId)
      .maybeSingle();
    const tz = data?.timezone;
    // Guard against a junk value in the column — an invalid IANA name
    // makes every Intl call throw, which would blank the whole dashboard.
    if (tz && isValidTimeZone(tz)) return tz;
  } catch {
    /* fall through */
  }
  return DEFAULT_TZ;
});

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a query, and on ANY failure return a fallback instead of throwing.
 *
 * This dashboard aggregates a dozen independent sources. If the
 * Instagram token is stale, or a table hasn't been migrated yet, the
 * right outcome is one empty card — not a 500 that hides the five
 * sections that were working fine. Each section fails alone.
 */
export async function safe<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Visible in Vercel logs without being visible to her.
    console.error(`[personal-dashboard] ${label} failed:`, err);
    // …and counted, so the "klaidos per 24 h" card has a real source.
    // Not awaited: recording a failure must never slow down or break the
    // fallback path it is describing.
    const { message, stack } = describeError(err);
    void logAppError({ scope: "personal", route: label, message, stack });
    return fallback;
  }
}

/** The numeric value of a possibly-null numeric column. */
export function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

export { requirePersonalContext };
