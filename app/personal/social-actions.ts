"use server";

// Server actions for the social composer.
//
// In their own file rather than actions.ts because that module is
// imported by every screen for its `ActionResult` type, and pulling the
// Anthropic SDK into that import graph would put it on the server bundle
// of pages that have nothing to do with captions.
//
// Every action goes through a service that calls requirePersonalContext()
// itself. A server action is a public HTTP endpoint.

import { revalidatePath } from "next/cache";
import {
  savePost,
  deletePost,
  publishNow,
  generateCaption,
  type PostStatus,
} from "@/services/personalDashboard/social";
import {
  exchangeForLongLivedTokens,
  type PlatformKey,
  type MediaItem,
} from "@/lib/personal/publish";
import { requirePersonalContext } from "@/lib/personal/access";
import { saveIntegrationConfig } from "@/services/personalDashboard/settings";
import type { ActionResult } from "@/app/personal/actions";

const VALID_PLATFORMS: PlatformKey[] = [
  "instagram_feed",
  "instagram_story",
  "facebook_page",
];

export type SavePostInput = {
  id?: string;
  platforms: string[];
  content: string;
  media: MediaItem[];
  scheduledFor?: string | null;
};

export async function savePostAction(
  input: SavePostInput,
): Promise<ActionResult & { id?: string }> {
  try {
    const platforms = input.platforms.filter((p): p is PlatformKey =>
      VALID_PLATFORMS.includes(p as PlatformKey),
    );
    if (platforms.length === 0) {
      return { ok: false, error: "Pasirink bent vieną platformą." };
    }
    if (!input.content.trim() && input.media.length === 0) {
      return { ok: false, error: "Įrašas tuščias." };
    }

    // Instagram has no text-only post. Catching it here means she finds
    // out while composing rather than from a failed publish at 07:00.
    const needsMedia = platforms.some((p) => p.startsWith("instagram"));
    if (needsMedia && input.media.length === 0) {
      return { ok: false, error: "Instagram reikalauja nuotraukos ar video." };
    }

    if (input.scheduledFor) {
      const when = new Date(input.scheduledFor);
      if (Number.isNaN(when.getTime())) {
        return { ok: false, error: "Netinkamas laikas." };
      }
      // One minute of slack: "schedule for 5 minutes from now" typed
      // slowly should not be rejected for being in the past.
      if (when.getTime() < Date.now() - 60_000) {
        return { ok: false, error: "Laikas jau praėjo — pasirink ateities laiką." };
      }
    }

    const id = await savePost({
      id: input.id,
      platforms,
      content: input.content,
      media: sanitiseMedia(input.media),
      scheduledFor: input.scheduledFor ?? null,
    });

    revalidatePath("/personal/social");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function publishNowAction(id: string): Promise<ActionResult> {
  try {
    const summary = await publishNow(id);
    revalidatePath("/personal/social");

    if (summary.status === "published") return { ok: true };

    // Partial success is reported as a failure on purpose: "posted to 2
    // of 3" needs her attention, and a green tick would hide it.
    const detail = summary.failed
      .map((f) => `${platformLabel(f.platform)}: ${f.error}`)
      .join(" · ");
    return {
      ok: false,
      error: summary.succeeded.length
        ? `Paskelbta tik dalyje. ${detail}`
        : detail || "Nepavyko paskelbti.",
    };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function deletePostAction(id: string): Promise<ActionResult> {
  try {
    await deletePost(id);
    revalidatePath("/personal/social");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

export async function generateCaptionAction(
  brief: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    await requirePersonalContext();
    if (!brief.trim()) {
      return { ok: false, error: "Parašyk, apie ką įrašas." };
    }
    const text = await generateCaption(brief);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

/**
 * Turn a short-lived Meta token into the long-lived Page tokens the
 * dashboard needs, and store them.
 *
 * This is the step that otherwise means hand-assembling a Graph API URL
 * with an app secret in the query string — the fiddliest part of
 * connecting Meta and the one most likely to be got wrong. The app
 * secret is used for the exchange and deliberately NOT stored: it is not
 * needed again, and keeping it would be a credential held for no reason.
 */
export async function connectMetaAction(formData: FormData): Promise<ActionResult> {
  try {
    await requirePersonalContext();

    const appId = String(formData.get("appId") ?? "").trim();
    const appSecret = String(formData.get("appSecret") ?? "").trim();
    const shortLivedToken = String(formData.get("shortLivedToken") ?? "").trim();

    if (!appId || !appSecret || !shortLivedToken) {
      return { ok: false, error: "Reikia visų trijų laukų." };
    }

    const result = await exchangeForLongLivedTokens({ appId, appSecret, shortLivedToken });
    if (!result.ok) return { ok: false, error: result.error };

    if (result.pages.length === 0) {
      return {
        ok: false,
        error: "Šis tokenas nevaldo nė vieno puslapio. Patikrink, ar davei teises pages_show_list.",
      };
    }

    // If she administers several pages, the one she named wins; otherwise
    // the only one there is.
    const wanted = String(formData.get("pageId") ?? "").trim();
    const page =
      (wanted ? result.pages.find((p) => p.id === wanted) : null) ?? result.pages[0];

    await saveIntegrationConfig("facebook", {
      pageId: page.id,
      pageName: page.name,
      accessToken: page.accessToken,
    });

    if (page.igUserId) {
      await saveIntegrationConfig("instagram", {
        igUserId: page.igUserId,
        accessToken: page.accessToken,
      });
    }

    revalidatePath("/personal/nustatymai");
    revalidatePath("/personal/social");
    revalidatePath("/personal/marketing");

    return page.igUserId
      ? { ok: true }
      : {
          ok: false,
          error: `Facebook puslapis „${page.name}" prijungtas, bet prie jo nerastas Instagram Business profilis. Susiek juos Meta Business Suite ir bandyk dar kartą.`,
        };
  } catch (err) {
    return { ok: false, error: message(err) };
  }
}

// -------------------------------------------------------------------

/** Media arrives from a client component, so treat it as untrusted. Only
 *  our own storage bucket is accepted as a source. */
function sanitiseMedia(media: MediaItem[]): MediaItem[] {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return media
    .filter((m) => typeof m?.url === "string" && m.url.startsWith(`${base}/storage/v1/object/public/personal-social/`))
    .map((m): MediaItem => ({ url: m.url, type: m.type === "video" ? "video" : "image" }))
    .slice(0, 10);
}

function platformLabel(p: string): string {
  if (p === "instagram_feed") return "Instagram";
  if (p === "instagram_story") return "Story";
  if (p === "facebook_page") return "Facebook";
  return p;
}

function message(err: unknown): string {
  if (err instanceof Error && err.message === "NOT_FOUND") return "Nerasta.";
  return err instanceof Error ? err.message : "Įvyko klaida.";
}

export type { PostStatus };
