// Web Push sender. Dormant until VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are
// set in the environment — sendPushToUser then becomes a no-op returning 0,
// so nothing breaks before the keys exist.

// @ts-ignore — optional dep: installed on Vercel, may be absent in the
// local sandbox. The directive is a no-op once the package resolves.
import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type PushPayload = { title: string; body: string; url?: string };

let configured = false;
function ensureConfigured(): boolean {
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

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Send a push to every subscription a user has. Dead endpoints (404/410)
 *  are pruned. Returns how many were delivered. */
export async function sendPushToUser(authUserId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;
  const supabase = createSupabaseAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("auth_user_id", authUserId);

  let sent = 0;
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
  return sent;
}
