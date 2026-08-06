// =============================================================
// GET /api/keepalive
//
// Keeps the Supabase project awake. Free-tier Supabase projects auto-pause
// after ~7 days without database activity; once paused, the whole app
// returns 504 (the auth middleware can't reach the DB) until it's restored.
// A tiny scheduled ping that actually TOUCHES the database resets that
// inactivity timer so the live App Store app never goes dark.
//
// Deliberately PUBLIC (no CRON_SECRET): the reminders cron is gated behind
// the secret and 401s before it ever queries the DB, so it can't keep the
// project warm. This route runs a trivial SELECT and always returns HTTP
// 200 (even on error) so the scheduler never records a "failed run" and
// never emails a failure notice.
// =============================================================

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    // A minimal read — enough DB activity to reset the pause timer.
    const { error } = await supabase.from("stables").select("id").limit(1);
    return NextResponse.json(
      { ok: !error, at: new Date().toISOString(), error: error?.message ?? null },
      { status: 200 },
    );
  } catch (err: any) {
    // Never surface a non-200 — a failed scheduled ping would spam emails.
    return NextResponse.json(
      { ok: false, at: new Date().toISOString(), error: err?.message ?? "keepalive error" },
      { status: 200 },
    );
  }
}
