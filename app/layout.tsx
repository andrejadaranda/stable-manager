// Root layout with full PWA + native-iOS-feel metadata.
//
// On iPhone, Safari → Share → Add to Home Screen will pick up the
// apple-icon, run in a standalone window (no Safari chrome), set the
// status bar color, and use the manifest's name/short_name.

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
// @ts-ignore — installed on Vercel; may be absent in the local sandbox.
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { CookieBanner } from "@/components/legal/cookie-banner";
import { InstallAppBanner } from "@/components/legal/install-app-banner";

export const metadata: Metadata = {
  // Resolves OG/canonical/relative URLs against the production host.
  metadataBase: new URL("https://app.longrein.eu"),
  title: {
    default:  "Longrein.",
    template: "%s · Longrein.",
  },
  // GSC HTML-tag fallback. Paste the token from Search Console into the
  // GSC_SITE_VERIFICATION env var (Vercel → Settings → Environment Vars)
  // if you verify by meta tag instead of DNS. Renders
  // <meta name="google-site-verification" ...> only when the var is set.
  verification: process.env.GSC_SITE_VERIFICATION
    ? { google: process.env.GSC_SITE_VERIFICATION }
    : undefined,
  description:
    "Schedule lessons, track payments, and protect your horses. Built for European riding stables.",
  applicationName: "Longrein.",
  // Apple-specific PWA flags. Safari reads these when "Add to Home
  // Screen" is tapped — they make the launched app run full-screen
  // without the URL bar and use a translucent status bar in the
  // brand-orange palette.
  appleWebApp: {
    capable:    true,
    title:      "Longrein.",
    statusBarStyle: "black-translucent",
  },
  // Open Graph + Twitter previews for shared links.
  openGraph: {
    title:       "Longrein.",
    description: "Modern stable management. Calendar, payments, welfare, packages — one place.",
    siteName:    "Longrein.",
    type:        "website",
  },
  // Manifest for Android Chrome's Add-to-Home-Screen + Lighthouse PWA
  // checks. Resolved via app/manifest.ts.
  manifest: "/manifest.webmanifest",
};

// Viewport + theme color live in their own export per Next 14.2.
export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Safari's status bar tint when the app is launched from the home
  // screen. We use the warm-cream surface so the bar blends with the
  // app surface instead of jumping to white.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F4EE" },
    { media: "(prefers-color-scheme: dark)",  color: "#1E3A2A" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // GA4 measurement ID. Set NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX in Vercel env
  // (both projects) once the GA4 web stream exists. Until then the gtag
  // scripts don't render, so there's zero overhead and no broken pixel.
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <CookieBanner />
        {/* PWA install nudge for iOS Safari + Android Chrome visitors.
            Auto-hidden when already running in standalone mode. */}
        <InstallAppBanner />
        {/* Vercel Web Analytics — counts visitors and page views.
            Privacy-first (no cookies). Hobby tier: 2,500 events/mo. */}
        <Analytics />
        {/* Vercel Speed Insights — Core Web Vitals (load speed, INP, CLS).
            Free on Hobby. Starts collecting from real visits once deployed. */}
        <SpeedInsights />
        {/* Google Analytics 4 — loads only when NEXT_PUBLIC_GA_ID is set.
            afterInteractive keeps it off the critical render path. */}
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true });`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
