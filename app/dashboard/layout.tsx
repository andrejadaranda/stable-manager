import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { FlashToast } from "@/components/ui";

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

  return (
    <div className="min-h-screen md:flex">
      <Sidebar role={session.role} email={user?.email ?? ""} />
      <main className="flex-1 px-4 md:px-10 py-6 md:py-10 max-w-[1400px] mx-auto w-full">
        {children}
      </main>
      {/* FlashToast reads ?ok / ?err from URL — wrap in Suspense
          because useSearchParams suspends during streaming. */}
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
    </div>
  );
}
