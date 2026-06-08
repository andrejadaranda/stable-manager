// POST   /api/push/subscribe — save the caller's Web Push subscription.
// DELETE /api/push/subscribe — remove it (on un-subscribe).
// Auth comes from the session cookie; the row is owned by auth_user_id.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let session;
  try {
    session = await getSession();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Bad subscription." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      auth_user_id: session.userId,
      stable_id:    (session as { stableId?: string }).stableId ?? null,
      endpoint:     sub.endpoint,
      p256dh:       sub.keys.p256dh,
      auth:         sub.keys.auth,
      user_agent:   req.headers.get("user-agent")?.slice(0, 255) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  try {
    await getSession();
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = createSupabaseServerClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
