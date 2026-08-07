// Publishing to Meta — Instagram Feed, Instagram Stories, Facebook Page.
//
// The sibling of lib/personal/integrations.ts: that file READS metrics
// back, this one WRITES posts out. They are kept apart because the token
// scopes differ (reading needs instagram_basic; publishing needs
// instagram_content_publish and pages_manage_posts), and because a bug
// in a read path costs a stale number while a bug in a write path posts
// something publicly, twice.
//
// Everything here follows three rules:
//
//   1. Never throw. Every function returns a discriminated result, so a
//      three-platform post where Facebook fails still records the two
//      that succeeded — and the retry can skip them.
//   2. Hard timeouts. Instagram's video pipeline can stall for minutes;
//      the caller is a cron with a wall-clock budget.
//   3. Never log a token. redact() is applied to every URL that reaches
//      a log line.

export type PlatformKey = "instagram_feed" | "instagram_story" | "facebook_page";

export type MediaItem = {
  url: string;
  type: "image" | "video";
};

export type PublishResult =
  | { ok: true; externalId: string }
  | { ok: false; error: string; retryable: boolean };

/** Pinned Graph version — an unpinned URL silently changes behaviour when
 *  Meta rolls a new default, which is a debugging nightmare. */
const GRAPH = "https://graph.facebook.com/v21.0";

const REQUEST_TIMEOUT_MS = 15_000;
/** Instagram processes video asynchronously. This is the ceiling on how
 *  long we wait for it before giving up and letting the retry pick it up. */
const VIDEO_POLL_TIMEOUT_MS = 90_000;
const VIDEO_POLL_INTERVAL_MS = 3_000;

// -------------------------------------------------------------------
// Instagram
// -------------------------------------------------------------------

/**
 * Instagram publishing is a two-step handshake: create a "container"
 * describing the media, then publish that container. Both steps can fail
 * independently, and the container step is where almost every real error
 * shows up (bad aspect ratio, unreachable URL, expired token).
 *
 * Meta fetches the media from `url` itself, with no credentials — which
 * is why the storage bucket in migration 112 has to be public-read.
 */
export async function publishInstagram(
  cfg: { accessToken?: unknown; igUserId?: unknown },
  input: { caption: string; media: MediaItem[]; story?: boolean },
): Promise<PublishResult> {
  const token = str(cfg.accessToken);
  const userId = str(cfg.igUserId);
  if (!token || !userId) {
    return { ok: false, error: "Instagram neprijungtas.", retryable: false };
  }
  if (input.media.length === 0) {
    // Not a limitation we chose — the Instagram API has no text-only post.
    return { ok: false, error: "Instagram reikalauja nuotraukos ar video.", retryable: false };
  }

  const first = input.media[0];
  const isVideo = first.type === "video";

  const params: Record<string, string> = { access_token: token };
  if (isVideo) {
    params.video_url = first.url;
    // REELS is the only video product type the API accepts for a feed
    // post; STORIES for a story.
    params.media_type = input.story ? "STORIES" : "REELS";
  } else {
    params.image_url = first.url;
    if (input.story) params.media_type = "STORIES";
  }
  // Stories carry no caption — sending one is rejected outright.
  if (!input.story && input.caption) params.caption = input.caption.slice(0, 2200);

  const container = await post(`${GRAPH}/${userId}/media`, params);
  if (!container.ok) return container;

  const creationId = container.data?.id;
  if (!creationId) {
    return { ok: false, error: "Instagram negrąžino konteinerio ID.", retryable: true };
  }

  // Video has to finish transcoding before it can be published; asking
  // too early returns a confusing "media not ready" error.
  if (isVideo) {
    const ready = await waitForContainer(String(creationId), token);
    if (!ready.ok) return ready;
  }

  const published = await post(`${GRAPH}/${userId}/media_publish`, {
    creation_id: String(creationId),
    access_token: token,
  });
  if (!published.ok) return published;

  const id = published.data?.id;
  return id
    ? { ok: true, externalId: String(id) }
    : { ok: false, error: "Instagram negrąžino įrašo ID.", retryable: true };
}

/** Poll a video container until Meta finishes processing it. */
async function waitForContainer(
  creationId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string; retryable: boolean }> {
  const deadline = Date.now() + VIDEO_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await get(
      `${GRAPH}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    );
    const code = status.ok ? status.data?.status_code : null;

    if (code === "FINISHED") return { ok: true };
    if (code === "ERROR") {
      return {
        ok: false,
        error: `Instagram nepriėmė video: ${status.data?.status ?? "nežinoma klaida"}`,
        // A rejected video will be rejected again — do not burn retries.
        retryable: false,
      };
    }
    await sleep(VIDEO_POLL_INTERVAL_MS);
  }

  // Still processing. Retryable: the container stays valid for 24h, so
  // the next sweep can publish it.
  return { ok: false, error: "Instagram vis dar apdoroja video.", retryable: true };
}

// -------------------------------------------------------------------
// Facebook Page
// -------------------------------------------------------------------

export async function publishFacebookPage(
  cfg: { accessToken?: unknown; pageId?: unknown },
  input: { message: string; media: MediaItem[] },
): Promise<PublishResult> {
  const token = str(cfg.accessToken);
  const pageId = str(cfg.pageId);
  if (!token || !pageId) {
    return { ok: false, error: "Facebook neprijungtas.", retryable: false };
  }

  const first = input.media[0];

  // Unlike Instagram, Facebook accepts a text-only post — and each media
  // type has its own endpoint with its own field name for the caption.
  let url: string;
  let params: Record<string, string>;

  if (!first) {
    url = `${GRAPH}/${pageId}/feed`;
    params = { message: input.message, access_token: token };
  } else if (first.type === "video") {
    url = `${GRAPH}/${pageId}/videos`;
    params = { file_url: first.url, description: input.message, access_token: token };
  } else {
    url = `${GRAPH}/${pageId}/photos`;
    params = { url: first.url, caption: input.message, access_token: token };
  }

  const result = await post(url, params);
  if (!result.ok) return result;

  // /feed returns `id`, /photos returns `post_id` (with `id` being the
  // photo object rather than the post).
  const id = result.data?.post_id ?? result.data?.id;
  return id
    ? { ok: true, externalId: String(id) }
    : { ok: false, error: "Facebook negrąžino įrašo ID.", retryable: true };
}

// -------------------------------------------------------------------
// Audience size — the baseline for follower-growth goals
// -------------------------------------------------------------------

export async function fetchInstagramAudience(cfg: {
  accessToken?: unknown;
  igUserId?: unknown;
}): Promise<{ followers: number; postsCount: number } | null> {
  const token = str(cfg.accessToken);
  const userId = str(cfg.igUserId);
  if (!token || !userId) return null;

  const res = await get(
    `${GRAPH}/${userId}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`,
  );
  if (!res.ok) return null;

  return {
    followers: intOf(res.data?.followers_count),
    postsCount: intOf(res.data?.media_count),
  };
}

// -------------------------------------------------------------------
// Token exchange
// -------------------------------------------------------------------

/**
 * Turn a short-lived user token into a long-lived one (~60 days), then
 * into a Page token (which does not expire at all as long as the user
 * token that minted it stays valid).
 *
 * This exists so she never has to hand-assemble a Graph API URL with an
 * app secret in the query string. It is the fiddliest step in connecting
 * Meta and the one most likely to be got wrong.
 */
export async function exchangeForLongLivedTokens(input: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<
  | {
      ok: true;
      longLivedUserToken: string;
      pages: Array<{ id: string; name: string; accessToken: string; igUserId: string | null }>;
    }
  | { ok: false; error: string }
> {
  const exchange = await get(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(input.appId)}` +
      `&client_secret=${encodeURIComponent(input.appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(input.shortLivedToken)}`,
  );
  if (!exchange.ok) {
    return { ok: false, error: exchange.error ?? "Nepavyko pakeisti tokeno." };
  }

  const longLived = exchange.data?.access_token;
  if (!longLived) return { ok: false, error: "Meta negrąžino ilgalaikio tokeno." };

  // /me/accounts returns one Page token per page she administers, plus
  // the linked Instagram Business account id — everything the dashboard
  // needs, in one call.
  const accounts = await get(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account` +
      `&access_token=${encodeURIComponent(String(longLived))}`,
  );
  if (!accounts.ok) {
    return { ok: false, error: accounts.error ?? "Nepavyko gauti puslapių sąrašo." };
  }

  const pages = (accounts.data?.data ?? []).map((p: any) => ({
    id: String(p.id),
    name: String(p.name ?? "—"),
    accessToken: String(p.access_token ?? ""),
    igUserId: p.instagram_business_account?.id
      ? String(p.instagram_business_account.id)
      : null,
  }));

  return { ok: true, longLivedUserToken: String(longLived), pages };
}

// -------------------------------------------------------------------
// HTTP
// -------------------------------------------------------------------

type Raw = { ok: true; data: any } | { ok: false; error: string; retryable: boolean; data?: never };

async function post(url: string, params: Record<string, string>): Promise<Raw> {
  // Credentials go in the body, never the query string: a URL with a
  // token in it ends up in access logs and error traces.
  const body = new URLSearchParams(params);
  return request(url, { method: "POST", body });
}

async function get(url: string): Promise<Raw & { error?: string }> {
  return request(url, { method: "GET" });
}

async function request(url: string, init: RequestInit): Promise<Raw> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, cache: "no-store" });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const err = json?.error;
      const message = err?.error_user_msg || err?.message || `HTTP ${res.status}`;
      console.error(`[personal-publish] ${res.status} for ${redact(url)}: ${message}`);
      return {
        ok: false,
        error: String(message).slice(0, 300),
        // 4xx is a bad request or a dead token — retrying changes
        // nothing and would just re-attempt a doomed post every 5
        // minutes. 5xx and network failures are worth another go.
        retryable: res.status >= 500 || res.status === 429,
      };
    }

    return { ok: true, data: json };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    console.error(`[personal-publish] request failed for ${redact(url)}:`, err?.message ?? err);
    return {
      ok: false,
      error: aborted ? "Meta neatsakė laiku." : "Nepavyko pasiekti Meta.",
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Never let an access token reach a log line. */
function redact(url: string): string {
  return url.replace(/access_token=[^&]+/g, "access_token=***");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function intOf(v: unknown): number {
  const n = typeof v === "string" ? parseInt(v, 10) : (v as number);
  return Number.isFinite(n) ? n : 0;
}
