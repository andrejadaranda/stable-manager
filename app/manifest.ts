// Web manifest — enables Add-to-Home-Screen on Android Chrome and
// supplements iOS' apple-touch metadata. Next.js serves this at
// /manifest.webmanifest automatically.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:        "Longrein — stable management",
    short_name:  "Longrein",
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
      // Static PNGs from the Longrein. brand system (see /APP/brand/).
      // app/icon.png and app/apple-icon.png are Next.js conventions and
      // are served at /icon and /apple-icon automatically. The same
      // square is registered as both "any" and "maskable" — the source
      // SVG bakes in a 22% safe-area, so Android's adaptive-icon
      // clipping won't crop the L. mark.
      { src: "/icon",        sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon",        sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon",  sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
