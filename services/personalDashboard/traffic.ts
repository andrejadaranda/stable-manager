// "Kas kiek lankosi" — traffic, from our own counter.
//
// Reads dashboard_pageviews, which /api/pageview fills. Nothing here
// talks to Vercel, Google or Plausible: every one of those needs an API
// credential in an env var, and the operator cannot add one. Counting
// into her own Postgres is the only design that works given that
// constraint, and it happens to be the most private one too.
//
// Uses the admin client because the table is service-role-only (no
// browser session should be able to read raw traffic rows). The gate is
// checked first, exactly as in longrein.ts.

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requirePersonalContext, safe, num } from "@/services/personalDashboard/common";

export type SiteTraffic = {
  host: string;
  views7: number;
  visits7: number;
  viewsPrev7: number;
  visitsPrev7: number;
  /** Most-visited paths over the last 7 days. */
  topPaths: Array<{ path: string; views: number }>;
};

export type TrafficSnapshot = {
  sites: SiteTraffic[];
  /** Day the counter first recorded anything, so the UI can say how
   *  much history exists rather than implying it goes back forever. */
  since: string | null;
  totalViews7: number;
  totalVisits7: number;
};

const EMPTY: TrafficSnapshot = {
  sites: [],
  since: null,
  totalViews7: 0,
  totalVisits7: 0,
};

export async function getTrafficSnapshot(now = new Date()): Promise<TrafficSnapshot> {
  return safe<TrafficSnapshot>(
    async () => {
      await requirePersonalContext();
      const admin = createSupabaseAdminClient();

      const dayKey = (daysAgo: number) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Vilnius",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(now.getTime() - daysAgo * 86_400_000));

      const from14 = dayKey(14);

      const { data, error } = await admin
        .from("dashboard_pageviews")
        .select("host, path, viewed_on, views, visits")
        .gte("viewed_on", from14)
        .order("viewed_on", { ascending: true })
        .limit(5000);

      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return EMPTY;

      const cutoff7 = dayKey(7);
      const byHost = new Map<string, SiteTraffic & { pathViews: Map<string, number> }>();

      for (const r of rows) {
        const host = String(r.host);
        if (!byHost.has(host)) {
          byHost.set(host, {
            host,
            views7: 0,
            visits7: 0,
            viewsPrev7: 0,
            visitsPrev7: 0,
            topPaths: [],
            pathViews: new Map(),
          });
        }
        const site = byHost.get(host)!;
        const recent = String(r.viewed_on) >= cutoff7;

        if (recent) {
          site.views7 += num(r.views);
          site.visits7 += num(r.visits);
          const path = String(r.path);
          site.pathViews.set(path, (site.pathViews.get(path) ?? 0) + num(r.views));
        } else {
          site.viewsPrev7 += num(r.views);
          site.visitsPrev7 += num(r.visits);
        }
      }

      const sites = [...byHost.values()]
        .map(({ pathViews, ...site }) => ({
          ...site,
          topPaths: [...pathViews.entries()]
            .map(([path, views]) => ({ path, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 6),
        }))
        .sort((a, b) => b.views7 - a.views7);

      return {
        sites,
        since: String(rows[0].viewed_on),
        totalViews7: sites.reduce((s, x) => s + x.views7, 0),
        totalVisits7: sites.reduce((s, x) => s + x.visits7, 0),
      };
    },
    EMPTY,
    "getTrafficSnapshot",
  );
}
