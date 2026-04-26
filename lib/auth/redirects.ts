import { redirect } from "next/navigation";
import { getSession, type Role, type SessionContext } from "@/lib/auth/session";

// Use inside a dashboard page server component:
//   const session = await requirePageRole("owner", "employee");
// - If unauthenticated -> /login
// - If role not allowed -> /dashboard (which will route them to their home)
export async function requirePageRole(...allowed: Role[]): Promise<SessionContext> {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  if (!allowed.includes(session.role)) redirect("/dashboard");
  return session;
}
