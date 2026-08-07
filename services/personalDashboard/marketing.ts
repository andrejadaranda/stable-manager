// Marketing: what she posted, what worked, and what's missing.
//
// Reads the dashboard_social_posts cache. Refreshing that cache is a
// separate, explicit action (refreshSocialCache) so a Graph API outage
// or an expired token degrades to "yesterday's numbers" rather than a
// spinner that never resolves.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requirePersonalContext,
  getStableTimeZone,
  safe,
  num,
} from "@/services/personalDashboard/common";
import {
  detectContentGaps,
  topPosts,
  daysBetween,
  type ContentGap,
  type SocialPostLite,
} from "@/services/personalDashboard/core.pure";
import { getIntegrationConfig } from "@/services/personalDashboard/settings";
import {
  fetchInstagramPosts,
  fetchFacebookPosts,
  fetchWebsitePosts,
  type NormalisedPost,
} from "@/lib/personal/integrations";
import { captureAudienceSnapshot } from "@/services/personalDashboard/social";

export type SocialPost = SocialPostLite & {
  id: string;
  externalId: string;
  permalink: string | null;
  caption: string | null;
  shares: number;
  saves: number;
  impressions: number;
  fetchedAt: string;
};

export type MarketingSnapshot = {
  posts: SocialPost[];
  top: SocialPost[];
  gaps: ContentGap[];
  counts: { instagram: number; facebook: number; website: number };
  postsLast7: number;
  postsPrev7: number;
  /** Which platforms have credentials. Drives the empty states. */
  configured: { instagram: boolean; facebook: boolean; website: boolean };
  lastRefreshedAt: string | null;
};

const EMPTY: MarketingSnapshot = {
  posts: [],
  top: [],
  gaps: [],
  counts: { instagram: 0, facebook: 0, website: 0 },
  postsLast7: 0,
  postsPrev7: 0,
  configured: { instagram: false, facebook: false, website: false },
  lastRefreshedAt: null,
};

export async function getMarketingSnapshot(now = new Date()): Promise<MarketingSnapshot> {
  return safe(
    async () => {
      const ctx = await requirePersonalContext();
      const tz = await getStableTimeZone();
      const supabase = createSupabaseServerClient();

      const [{ data }, ig, fb, web] = await Promise.all([
        supabase
          .from("dashboard_social_posts")
          .select(
            "id, platform, external_id, permalink, caption, media_type, posted_at, likes, comments, shares, saves, reach, impressions, fetched_at",
          )
          .eq("auth_user_id", ctx.authUserId)
          .order("posted_at", { ascending: false })
          .limit(60),
        getIntegrationConfig("instagram"),
        getIntegrationConfig("facebook"),
        getIntegrationConfig("website"),
      ]);

      const posts: SocialPost[] = (data ?? []).map((r) => ({
        id: String(r.id),
        externalId: String(r.external_id),
        platform: r.platform as SocialPost["platform"],
        permalink: (r.permalink as string) ?? null,
        caption: (r.caption as string) ?? null,
        mediaType: (r.media_type as string) ?? null,
        postedAt: (r.posted_at as string) ?? null,
        likes: num(r.likes),
        comments: num(r.comments),
        shares: num(r.shares),
        saves: num(r.saves),
        reach: num(r.reach),
        impressions: num(r.impressions),
        fetchedAt: String(r.fetched_at),
      }));

      const within = (from: number, to: number) =>
        posts.filter((p) => {
          if (!p.postedAt) return false;
          const d = daysBetween(p.postedAt, now, tz);
          return d >= from && d < to;
        }).length;

      return {
        posts,
        top: topPosts(posts, 3),
        gaps: detectContentGaps(posts, now, tz),
        counts: {
          instagram: posts.filter((p) => p.platform === "instagram").length,
          facebook: posts.filter((p) => p.platform === "facebook").length,
          website: posts.filter((p) => p.platform === "website").length,
        },
        postsLast7: within(0, 7),
        postsPrev7: within(7, 14),
        configured: {
          instagram: Boolean(ig),
          facebook: Boolean(fb),
          // tjk.lt needs no credentials — the public WP REST endpoint is
          // always available, so this source is "configured" by default.
          website: true,
        },
        lastRefreshedAt:
          posts.length > 0
            ? posts.reduce(
                (latest, p) => (p.fetchedAt > latest ? p.fetchedAt : latest),
                posts[0].fetchedAt,
              )
            : null,
      };
    },
    EMPTY,
    "getMarketingSnapshot",
  );
}

/**
 * Pull fresh metrics from every configured platform into the cache.
 *
 * Called from the Marketing screen's refresh button and (once scheduled)
 * a daily cron. Idempotent: rows are upserted on
 * (auth_user_id, platform, external_id), so re-running only updates
 * counters. Returns how many rows were touched per platform so the UI
 * can say something specific instead of just "done".
 */
export async function refreshSocialCache(): Promise<{
  instagram: number;
  facebook: number;
  website: number;
  errors: string[];
}> {
  const ctx = await requirePersonalContext();
  const supabase = createSupabaseServerClient();
  const errors: string[] = [];

  const [igCfg, fbCfg, webCfg] = await Promise.all([
    getIntegrationConfig("instagram"),
    getIntegrationConfig("facebook"),
    getIntegrationConfig("website"),
  ]);

  // 50 posts comfortably covers 30 days at any realistic posting cadence
  // (the Marketing screen's windows are 7 and 14 days, and the content-gap
  // detector looks back a month). Fetching more would only add per-media
  // insight calls for posts nothing on screen can reach.
  const LIMIT = 50;

  const [instagram, facebook, website] = await Promise.all([
    igCfg ? fetchInstagramPosts({ ...igCfg, limit: LIMIT }) : Promise.resolve([]),
    fbCfg ? fetchFacebookPosts({ ...fbCfg, limit: LIMIT }) : Promise.resolve([]),
    fetchWebsitePosts({ ...(webCfg ?? {}), limit: 20 }),
  ]);

  // Configured but returned nothing = almost always an expired token.
  // Say so, rather than reporting a cheerful "0 posts".
  if (igCfg && instagram.length === 0) {
    errors.push("Instagram negrąžino įrašų — greičiausiai pasibaigęs tokenas.");
  }
  if (fbCfg && facebook.length === 0) {
    errors.push("Facebook negrąžino įrašų — greičiausiai pasibaigęs tokenas.");
  }

  // Sample the follower count while we are here. Growth goals need a
  // stored baseline (Meta only reports the current number), and this is
  // the moment we already know the credentials are in hand.
  await captureAudienceSnapshot(ctx.authUserId);

  const all = [...instagram, ...facebook, ...website];
  if (all.length > 0) {
    const { error } = await supabase
      .from("dashboard_social_posts")
      .upsert(all.map((p) => toRow(ctx.authUserId, p)), {
        onConflict: "auth_user_id,platform,external_id",
      });
    if (error) errors.push(error.message);
  }

  return {
    instagram: instagram.length,
    facebook: facebook.length,
    website: website.length,
    errors,
  };
}

function toRow(authUserId: string, p: NormalisedPost) {
  return {
    auth_user_id: authUserId,
    platform: p.platform,
    external_id: p.externalId,
    permalink: p.permalink,
    caption: p.caption,
    media_type: p.mediaType,
    posted_at: p.postedAt,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    reach: p.reach,
    impressions: p.impressions,
    fetched_at: new Date().toISOString(),
  };
}
