// Compose, schedule and publish — the write side of social.
//
// The important design decision is in publishOne(): a post that targets
// three platforms is ONE row, and each platform's outcome is recorded
// separately in `external_ids` and `last_errors`. That is what makes a
// retry safe. A naive retry of a multi-platform post re-sends to the
// platforms that already succeeded, which means the followers who saw it
// the first time see it twice — the single worst failure mode this
// feature has. Skipping anything already in `external_ids` removes it.

import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { requirePersonalContext, safe, num } from "@/services/personalDashboard/common";
import {
  getIntegrationConfig,
  getIntegrationConfigForUser,
} from "@/services/personalDashboard/settings";
import {
  publishInstagram,
  publishFacebookPage,
  fetchInstagramAudience,
  type PlatformKey,
  type MediaItem,
  type PublishResult,
} from "@/lib/personal/publish";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partial"
  | "failed";

export type QueuedPost = {
  id: string;
  platforms: PlatformKey[];
  content: string;
  media: MediaItem[];
  status: PostStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  externalIds: Record<string, string>;
  lastErrors: Record<string, string>;
  attempts: number;
  createdAt: string;
};

export const PLATFORMS: Array<{ key: PlatformKey; label: string; note: string }> = [
  { key: "instagram_feed", label: "Instagram", note: "Įrašas sraute · 1:1 arba 4:5" },
  { key: "instagram_story", label: "Instagram Story", note: "9:16 · be teksto po įrašu" },
  { key: "facebook_page", label: "Facebook", note: "Puslapio įrašas · galima ir be nuotraukos" },
];

/** Give up after this many sweeps so one poisoned post doesn't retry forever. */
const MAX_ATTEMPTS = 4;

// -------------------------------------------------------------------
// Reads
// -------------------------------------------------------------------

export async function listPosts(limit = 40): Promise<QueuedPost[]> {
  return safe<QueuedPost[]>(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from("dashboard_social_queue")
        .select(
          "id, platforms, content, media, status, scheduled_for, published_at, external_ids, last_errors, attempts, created_at",
        )
        .eq("auth_user_id", ctx.authUserId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map(toPost);
    },
    [],
    "listPosts",
  );
}

export async function getPost(id: string): Promise<QueuedPost | null> {
  return safe<QueuedPost | null>(
    async () => {
      const ctx = await requirePersonalContext();
      const supabase = createSupabaseServerClient();
      const { data } = await supabase
        .from("dashboard_social_queue")
        .select(
          "id, platforms, content, media, status, scheduled_for, published_at, external_ids, last_errors, attempts, created_at",
        )
        .eq("auth_user_id", ctx.authUserId)
        .eq("id", id)
        .maybeSingle();
      return data ? toPost(data) : null;
    },
    null,
    "getPost",
  );
}

/** Which platforms have usable credentials right now. Drives the
 *  composer's connect prompts instead of letting her compose into a void. */
export async function getPublishTargets(): Promise<Record<PlatformKey, boolean>> {
  return safe<Record<PlatformKey, boolean>>(
    async () => {
      const [ig, fb] = await Promise.all([
        getIntegrationConfig("instagram"),
        getIntegrationConfig("facebook"),
      ]);
      const igReady = Boolean(ig?.accessToken && ig?.igUserId);
      return {
        instagram_feed: igReady,
        instagram_story: igReady,
        facebook_page: Boolean(fb?.accessToken && fb?.pageId),
      };
    },
    { instagram_feed: false, instagram_story: false, facebook_page: false },
    "getPublishTargets",
  );
}

// -------------------------------------------------------------------
// Writes
// -------------------------------------------------------------------

export async function savePost(input: {
  id?: string;
  platforms: PlatformKey[];
  content: string;
  media: MediaItem[];
  scheduledFor?: string | null;
}): Promise<string> {
  const ctx = await requirePersonalContext();
  const supabase = createSupabaseServerClient();

  const scheduled = input.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduled && Number.isNaN(scheduled.getTime())) {
    throw new Error("Netinkamas laikas.");
  }

  const row = {
    auth_user_id: ctx.authUserId,
    platforms: input.platforms,
    content: input.content.slice(0, 4000),
    media: input.media,
    status: scheduled ? "scheduled" : "draft",
    scheduled_for: scheduled ? scheduled.toISOString() : null,
  };

  if (input.id) {
    // Republishing something already out there is not an edit — the
    // platforms have their own copy and this row is now a record of it.
    const existing = await getPost(input.id);
    if (existing && ["published", "publishing"].includes(existing.status)) {
      throw new Error("Paskelbto įrašo keisti nebegalima.");
    }
    const { error } = await supabase
      .from("dashboard_social_queue")
      .update(row)
      .eq("id", input.id)
      .eq("auth_user_id", ctx.authUserId);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await supabase
    .from("dashboard_social_queue")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return String(data.id);
}

export async function deletePost(id: string): Promise<void> {
  const ctx = await requirePersonalContext();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("dashboard_social_queue")
    .delete()
    .eq("id", id)
    .eq("auth_user_id", ctx.authUserId);
  if (error) throw error;
}

// -------------------------------------------------------------------
// Publishing
// -------------------------------------------------------------------

export type PublishSummary = {
  postId: string;
  status: PostStatus;
  succeeded: PlatformKey[];
  failed: Array<{ platform: PlatformKey; error: string }>;
};

/** Publish one post now, from her session. */
export async function publishNow(id: string): Promise<PublishSummary> {
  const ctx = await requirePersonalContext();
  return publishOne(ctx.authUserId, id, createSupabaseServerClient());
}

/**
 * The core publish routine, shared by the button and the cron.
 *
 * Takes an explicit client because the cron has no session and must use
 * the admin one, while the button should run under her own RLS.
 */
export async function publishOne(
  authUserId: string,
  id: string,
  db: ReturnType<typeof createSupabaseServerClient> | ReturnType<typeof createSupabaseAdminClient>,
): Promise<PublishSummary> {
  const { data: row, error } = await db
    .from("dashboard_social_queue")
    .select(
      "id, platforms, content, media, status, external_ids, last_errors, attempts, auth_user_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) throw new Error("Įrašas nerastas.");

  const post = toPost(row);
  const externalIds = { ...post.externalIds };
  const errors: Record<string, string> = {};

  const [ig, fb] = await Promise.all([
    getIntegrationConfigForUser(authUserId, "instagram"),
    getIntegrationConfigForUser(authUserId, "facebook"),
  ]);

  const succeeded: PlatformKey[] = [];
  const failed: Array<{ platform: PlatformKey; error: string }> = [];

  for (const platform of post.platforms) {
    // The idempotency guard. Without this, a retry after a partial
    // failure double-posts to whichever platform worked the first time.
    if (externalIds[platform]) {
      succeeded.push(platform);
      continue;
    }

    let result: PublishResult;
    switch (platform) {
      case "instagram_feed":
        result = await publishInstagram(ig ?? {}, {
          caption: post.content,
          media: post.media,
        });
        break;
      case "instagram_story":
        result = await publishInstagram(ig ?? {}, {
          caption: "",
          media: post.media,
          story: true,
        });
        break;
      case "facebook_page":
        result = await publishFacebookPage(fb ?? {}, {
          message: post.content,
          media: post.media,
        });
        break;
      default:
        result = { ok: false, error: "Nežinoma platforma.", retryable: false };
    }

    if (result.ok) {
      externalIds[platform] = result.externalId;
      succeeded.push(platform);
    } else {
      errors[platform] = result.error;
      failed.push({ platform, error: result.error });
    }
  }

  const attempts = post.attempts + 1;
  const allDone = failed.length === 0 && succeeded.length > 0;
  const noneDone = succeeded.length === 0;

  // A post that failed everywhere but could still work stays 'scheduled'
  // so the next sweep retries it — until MAX_ATTEMPTS, after which it
  // becomes 'failed' and stops consuming sweeps.
  const exhausted = attempts >= MAX_ATTEMPTS;
  const status: PostStatus = allDone
    ? "published"
    : noneDone
      ? exhausted
        ? "failed"
        : "scheduled"
      : exhausted
        ? "partial"
        : "scheduled";

  await db
    .from("dashboard_social_queue")
    .update({
      status,
      external_ids: externalIds,
      last_errors: errors,
      attempts,
      published_at: allDone ? new Date().toISOString() : null,
    })
    .eq("id", id);

  return { postId: id, status, succeeded, failed };
}

/**
 * Publish everything that is due. Called by the scheduled sweep.
 *
 * The claim step (`scheduled` → `publishing`, conditional on the row
 * still being `scheduled`) is what stops two overlapping sweeps from
 * both publishing the same post. PostgREST applies the `.eq("status",
 * "scheduled")` filter inside the UPDATE, so only one of two racing
 * callers gets a row back.
 */
export async function publishDuePosts(limit = 5): Promise<PublishSummary[]> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: due } = await admin
    .from("dashboard_social_queue")
    .select("id, auth_user_id, attempts")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  const results: PublishSummary[] = [];

  for (const row of due ?? []) {
    const id = String(row.id);
    const authUserId = String(row.auth_user_id);

    const { data: claimed } = await admin
      .from("dashboard_social_queue")
      .update({ status: "publishing" })
      .eq("id", id)
      .eq("status", "scheduled")
      .select("id");

    // Someone else got there first.
    if (!claimed || claimed.length === 0) continue;

    try {
      results.push(await publishOne(authUserId, id, admin));
    } catch (err) {
      console.error("[personal-social] publish failed:", err);
      // Hand the row back so it is retried rather than stuck in
      // 'publishing' forever.
      await admin
        .from("dashboard_social_queue")
        .update({
          status: "scheduled",
          last_errors: { _: err instanceof Error ? err.message : "nežinoma klaida" },
        })
        .eq("id", id);
    }
  }

  return results;
}

/**
 * Release posts stuck in 'publishing'.
 *
 * A lambda killed mid-publish leaves the row claimed and nothing will
 * ever pick it up again. Ten minutes is comfortably longer than the
 * worst case (a 90-second Instagram video poll) and short enough that a
 * stuck post recovers within two sweeps.
 */
export async function releaseStalePublishing(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await admin
    .from("dashboard_social_queue")
    .update({ status: "scheduled" })
    .eq("status", "publishing")
    .lt("updated_at", cutoff)
    .select("id");
  return data?.length ?? 0;
}

// -------------------------------------------------------------------
// Audience snapshots
// -------------------------------------------------------------------

/**
 * Record today's follower count.
 *
 * Meta only ever reports the CURRENT number, so a growth goal
 * ("+100 followers this month") is impossible without a stored series.
 * This is that series.
 *
 * Called from two places — the Marketing screen's refresh button and the
 * daily push cron — so the baseline builds up whether or not she opens
 * the app. One row per day; a second call on the same day overwrites
 * rather than double-counting.
 *
 * Takes an explicit user id because the cron has no session.
 */
export async function captureAudienceSnapshot(
  authUserId: string,
  now = new Date(),
): Promise<boolean> {
  try {
    const cfg = await getIntegrationConfigForUser(authUserId, "instagram");
    if (!cfg?.accessToken || !cfg?.igUserId) return false;

    const audience = await fetchInstagramAudience(cfg);
    if (!audience) return false;

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("dashboard_audience_snapshots").upsert(
      {
        auth_user_id: authUserId,
        platform: "instagram",
        captured_on: now.toISOString().slice(0, 10),
        followers: audience.followers,
        posts_count: audience.postsCount,
      },
      { onConflict: "auth_user_id,platform,captured_on" },
    );
    if (error) throw error;
    return true;
  } catch (err) {
    // A missing baseline degrades one goal card to "not enough data".
    // It must never break a refresh or a cron run.
    console.error("[personal-social] audience snapshot failed:", err);
    return false;
  }
}

// -------------------------------------------------------------------
// AI caption
// -------------------------------------------------------------------

const CAPTION_SYSTEM = `Tu rašai socialinių tinklų tekstus Tarptautiniam jojimo klubui (TJK) — jojimo klubui Lietuvoje.

Balsas:
- Lietuviškai. Taisyklinga, šilta, be korporatyvinio žargono.
- Elegantiška ir kompetentinga: jojimas yra amatas, ne pramoga. Rašyk kaip žmogus, kuris tikrai išmano arklius.
- Premium, bet ne pompastiška. Jokių „nepraleisk progos!!!", jokių dirbtinių šauktukų, jokio spaudimo.
- Konkretu: vardai, valandos, oras, arklio charakteris — geriau nei bendri žodžiai apie „aistrą".

Formatas:
- 1–3 trumpos pastraipos. Mobiliajame tai turi tilpti be „daugiau".
- Pabaigoje 5–8 grotažymės atskiroje eilutėje. Lietuviškos ir angliškos maišytos, be tarpų.
- Jokių emoji perteklių — daugiausiai vienas, jei tikrai tinka.

Grąžink TIK įrašo tekstą. Jokių paaiškinimų, jokių kabučių aplink.`;

export async function generateCaption(brief: string): Promise<string> {
  const cfg = await getIntegrationConfig("anthropic");
  const apiKey = typeof cfg?.apiKey === "string" ? cfg.apiKey.trim() : "";
  if (!apiKey) throw new Error("Claude raktas neįvestas — žiūrėk nustatymus.");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    system: CAPTION_SYSTEM,
    messages: [{ role: "user", content: brief.slice(0, 2000) }],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw new Error("Nepavyko sugeneruoti teksto.");
  return text;
}

// -------------------------------------------------------------------

function toPost(r: any): QueuedPost {
  return {
    id: String(r.id),
    platforms: (r.platforms ?? []) as PlatformKey[],
    content: String(r.content ?? ""),
    media: Array.isArray(r.media) ? (r.media as MediaItem[]) : [],
    status: String(r.status) as PostStatus,
    scheduledFor: (r.scheduled_for as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    externalIds: (r.external_ids ?? {}) as Record<string, string>,
    lastErrors: (r.last_errors ?? {}) as Record<string, string>,
    attempts: num(r.attempts),
    createdAt: String(r.created_at ?? ""),
  };
}
