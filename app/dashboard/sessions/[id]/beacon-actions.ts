"use server";

import { revalidatePath } from "next/cache";
import {
  ensureLiveShare,
  revokeLiveShare,
  getLiveShareForSession,
  type LiveSessionShare,
} from "@/services/liveSessionShares";

export type BeaconState =
  | { ok: true; share: LiveSessionShare; shareUrl: string }
  | { ok: false; error: string };

const ERROR_COPY: Record<string, string> = {
  SESSION_NOT_FOUND: "We couldn't find that session.",
  FORBIDDEN:         "You can only share rides in your stable.",
  UNAUTHENTICATED:   "Your session expired. Sign in again.",
};

function url(token: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";
  return `${origin}/live/${token}`;
}

export async function ensureBeaconAction(sessionId: string): Promise<BeaconState> {
  try {
    const share = await ensureLiveShare(sessionId);
    revalidatePath(`/dashboard/sessions/${sessionId}`);
    return { ok: true, share, shareUrl: url(share.token) };
  } catch (err: any) {
    const code = err?.message ?? "";
    return { ok: false, error: ERROR_COPY[code] ?? `Could not start beacon: ${code || "unknown error"}.` };
  }
}

export async function getBeaconAction(sessionId: string): Promise<BeaconState> {
  try {
    const share = await getLiveShareForSession(sessionId);
    if (!share || share.revoked_at || new Date(share.expires_at) <= new Date()) {
      return { ok: false, error: "no_active_beacon" };
    }
    return { ok: true, share, shareUrl: url(share.token) };
  } catch (err: any) {
    const code = err?.message ?? "";
    return { ok: false, error: ERROR_COPY[code] ?? code };
  }
}

export async function revokeBeaconAction(sessionId: string): Promise<{ ok: boolean }> {
  try {
    await revokeLiveShare(sessionId);
    revalidatePath(`/dashboard/sessions/${sessionId}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
