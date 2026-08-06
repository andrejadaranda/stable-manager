// Own web app manifest for the command centre.
//
// Served from a route handler rather than Next's app/manifest.ts
// convention because that convention only supports ONE manifest, at the
// application root — and that one already belongs to Longrein itself
// (app/manifest.ts, start_url /dashboard). This gives /personal its own
// identity on the home screen: separate name, separate icon, separate
// scope, without touching Longrein's.
//
// `scope: /personal` is what makes the installed app behave like an app:
// navigations inside the scope stay in the standalone window, anything
// outside (a link to the main Longrein dashboard, say) opens in Safari.

import { NextResponse } from "next/server";
import { getPersonalContext } from "@/lib/personal/access";

export const dynamic = "force-dynamic";

export async function GET() {
  // The manifest describes a private app; don't serve it to strangers.
  // (Not a security boundary — the manifest holds no secrets — but there
  // is no reason for it to be publicly enumerable either.)
  const ctx = await getPersonalContext();
  if (!ctx) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(
    {
      name: "Andrėja Dashboard",
      short_name: "Andrėja",
      description: "Asmeninė valdymo lenta — TJK, Longrein, finansai, tikslai.",
      display: "standalone",
      orientation: "portrait",
      start_url: "/personal",
      scope: "/personal",
      // Arena Cream base, Paddock Green chrome — the locked Longrein
      // palette, so this reads as part of the same family as the product.
      background_color: "#F8F4EE",
      theme_color: "#1E3A2A",
      categories: ["productivity", "business"],
      icons: [
        { src: "/personal/icon", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/personal/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "/personal/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
      ],
    },
    {
      headers: {
        "content-type": "application/manifest+json",
        "cache-control": "private, no-store",
      },
    },
  );
}
