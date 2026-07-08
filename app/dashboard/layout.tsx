import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { FlashToast } from "@/components/ui";
import { getStableFeatures, DEFAULT_FEATURES } from "@/services/features";
import { isUserOnboarded } from "@/services/onboardingTour";
import { getOwnProfile } from "@/services/account";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { CommandPalette } from "@/components/search/command-palette";
import { ReportProblemButton } from "@/components/feedback/ReportProblemButton";
import { NativePushRegister } from "@/components/push/native-push-register";

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

  // Sidebar context. Three pre-existing parallel fetches plus the inbox
  // count fan-out. The inbox count is computed inline against ONE shared
  // supabase client — calling the per-service countOpen* helpers here
  // would re-run getSession() (i.e. supabase.auth.getUser()) on every
  // helper and trip the Supabase Auth rate limit.
  const showsInbox =
    session.accountType !== "personal" &&
    (session.role === "owner" || session.role === "employee");

  // Pending-count helper: relies on RLS so we don't need explicit stable_id
  // filtering. Returns 0 on any error so a stats hiccup never blocks nav.
  // `head: true` makes the query count-only — no rows shipped over the wire.
  const countPending = async (table: "lesson_requests" | "care_requests" | "stable_join_requests"): Promise<number> => {
    try {
      const { count } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [features, onboarded, ownProfile, lessonReqCount, careReqCount, joinReqCount] =
    await Promise.all([
      getStableFeatures().catch(() => DEFAULT_FEATURES),
      isUserOnboarded().catch(() => true),
      getOwnProfile().catch(() => null),
      showsInbox ? countPending("lesson_requests") : Promise.resolve(0),
      showsInbox ? countPending("care_requests")   : Promise.resolve(0),
      // Join requests are owner-only (employees can't approve them).
      showsInbox && session.role === "owner"
        ? countPending("stable_join_requests")
        : Promise.resolve(0),
    ]);
  const inboxCount = lessonReqCount + careReqCount + joinReqCount;

  return (
    <div className="min-h-screen md:flex">
      <Sidebar
        role={session.role}
        accountType={session.accountType}
        email={user?.email ?? ""}
        fullName={ownProfile?.full_name ?? null}
        features={features}
        photoUrl={ownProfile?.photo_url ?? null}
        inboxCount={inboxCount}
      />
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
      {!onboarded && <WelcomeTour role={session.role} accountType={session.accountType} />}

      {/* Cmd+K global search palette. Hidden until shortcut/triggered. */}
      <CommandPalette />

      {/* iOS app: register the APNs device token for lesson pushes.
          No-op on web + on native builds without the push entitlement. */}
      <NativePushRegister />

      {/* Founding 15 launch insurance — floating "Report a problem" button.
          Bottom-right pill, single click → modal → email lands in
          hello@longrein.eu (or FEEDBACK_TO_EMAIL override). Always visible
          to signed-in users; not rendered on marketing/login pages. */}
      <ReportProblemButton />
    </div>
  );
}
