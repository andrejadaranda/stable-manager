// Access gate for the private command centre at /personal.
//
// This dashboard is NOT a product feature. It is one person's cockpit.
// Every other Longrein user — including other stable owners, including
// admins — must get a plain 404, not a 403: a 403 confirms the route
// exists, which is information a private page shouldn't leak.
//
// The allowlist lives in the `dashboard_access` table (migration 110),
// deliberately NOT in an env var. Two reasons:
//
//   1. Kill switch without a redeploy. Vercel env changes only take
//      effect on the next deployment; a DB row takes effect on the next
//      request. If this dashboard ever misbehaves it can be switched off
//      from a phone in ten seconds.
//   2. Single source of truth. The same `dashboard_is_allowed()`
//      predicate backs the RLS policy on every dashboard_* table, so
//      revoking access cuts off the data as well as the UI. An env var
//      could not be referenced from a Postgres policy.
//
// An empty `dashboard_access` table means nobody has access. That is the
// state this ships in — the feature is off for everyone, including her,
// until one row is inserted by hand.

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PersonalContext = {
  authUserId: string;
  profileId: string;
  stableId: string;
  fullName: string | null;
  email: string;
};

/**
 * Resolve the caller's personal-dashboard context, or null if they are
 * not allowlisted / not signed in / the table doesn't exist yet.
 *
 * Never throws — an infrastructure hiccup must fail CLOSED (404), not
 * open. Wrapped in React's `cache` so the layout and the page in the
 * same render share one round trip.
 */
export const getPersonalContext = cache(
  async (): Promise<PersonalContext | null> => {
    try {
      const supabase = createSupabaseServerClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // The allowlist check. RLS on dashboard_access already restricts
      // this to the caller's own row, so `maybeSingle()` either returns
      // their row or nothing — there is no way to probe for others.
      const { data: access, error: accessError } = await supabase
        .from("dashboard_access")
        .select("enabled")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      // Missing table (migration not applied yet) lands here too. Deny.
      if (accessError || !access?.enabled) return null;

      // She is a normal Longrein user as well — we need her profile for
      // stable-scoped queries (her TJK stable).
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, stable_id, full_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile?.stable_id) return null;

      return {
        authUserId: user.id,
        profileId: profile.id,
        stableId: profile.stable_id,
        fullName: profile.full_name ?? null,
        email: user.email ?? "",
      };
    } catch {
      // Fail closed. A thrown error here would render a 500 that
      // confirms the route exists.
      return null;
    }
  },
);

/**
 * Server-action / route-handler guard. Throws a generic error rather
 * than returning null so callers can't accidentally continue past it.
 */
export async function requirePersonalContext(): Promise<PersonalContext> {
  const ctx = await getPersonalContext();
  if (!ctx) throw new Error("NOT_FOUND");
  return ctx;
}
