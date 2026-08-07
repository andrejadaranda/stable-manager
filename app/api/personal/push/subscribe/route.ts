// Subscribe / unsubscribe the command centre's push notifications.
//
//   GET    → the VAPID public key the browser needs to subscribe with,
//            generating the keypair on first call.
//   POST   → store a PushSubscription.
//   DELETE → forget one (the unsubscribe path).
//
// Every method is behind requirePersonalContext(), and every write is
// keyed on the caller's own auth user id — never on anything in the
// request body. A route handler is a public HTTP endpoint; "only our own
// component calls it" is not access control.

import { NextResponse, type NextRequest } from "next/server";
import { getPersonalContext } from "@/lib/personal/access";
import { ensureVapidKeys } from "@/lib/personal/push";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getPersonalContext();
  // 404, not 403 — consistent with the route itself, which does not
  // admit to existing for anyone who isn't allowlisted.
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  const keys = await ensureVapidKeys(ctx.authUserId);
  if (!keys) {
    return NextResponse.json({ error: "vapid unavailable" }, { status: 503 });
  }
  // Only ever the public half.
  return NextResponse.json({ publicKey: keys.publicKey });
}

export async function POST(request: NextRequest) {
  const ctx = await getPersonalContext();
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "incomplete subscription" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("dashboard_push_subscriptions").upsert(
    {
      auth_user_id: ctx.authUserId,
      endpoint,
      p256dh,
      auth,
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
    },
    // Endpoint is unique table-wide: re-subscribing the same device
    // updates its keys instead of accumulating a duplicate row.
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[personal-push] subscribe failed:", error);
    return NextResponse.json({ error: "could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getPersonalContext();
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  let endpoint = "";
  try {
    const body = await request.json();
    endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  } catch {
    /* no body — fall through to "remove all this user's devices" */
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("dashboard_push_subscriptions")
    .delete()
    .eq("auth_user_id", ctx.authUserId);
  // Scoping by auth_user_id as well as endpoint matters: without it, a
  // caller could unsubscribe someone else's device by guessing its
  // endpoint URL.
  if (endpoint) query = query.eq("endpoint", endpoint);

  const { error } = await query;
  if (error) {
    console.error("[personal-push] unsubscribe failed:", error);
    return NextResponse.json({ error: "could not remove" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
