// Web Push for the private command centre.
//
// Separate from lib/push/send.ts on purpose. That module serves the
// product: it fans lesson reminders out to customers across Web Push and
// APNs, and it is dormant unless VAPID_* env vars are set on Vercel.
//
// This one has a different constraint. She cannot set a Vercel env var
// from her phone, and requiring a laptop + a redeploy to turn on her own
// morning notification would mean the feature ships switched off forever.
// So the VAPID keypair is GENERATED on first use and stored in
// dashboard_integration_settings, exactly like every other credential on
// this dashboard.
//
// Why that's acceptable: a VAPID private key does not grant access to
// anything. It only proves to a push service that the sender is the same
// party the browser subscribed to. Losing it means subscriptions must be
// re-created; it does not expose data. The same key is used to subscribe
// and to send, so it must be stable — hence stored, not derived.
//
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in the environment still win when
// they are set, so a future deploy that configures them properly takes
// over without a migration.

// @ts-ignore — optional dep: installed on Vercel, may be absent in a
// local sandbox. The directive is a no-op once the package resolves.
import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getIntegrationConfigForUser,
  saveIntegrationConfigForUser,
} from "@/services/personalDashboard/settings";

export type PersonalPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

const DEFAULT_SUBJECT = "mailto:hello@longrein.eu";

/**
 * The keypair for this user, generating and persisting one if none
 * exists yet.
 *
 * Generation is a write, so this must never be called from a plain page
 * render — only from the subscribe endpoint and the sender.
 */
export async function ensureVapidKeys(authUserId: string): Promise<VapidKeys | null> {
  try {
    const cfg = await getIntegrationConfigForUser(authUserId, "push");
    const publicKey = str(cfg?.publicKey);
    const privateKey = str(cfg?.privateKey);
    const subject = str(cfg?.subject) || DEFAULT_SUBJECT;

    if (publicKey && privateKey) return { publicKey, privateKey, subject };

    // A half-configured pair (one key present, the other missing) is
    // unusable and would produce confusing 403s from the push service.
    // Replace it wholesale.
    const generated = webpush.generateVAPIDKeys();
    await saveIntegrationConfigForUser(authUserId, "push", {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject,
    });
    return {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject,
    };
  } catch (err) {
    console.error("[personal-push] could not resolve VAPID keys:", err);
    return null;
  }
}

/** Read-only variant — never generates. Used by the sender, which must
 *  not invent a new keypair that no existing subscription matches. */
export async function getVapidKeys(authUserId: string): Promise<VapidKeys | null> {
  const cfg = await getIntegrationConfigForUser(authUserId, "push");
  const publicKey = str(cfg?.publicKey);
  const privateKey = str(cfg?.privateKey);
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: str(cfg?.subject) || DEFAULT_SUBJECT };
}

export type SendResult = {
  sent: number;
  pruned: number;
  failed: number;
};

/**
 * Deliver a notification to every device she has subscribed.
 *
 * Endpoints that the push service reports as gone (404/410) are deleted:
 * a stale subscription from a reinstalled PWA otherwise sticks around
 * forever and makes "sent 3" mean "delivered 1".
 */
export async function sendPersonalPush(
  authUserId: string,
  payload: PersonalPushPayload,
): Promise<SendResult> {
  const keys = await getVapidKeys(authUserId);
  if (!keys) return { sent: 0, pruned: 0, failed: 0 };

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  const admin = createSupabaseAdminClient();
  const { data: subs, error } = await admin
    .from("dashboard_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("auth_user_id", authUserId);

  if (error || !subs || subs.length === 0) return { sent: 0, pruned: 0, failed: 0 };

  let sent = 0;
  let pruned = 0;
  let failed = 0;

  for (const s of subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
      await admin
        .from("dashboard_push_subscriptions")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", s.id);
    } catch (err: any) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("dashboard_push_subscriptions").delete().eq("id", s.id);
        pruned += 1;
      } else {
        failed += 1;
        console.error("[personal-push] send failed:", code ?? err?.message ?? err);
      }
    }
  }

  return { sent, pruned, failed };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
