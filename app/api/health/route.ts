// =============================================================
// GET /api/health
//
// The uptime source for the personal dashboard's "Veikimas" card, and a
// standard health endpoint any external monitor (BetterStack, UptimeRobot,
// Vercel checks) can be pointed at without further setup.
//
// It does two things on each call:
//   1. Answers honestly — 200 when the database is reachable, 503 when it
//      is not. External monitors need the status code to mean something,
//      which is why this route does NOT follow /api/keepalive's
//      always-200 convention.
//   2. Records the result in dashboard_health_checks, which is what makes
//      an uptime percentage computable at all. See the header comment on
//      migration 111 for why a MISSING row is the outage signal.
//
// Deliberately public, like /api/keepalive: a health check behind a secret
// can't be consumed by the third-party monitors that would use it, and it
// exposes nothing — a boolean and a latency figure.
//
// Public also means abusable, so writes are capped at one row per minute
// by a unique index (migration 113). That cap is not cosmetic: uptime is
// "pings received / pings expected", so unlimited extra rows would pin
// the card at a permanent, meaningless 100%.
// =============================================================

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How long health history is kept. Long enough for the 7-day card,
 *  short enough that the table never becomes a storage concern. */
const RETENTION_DAYS = 30;

export async function GET() {
  const startedAt = Date.now();
  let ok = false;
  let detail: string | null = null;

  const admin = createSupabaseAdminClient();

  try {
    // A real query against a real table. Anything less (returning a
    // constant, pinging the process) would report "healthy" during
    // exactly the outage this is meant to catch — a paused or
    // unreachable Supabase project.
    const { error } = await admin.from("stables").select("id").limit(1);
    ok = !error;
    detail = error?.message ?? null;
  } catch (err: any) {
    ok = false;
    detail = err?.message ?? "health probe threw";
  }

  const latencyMs = Date.now() - startedAt;

  // Recording is best-effort. If the table isn't there yet (migration 111
  // not applied) or the write fails, the health answer itself is still
  // correct and still served.
  try {
    // Insert unconditionally. The throttle is the unique index on
    // `checked_minute` from migration 113, NOT a check performed here.
    //
    // There WAS a check here — read the newest row, skip if under a
    // minute old — and it did not hold in production: five requests two
    // seconds apart produced five rows. That is the expected weakness of
    // read-then-write across concurrent stateless instances (two callers
    // can both read "last row is old" before either writes), so it was
    // replaced rather than debugged. A duplicate-key error is the
    // success case here and is deliberately swallowed.
    await admin.from("dashboard_health_checks").insert({
      ok,
      latency_ms: latencyMs,
      detail: detail ? String(detail).slice(0, 500) : null,
    });

    // Prune roughly once an hour rather than on every request.
    if (new Date().getUTCMinutes() < 5) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
      await admin.from("dashboard_health_checks").delete().lt("checked_at", cutoff);
    }
  } catch {
    /* recording is not the job; answering is */
  }

  return NextResponse.json(
    { ok, latencyMs, at: new Date().toISOString(), error: ok ? null : detail },
    { status: ok ? 200 : 503 },
  );
}
