// POST   /api/push/register-native — save the caller's APNs device token.
// DELETE /api/push/register-native — remove it (on sign-out / unsubscribe).
//
// The native iOS app calls registerPushNative() (lib/native) on launch to
// obtain an APNs token, then POSTs it here. Keyed by auth_user_id (=auth.uid())
// so it matches the id the reminders cron passes to sendPushToUser(). Dormant
// on the current build — the app only returns a token once the Push
// Notifications capability ships (build 5).

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

  const { token, platform } = (await req.json().catch(() => ({}))) as {
    token?: string;
    platform?: string;
  };
  if (!token || token.length < 20) {
    return NextResponse.json({ ok: false, error: "Bad token." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("push_native_tokens").upsert(
    {
      auth_user_id: session.authUserId,
      token,
      platform:     platform === "android" ? "android" : "ios",
      stable_id:    session.stableId ?? null,
      updated_at:   new Date().toISOString(),
    },
    { onConflict: "token" },
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
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = createSupabaseServerClient();
  await supabase.from("push_native_tokens").delete().eq("token", token);
  return NextResponse.json({ ok: true });
}
