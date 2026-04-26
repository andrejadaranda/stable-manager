import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

// Role-based home redirect. The dashboard layout already guarantees a session.
export default async function DashboardHome() {
  const session = await getSession();
  if (session.role === "client") redirect("/dashboard/my-lessons");
  redirect("/dashboard/calendar");
}
