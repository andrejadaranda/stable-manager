import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth + stable membership check. The middleware also gates /dashboard
  // by auth, but we re-check here so role-aware code below has a session.
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex bg-neutral-50">
      <Sidebar role={session.role} email={user?.email ?? ""} />
      <main className="flex-1 px-8 py-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
