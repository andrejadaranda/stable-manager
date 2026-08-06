// Shell for the private command centre.
//
// Why /personal and not /dashboard/personal (as originally sketched):
// everything under /dashboard/* is wrapped by app/dashboard/layout.tsx,
// which renders the Longrein sidebar, the welcome tour, the command
// palette and the report-problem button. A nested route CANNOT opt out
// of a parent layout in the App Router. Getting a clean full-screen PWA
// there would have meant editing the shared dashboard layout — i.e.
// touching the render path of every existing Longrein page, which is
// exactly the regression risk we were asked to avoid.
//
// /personal is a sibling of /dashboard: its own layout, its own chrome,
// its own manifest and service-worker scope. It shares nothing with the
// product except the Supabase client and the design tokens. Removing the
// whole feature is `rm -rf app/personal` plus the teardown block in
// migration 110.
//
// It also sits outside middleware's /dashboard subscription gate, which
// is correct — this is an internal tool, not a billable seat.

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getPersonalContext } from "@/lib/personal/access";
import { PersonalNav } from "@/components/personal/personal-nav";
import { PersonalServiceWorker } from "@/components/personal/service-worker";

export const metadata: Metadata = {
  title: {
    default: "Andrėja",
    template: "%s · Andrėja",
  },
  // Keep this page (and the whole subtree) out of every index. It is
  // private by access control; this is belt-and-braces so it never shows
  // up in a search result or a link preview.
  robots: { index: false, follow: false, nocache: true },
  manifest: "/personal/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Andrėja",
    // Dark green status bar area blends into the app header.
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // `viewportFit: cover` + the env(safe-area-inset-*) padding below is
  // what makes the standalone app fill an iPhone 15 Pro's display
  // properly instead of letterboxing around the Dynamic Island.
  viewportFit: "cover",
  themeColor: "#1E3A2A",
};

// Personal data, always live. Never cache a page that shows "who hasn't
// ridden in 14 days" — a stale answer here is a wrong answer.
export const dynamic = "force-dynamic";

export default async function PersonalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The gate. Not signed in, not allowlisted, or the allowlist row is
  // disabled => this route does not exist as far as the caller is
  // concerned. notFound() renders the standard Next 404.
  const ctx = await getPersonalContext();
  if (!ctx) notFound();

  return (
    <div className="personal-root min-h-[100dvh] bg-surface text-ink-900">
      <PersonalServiceWorker />
      <div className="mx-auto w-full max-w-[560px] px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </div>
      <PersonalNav />
    </div>
  );
}
