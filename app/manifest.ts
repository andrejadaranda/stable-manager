// Web manifest — enables Add-to-Home-Screen on Android Chrome and
// supplements iOS' apple-touch metadata. Next.js serves this at
// /manifest.webmanifest automatically.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:        "Hoofbeat — stable management",
    short_name:  "Hoofbeat",
    description: "Schedule lessons, track payments, and protect your horses.",
    // Standalone = no browser chrome when launched from home screen.
    display:           "standalone",
    orientation:       "portrait",
    start_url:         "/dashboard",
    scope:             "/",
    background_color:  "#F8F4EE",
    theme_color:       "#2D5440",
    categories:        ["business", "productivity"],
    icons: [
      // Next.js dynamically renders these via app/icon.tsx and
      // app/apple-icon.tsx. The browser fetches them through the same
      // routes, so no static files are needed.
      { src: "/icon",        sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon",  sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
