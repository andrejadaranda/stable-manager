// Root layout with full PWA + native-iOS-feel metadata.
//
// On iPhone, Safari → Share → Add to Home Screen will pick up the
// apple-icon, run in a standalone window (no Safari chrome), set the
// status bar color, and use the manifest's name/short_name.

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CookieBanner } from "@/components/legal/cookie-banner";

export const metadata: Metadata = {
  title: {
    default:  "Longrein.",
    template: "%s · Longrein.",
  },
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
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
