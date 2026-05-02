import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { FlashToast } from "@/components/ui";
import { getStableFeatures, DEFAULT_FEATURES } from "@/services/features";
import { isUserOnboarded } from "@/services/onboardingTour";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { CommandPalette } from "@/components/search/command-palette";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth + stable membership check. Middleware also gates /dashboard.
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Both used for sidebar filtering + first-run welcome tour gating.
  // Failures fall back to defaults so a partial migration / bad row
  // never blocks navigation.
  const [features, onboarded] = await Promise.all([
    getStableFeatures().catch(() => DEFAULT_FEATURES),
    isUserOnboarded().catch(() => true),
  ]);

  return (
    <div className="min-h-screen md:flex">
      <Sidebar role={session.role} email={user?.email ?? ""} features={features} />
      <main className="flex-1 px-4 md:px-10 py-6 md:py-10 max-w-[1400px] mx-auto w-full">
        {children}
      </main>
      {/* FlashToast reads ?ok / ?err from URL — wrap in Suspense
          because useSearchParams suspends during streaming. */}
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      {/* First-time welcome tour. Only shows when profiles.onboarded_at
          is NULL. Users can replay it from the profile menu later. */}
      {!onboarded && <WelcomeTour role={session.role} />}

      {/* Cmd+K global search palette. Hidden until shortcut/triggered. */}
      <CommandPalette />
    </div>
  );
}
