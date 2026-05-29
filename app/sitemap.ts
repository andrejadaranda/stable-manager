// app.longrein.eu/sitemap.xml — public SEO surface.
//
// Two kinds of URLs ship here:
//
//   1. STATIC public routes — /signup variants, /login, /legal pages.
//      Hard-coded with high priority because these are the conversion
//      entry points and brand-search landings.
//
//   2. DYNAMIC public stable pages — /s/[slug] for every stable that
//      published a public bio. Pulled live from Supabase with the
//      anon client (no auth, no cookies — must succeed for Google
//      Bot which is unauthenticated by definition).
//
// Authenticated dashboard, API, auth, invite, reset-password, live,
// guest-token, etc. are NOT in this sitemap and additionally carry an
// X-Robots-Tag: noindex header from next.config.js, so even a stray
// link from a public page can't get them indexed.
//
// Per sitemaps.org spec, all URLs in this file share the same host
// (app.longrein.eu). The marketing site at longrein.eu maintains its
// own separate sitemap.

import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const HOST = "https://app.longrein.eu";

// Static public routes — these never change shape, only the lastmod date.
const STATIC_ROUTES: Array<{
  path:       string;
  priority:   number;
  changefreq: "weekly" | "monthly" | "daily";
}> = [
  { path: "/signup",          priority: 0.9, changefreq: "weekly" },
  { path: "/signup/owner",    priority: 0.9, changefreq: "weekly" },
  { path: "/signup/personal", priority: 0.9, changefreq: "weekly" },
  { path: "/signup/join",     priority: 0.7, changefreq: "weekly" },
  { path: "/login",           priority: 0.4, changefreq: "monthly" },
  { path: "/legal/terms",     priority: 0.3, changefreq: "monthly" },
  { path: "/legal/privacy",   priority: 0.3, changefreq: "monthly" },
  { path: "/legal/cookies",   priority: 0.3, changefreq: "monthly" },
];

// Pull every stable that has opted into a public page. We treat ANY
// stable with a slug as eligible for /s/[slug] (the page itself does
// the "have they published anything?" check via getPublicStable and
// 404s if not). This sitemap optimistically includes them all and
// Google will drop the 404s itself on next crawl.
async function publicStableSlugs(): Promise<Array<{ slug: string; lastmod: Date }>> {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !anon) return [];

  const supa = createClient(url, anon, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });

  // Anon-readable subset of stables: id, slug, updated_at where the
  // RLS anon-read policy passes. Limit 1000 to keep response bounded
  // (Google sitemaps support up to 50k but we'll split when we hit that).
  const { data, error } = await supa
    .from("stables")
    .select("slug, updated_at")
    .not("slug", "is", null)
    .limit(1000);

  if (error || !data) return [];

  return data
    .filter((row) => typeof row.slug === "string" && row.slug.length > 0)
    .map((row) => ({
      slug:    row.slug as string,
      lastmod: row.updated_at ? new Date(row.updated_at as string) : new Date(),
    }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now    = new Date();
  const stables = await publicStableSlugs();

  return [
    // Root marketing redirects (if any) — keeping out, app root usually
    // goes to /dashboard for signed-in users and to /signup for anon.
    ...STATIC_ROUTES.map((r) => ({
      url:           `${HOST}${r.path}`,
      lastModified:  now,
      changeFrequency: r.changefreq,
      priority:      r.priority,
    })),
    ...stables.map((s) => ({
      url:             `${HOST}/s/${s.slug}`,
      lastModified:    s.lastmod,
      changeFrequency: "weekly" as const,
      priority:        0.8,
    })),
  ];
}
