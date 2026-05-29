// app.longrein.eu/robots.txt — public crawl rules.
//
// Allows: signup variants, login, public stable pages, legal pages.
// Disallows: dashboard, API routes, auth callbacks, invite token URLs,
// reset-password (has token in URL), live tracking (private), guest
// contributor magic-link routes (token-gated by design).
//
// X-Robots-Tag noindex header in next.config.js gives a second layer
// of defence for the disallow list — even if a crawler ignores
// robots.txt, the header tells the indexer not to surface the page.

import type { MetadataRoute } from "next";

const HOST = "https://app.longrein.eu";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow:  [
          "/dashboard/",
          "/api/",
          "/auth/",
          "/invite/",
          "/reset-password",
          "/live/",
          "/guest/",
        ],
      },
    ],
    sitemap: `${HOST}/sitemap.xml`,
    host:    HOST,
  };
}
