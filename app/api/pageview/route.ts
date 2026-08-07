// =============================================================
// POST /api/pageview
//
// The traffic counter. One tiny request per page load, from Longrein's
// own pages and (once the snippet is pasted) from tjk.lt.
//
// PUBLIC AND CROSS-ORIGIN BY NECESSITY
// tjk.lt is a different origin on different hosting, so this endpoint
// answers CORS preflights and accepts anonymous posts. That is a real
// trade, and it is bounded deliberately:
//
//   * The only thing a caller can do is add 1 to a counter. The
//     underlying RPC cannot read, cannot touch another table, and
//     returns nothing.
//   * Host must be on an allowlist. Someone spamming this cannot invent
//     a site, only inflate a number on a site that is already hers.
//   * Paths are normalised and bucketed, so the table cannot be turned
//     into a per-visitor trail by sending crafted URLs.
//
// WHAT IS NOT COLLECTED
// No IP, no user agent, no cookie, no fingerprint. "Visits" arrives as a
// boolean the browser decided from sessionStorage; the server never
// learns who sent it. That is what keeps this out of consent-banner
// territory — there is nothing personal to consent to.
// =============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sites we will count. Anything else is dropped silently. */
const ALLOWED_HOSTS = [
  "app.longrein.eu",
  "longrein.eu",
  "www.longrein.eu",
  "tjk.lt",
  "www.tjk.lt",
];

const CORS = {
  // The beacon carries nothing sensitive and no credentials, so a
  // wildcard origin is appropriate — and required, since it posts from
  // tjk.lt as well as from Longrein.
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  // Always 204, whatever happens. A beacon that returns errors would
  // show up in visitors' consoles on a site this has no business
  // affecting, and tells a prober nothing either way.
  const ok = () => new NextResponse(null, { status: 204, headers: CORS });

  try {
    const body = await request.json();

    const host = normaliseHost(body?.host);
    if (!host) return ok();

    const path = normalisePath(body?.path);
    const isVisit = body?.visit === true;

    const admin = createSupabaseAdminClient();
    await admin.rpc("dashboard_record_pageview", {
      p_host: host,
      p_path: path,
      // The calendar day in Vilnius, not UTC — a 01:30 visit belongs to
      // the night she is looking at, not to the next morning.
      p_day: new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Vilnius",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      p_is_visit: isVisit,
    });
  } catch {
    /* counting is never worth failing a page load over */
  }

  return ok();
}

function normaliseHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const host = raw.toLowerCase().trim().replace(/:\d+$/, "");
  return ALLOWED_HOSTS.includes(host) ? host.replace(/^www\./, "") : null;
}

/**
 * Reduce a URL to something countable.
 *
 * Query strings and fragments go (they carry tokens and search terms),
 * and any segment that looks like an id is replaced by a placeholder.
 * Without that last step, /dashboard/clients/<uuid> would create one row
 * per customer per day — turning an anonymous counter into a browsing
 * trail, which is the exact thing this design is avoiding.
 */
function normalisePath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/";

  const path = raw.split("?")[0].split("#")[0];

  const bucketed = path
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id";
      if (/^\d+$/.test(seg)) return ":id";
      // Long opaque tokens (share links, slugs with hashes).
      if (seg.length > 24 && !seg.includes("-")) return ":id";
      return seg;
    })
    .join("/");

  return bucketed.slice(0, 200) || "/";
}
