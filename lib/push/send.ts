// Unified push sender — fans a notification out to a user's Web Push
// subscriptions (browser/PWA) AND their native APNs device tokens (iOS app).
// Fully dormant until VAPID keys and/or APNS_* env vars are set: with neither
// configured sendPushToUser is a no-op returning 0, so nothing breaks.

// @ts-ignore — optional dep: installed on Vercel, may be absent in the
// local sandbox. The directive is a no-op once the package resolves.
import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { apnsConfigured, sendApns } from "@/lib/push/apns";

export type PushPayload = { title: string; body: string; url?: string };

let configured = false;
function ensureWebConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@longrein.eu";
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return true;
}

function webConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** True when at least one delivery channel (web push or APNs) is configured. */
export function pushConfigured(): boolean {
  return webConfigured() || apnsConfigured();
}

/** Send a push to every channel a user has — web subscriptions + native APNs
 *  tokens. Dead endpoints (404/410) and dead APNs tokens are pruned. Returns
 *  how many messages were delivered. */
export async function sendPushToUser(authUserId: string, payload: PushPayload): Promise<number> {
  const supabase = createSupabaseAdminClient();
  let sent = 0;

  // ---- Web Push ----
  if (ensureWebConfigured()) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("auth_user_id", authUserId);
    for (const s of (subs ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
  }

  // ---- Native APNs (iOS app) ----
  if (apnsConfigured()) {
    const { data: rows } = await supabase
      .from("push_native_tokens")
      .select("token")
      .eq("auth_user_id", authUserId);
    const tokens = ((rows ?? []) as Array<{ token: string }>).map((r) => r.token);
    if (tokens.length > 0) {
      const results = await sendApns(tokens, payload);
      const dead: string[] = [];
      for (const r of results) {
        if (r.status === 200) sent += 1;
        else if (r.dead) dead.push(r.token);
      }
      if (dead.length > 0) {
        await supabase.from("push_native_tokens").delete().in("token", dead);
      }
    }
  }

  return sent;
}
