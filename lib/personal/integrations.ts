// External data sources for the Marketing screen.
//
// Every client here follows the same contract:
//   * returns [] when the integration isn't configured — never throws,
//     never blocks a page render;
//   * has a hard timeout, so a slow third party can't hang the dashboard;
//   * returns a normalised shape that maps 1:1 onto dashboard_social_posts.
//
// Nothing here is called during a page render. The Marketing screen reads
// the cached rows in dashboard_social_posts; these functions run from the
// refresh action / cron. That's what keeps the screen instant and makes an
// expired token a stale-data problem rather than an outage.

export type NormalisedPost = {
  platform: "instagram" | "facebook" | "website";
  externalId: string;
  permalink: string | null;
  caption: string | null;
  mediaType: string | null;
  postedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
};

const TIMEOUT_MS = 8000;
/** Pinned Graph version: an unpinned URL silently changes behaviour
 *  when Meta rolls a new default, which is a debugging nightmare. */
const GRAPH = "https://graph.facebook.com/v21.0";

async function fetchJson(url: string): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) {
      console.error(`[personal-dashboard] fetch ${res.status} for ${redact(url)}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[personal-dashboard] fetch failed for ${redact(url)}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Never let an access token reach a log line. */
function redact(url: string): string {
  return url.replace(/access_token=[^&]+/g, "access_token=***");
}

// -------------------------------------------------------------------
// Instagram (Graph API — Business/Creator accounts only)
// -------------------------------------------------------------------
// Needs: an IG Business account linked to a Facebook Page, and a
// long-lived token with instagram_basic + instagram_manage_insights.
// See docs/PERSONAL-DASHBOARD.md for the click path to get both.

export async function fetchInstagramPosts(cfg: {
  accessToken?: unknown;
  igUserId?: unknown;
  limit?: number;
}): Promise<NormalisedPost[]> {
  const token = str(cfg.accessToken);
  const userId = str(cfg.igUserId);
  if (!token || !userId) return [];

  const fields =
    "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count";
  const media = await fetchJson(
    `${GRAPH}/${userId}/media?fields=${fields}&limit=${cfg.limit ?? 25}&access_token=${encodeURIComponent(token)}`,
  );
  if (!media?.data) return [];

  // Insights are a per-media call. Fetching them for 25 posts in parallel
  // is 25 requests; Meta's rate limit is generous enough for a handful of
  // refreshes a day, and a failure on any one of them just leaves that
  // post's reach at 0 rather than dropping the post.
  const posts: NormalisedPost[] = media.data.map((m: any) => ({
    platform: "instagram" as const,
    externalId: String(m.id),
    permalink: m.permalink ?? null,
    caption: m.caption ?? null,
    // media_product_type distinguishes a REELS from a plain VIDEO, which
    // is the distinction that actually matters for "post more reels".
    mediaType: String(
      m.media_product_type === "REELS" ? "reel" : (m.media_type ?? "")
    ).toLowerCase(),
    postedAt: m.timestamp ?? null,
    likes: intOf(m.like_count),
    comments: intOf(m.comments_count),
    shares: 0,
    saves: 0,
    reach: 0,
    impressions: 0,
  }));

  await Promise.all(
    posts.map(async (p) => {
      const ins = await fetchJson(
        `${GRAPH}/${p.externalId}/insights?metric=reach,saved&access_token=${encodeURIComponent(token)}`,
      );
      for (const row of ins?.data ?? []) {
        const value = intOf(row?.values?.[0]?.value);
        if (row.name === "reach") p.reach = value;
        if (row.name === "saved") p.saves = value;
      }
    }),
  );

  return posts;
}

// -------------------------------------------------------------------
// Facebook Page posts
// -------------------------------------------------------------------

export async function fetchFacebookPosts(cfg: {
  accessToken?: unknown;
  pageId?: unknown;
  limit?: number;
}): Promise<NormalisedPost[]> {
  const token = str(cfg.accessToken);
  const pageId = str(cfg.pageId);
  if (!token || !pageId) return [];

  const fields =
    "id,message,created_time,permalink_url,shares," +
    "likes.summary(true).limit(0),comments.summary(true).limit(0)";
  const json = await fetchJson(
    `${GRAPH}/${pageId}/posts?fields=${fields}&limit=${cfg.limit ?? 25}&access_token=${encodeURIComponent(token)}`,
  );
  if (!json?.data) return [];

  return json.data.map((p: any) => ({
    platform: "facebook" as const,
    externalId: String(p.id),
    permalink: p.permalink_url ?? null,
    caption: p.message ?? null,
    mediaType: null,
    postedAt: p.created_time ?? null,
    likes: intOf(p.likes?.summary?.total_count),
    comments: intOf(p.comments?.summary?.total_count),
    shares: intOf(p.shares?.count),
    saves: 0,
    reach: 0,
    impressions: 0,
  }));
}

// -------------------------------------------------------------------
// tjk.lt — WordPress REST API
// -------------------------------------------------------------------
// This one needs no credentials: wp-json is public on tjk.lt (verified
// against the live site). It is the one marketing source that works the
// moment the dashboard is switched on.
//
// WP gives no view counts. Posts show up as a publishing cadence signal
// ("nothing new on the site in 3 weeks"), not an engagement metric —
// which is why likes/reach stay 0 here rather than being invented.

export async function fetchWebsitePosts(cfg: {
  baseUrl?: unknown;
  limit?: number;
}): Promise<NormalisedPost[]> {
  const base = str(cfg.baseUrl) || "https://tjk.lt";
  const json = await fetchJson(
    `${base.replace(/\/$/, "")}/wp-json/wp/v2/posts?per_page=${cfg.limit ?? 10}` +
      `&_fields=id,date_gmt,link,title,excerpt`,
  );
  if (!Array.isArray(json)) return [];

  return json.map((p: any) => ({
    platform: "website" as const,
    externalId: String(p.id),
    permalink: p.link ?? null,
    caption: stripHtml(p?.title?.rendered ?? ""),
    mediaType: "article",
    // WP returns date_gmt without a zone designator; append Z so it isn't
    // parsed as local time.
    postedAt: p.date_gmt ? `${p.date_gmt}Z` : null,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    reach: 0,
    impressions: 0,
  }));
}

// -------------------------------------------------------------------

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function intOf(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&#8217;/g, "’")
    .replace(/&#8211;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .trim();
}
