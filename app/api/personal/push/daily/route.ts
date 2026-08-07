// =============================================================
// GET /api/personal/push/daily
//
// The morning notification. Fires once a day and sends each allowlisted
// operator a one-line summary of their day: today's lesson count, how
// many clients have gone quiet, and the headline from the Gmail briefing
// if the scheduled task has posted one.
//
// SCHEDULE
// Configured in vercel.json as `0 5 * * *`, which is UTC. That is 08:00
// in Vilnius during summer time and 07:00 in winter — the spec asked for
// 8 AM local, and Vercel crons only speak UTC, so this is the closest
// fixed expression. Erring early is the right side to err on for a
// morning briefing.
//
// AUTH
// Bearer CRON_SECRET when that variable is set. When it is NOT set, a
// request carrying Vercel's own `x-vercel-cron` header is accepted, so
// the job works from the first deploy without anyone needing laptop
// access to the Vercel dashboard. Setting CRON_SECRET tightens it.
//
// Belt and braces regardless of auth: sending is idempotent per calendar
// day per user. A second call on the same day is a no-op. So the worst a
// caller who somehow reached this endpoint could do is deliver the one
// notification that was going to be delivered anyway.
// =============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { sendPersonalPush } from "@/lib/personal/push";
import {
  getIntegrationConfigForUser,
  saveIntegrationConfigForUser,
} from "@/services/personalDashboard/settings";
import { localDateKey, REENGAGEMENT_DAYS } from "@/services/personalDashboard/core.pure";
import { captureAudienceSnapshot } from "@/services/personalDashboard/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TZ = "Europe/Vilnius";

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;

  const authorized = expected ? auth === `Bearer ${expected}` : isVercelCron;
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  // `force` re-sends today's notification. Only ever available to a
  // caller holding the real secret — it is the one path that can bypass
  // the once-a-day guard.
  const force =
    Boolean(expected) &&
    auth === `Bearer ${expected}` &&
    new URL(request.url).searchParams.get("force") === "1";

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const today = localDateKey(now, TZ);

  const { data: recipients, error } = await admin
    .from("dashboard_access")
    .select("auth_user_id")
    .eq("enabled", true);

  if (error) {
    console.error("[personal-push] recipient lookup failed:", error);
    return NextResponse.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const r of recipients ?? []) {
    const userId = String(r.auth_user_id);

    const pushCfg = await getIntegrationConfigForUser(userId, "push");
    if (!force && pushCfg?.lastBriefingPushOn === today) {
      results.push({ user: redact(userId), skipped: "already sent today" });
      continue;
    }

    // Sample the follower count once a day, so growth goals accumulate a
    // baseline without her having to open the Marketing screen.
    await captureAudienceSnapshot(userId, now);

    const payload = await buildPayload(admin, userId, now, today);
    const sent = await sendPersonalPush(userId, payload);

    // Record the day even when nothing was delivered (no subscriptions
    // yet). Otherwise a retry loop would rebuild the payload — several
    // queries — on every call, all day, for a user with no devices.
    await saveIntegrationConfigForUser(userId, "push", { lastBriefingPushOn: today });

    results.push({ user: redact(userId), ...sent });
  }

  return NextResponse.json({ ok: true, on: today, results });
}

/**
 * The one line she reads before getting out of bed.
 *
 * Built with the admin client because a cron has no session. Only
 * aggregate counts and her own briefing text are read — nothing about
 * any other tenant.
 */
async function buildPayload(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
  now: Date,
  today: string,
): Promise<{ title: string; body: string; url: string; tag: string }> {
  const parts: string[] = [];

  const { data: profile } = await admin
    .from("profiles")
    .select("stable_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const stableId = profile?.stable_id as string | undefined;

  if (stableId) {
    // Today's lessons, in her stable, in her timezone. The day boundary
    // is computed from the local date key rather than from UTC midnight —
    // a 21:00 lesson in Vilnius is tomorrow in UTC during summer.
    const dayStart = new Date(`${today}T00:00:00`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const { count: lessonCount } = await admin
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("stable_id", stableId)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .in("status", ["scheduled", "completed"]);

    if (typeof lessonCount === "number") {
      parts.push(lessonCount === 0 ? "Treniruočių nėra" : `${lessonCount} treniruotės`);
    }

    // Clients who have gone quiet. Read from the migration-110 view so
    // the definition matches exactly what the TJK screen shows — two
    // different definitions of "hasn't ridden lately" on the same
    // dashboard would be worse than not having the number.
    //
    // The view is security_invoker, and the service-role client bypasses
    // RLS, so it returns every tenant's clients. Scoping to her stable is
    // therefore mandatory, not an optimisation.
    const cutoff = new Date(now.getTime() - REENGAGEMENT_DAYS * 86_400_000).toISOString();
    const { count: quietCount } = await admin
      .from("dashboard_client_last_ride")
      .select("client_id", { count: "exact", head: true })
      .eq("stable_id", stableId)
      .eq("active", true)
      .or(`last_ride_at.is.null,last_ride_at.lt.${cutoff}`);

    if (typeof quietCount === "number" && quietCount > 0) {
      parts.push(`${quietCount} laukia skambučio`);
    }
  }

  const { data: briefing } = await admin
    .from("dashboard_daily_briefings")
    .select("summary, briefing_on")
    .eq("auth_user_id", authUserId)
    .order("briefing_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (briefing?.summary && briefing.briefing_on === today) {
    parts.push(String(briefing.summary).slice(0, 120));
  }

  return {
    title: "Labas rytas, Andrėja",
    body: parts.length > 0 ? parts.join(" · ") : "Atidaryk — šiandienos apžvalga laukia.",
    url: "/personal",
    // Same tag every day: a notification she didn't read is replaced by
    // today's rather than stacking up into a wall of stale mornings.
    tag: "personal-daily",
  };
}

/** Never put a raw user id in a response body, even an authenticated one. */
function redact(id: string): string {
  return `${id.slice(0, 8)}…`;
}
