// Ingest endpoint for the daily inbox briefing.
//
// The recurring `tjk-daily-inbox-check` job POSTs its summary here. It
// runs outside a browser session, so it can't use cookie auth — it
// authenticates with a shared secret in the Authorization header and the
// row is written with the service-role client.
//
// Security properties:
//   * No secret configured => 404. The endpoint doesn't exist until it's
//     deliberately switched on.
//   * Constant-time secret comparison, so response timing can't be used
//     to guess the secret byte by byte.
//   * The target user is resolved from dashboard_access (enabled rows
//     only), NOT from the request body. A caller holding the secret can
//     write a briefing; it cannot choose whose dashboard to write it to.
//   * Write-only. This route never returns briefing content.

import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IncomingItem = {
  title?: unknown;
  detail?: unknown;
  urgency?: unknown;
  action_url?: unknown;
};

export async function POST(request: NextRequest) {
  const secret = process.env.PERSONAL_BRIEFING_SECRET;
  if (!secret) {
    // Not configured — behave as if the route isn't there.
    return new NextResponse("Not found", { status: 404 });
  }

  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(provided, secret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: {
    briefing_on?: unknown;
    summary?: unknown;
    items?: unknown;
    source?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const briefingOn =
    typeof body.briefing_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.briefing_on)
      ? body.briefing_on
      : new Date().toISOString().slice(0, 10);

  const summary = typeof body.summary === "string" ? body.summary.slice(0, 4000) : null;
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "gmail";
  const items = normaliseItems(body.items);

  const admin = createSupabaseAdminClient();

  // Recipients come from the allowlist, never from the payload.
  const { data: recipients, error: recipientsError } = await admin
    .from("dashboard_access")
    .select("auth_user_id")
    .eq("enabled", true);

  if (recipientsError) {
    console.error("[personal-briefing] recipient lookup failed:", recipientsError);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!recipients || recipients.length === 0) {
    // Nobody is allowlisted — accept and drop, rather than erroring a cron
    // job every morning over a state that is intentional.
    return NextResponse.json({ ok: true, written: 0 });
  }

  const { error } = await admin.from("dashboard_daily_briefings").upsert(
    recipients.map((r) => ({
      auth_user_id: r.auth_user_id,
      briefing_on: briefingOn,
      source,
      summary,
      items,
    })),
    { onConflict: "auth_user_id,briefing_on,source" },
  );

  if (error) {
    console.error("[personal-briefing] write failed:", error);
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, written: recipients.length });
}

/** Constant-time compare that doesn't leak length through an early return. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still burn a comparison so the mismatch-length path isn't faster.
    timingSafeEqual(bb, bb);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function normaliseItems(raw: unknown): IncomingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
    .map((e) => ({
      title: typeof e.title === "string" ? e.title.slice(0, 300) : "",
      detail: typeof e.detail === "string" ? e.detail.slice(0, 1000) : undefined,
      urgency:
        e.urgency === "high" || e.urgency === "low" || e.urgency === "normal"
          ? e.urgency
          : "normal",
      action_url: typeof e.action_url === "string" ? e.action_url.slice(0, 500) : undefined,
    }))
    .filter((e) => e.title)
    .slice(0, 30);
}
