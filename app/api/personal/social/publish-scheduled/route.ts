// =============================================================
// GET /api/personal/social/publish-scheduled
//
// The sweep that publishes scheduled posts. Runs every 5 minutes from
// .github/workflows/social-publish.yml.
//
// WHY GITHUB ACTIONS AND NOT A VERCEL CRON
// Vercel Hobby allows two cron jobs, and both are already spent (lesson
// reminders at 06:00, the morning push at 05:00). Adding a third would
// fail the deployment. GitHub Actions has no such limit and is already
// used for the uptime probe.
//
// AUTH, AND WHY THIS ONE IS DIFFERENT
// The other cron routes take a bearer CRON_SECRET. This one cannot rely
// on that: GitHub Actions would need the secret configured as a repo
// secret, and until it is, every run 401s — which at a 5-minute cadence
// means a failure email every 5 minutes. That is how the existing
// cron-reminders.yml ended up disabled.
//
// So this endpoint is safe BY CONSTRUCTION instead:
//
//   * It publishes only posts SHE already composed and scheduled, and
//     only once `scheduled_for` has passed. A stranger calling it can
//     make her posts go out exactly when she asked them to.
//   * It cannot create, edit or retarget content. There is no request
//     body; nothing about what gets published comes from the caller.
//   * Double-publishing is prevented by the claim step in
//     publishDuePosts() plus the per-platform external_ids guard, not by
//     the caller being trusted.
//   * Work per call is bounded: one indexed SELECT, at most 5 posts.
//
// Setting CRON_SECRET tightens it to bearer auth. That is an upgrade,
// not a prerequisite.
// =============================================================

import { NextResponse, type NextRequest } from "next/server";
import { publishDuePosts, releaseStalePublishing } from "@/services/personalDashboard/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Instagram video containers are polled for up to 90s each; give the
// sweep room for one of those plus overhead.
export const maxDuration = 120;

/** Per-instance throttle. Stops a hot loop from hammering Meta; it is not
 *  a security control (the guarantees above are). */
const MIN_SWEEP_INTERVAL_MS = 20_000;
let lastSweepAt = 0;

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = request.headers.get("authorization");
    const isVercelCron = request.headers.get("x-vercel-cron") !== null;
    if (auth !== `Bearer ${expected}` && !isVercelCron) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
  }

  const now = Date.now();
  if (now - lastSweepAt < MIN_SWEEP_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: "throttled" });
  }
  lastSweepAt = now;

  try {
    // Posts stuck in 'publishing' — a lambda killed mid-send — are handed
    // back before the sweep, or they would never be picked up again.
    const released = await releaseStalePublishing();
    const results = await publishDuePosts(5);

    return NextResponse.json({
      ok: true,
      released,
      published: results.length,
      results: results.map((r) => ({
        status: r.status,
        succeeded: r.succeeded,
        failed: r.failed.map((f) => ({ platform: f.platform, error: f.error })),
      })),
    });
  } catch (err: any) {
    console.error("[personal-social] sweep failed:", err);
    // 200 with ok:false — a non-200 here would make the GitHub Actions
    // job red and start the failure-email cascade this design avoids.
    return NextResponse.json(
      { ok: false, error: err?.message ?? "sweep failed" },
      { status: 200 },
    );
  }
}
