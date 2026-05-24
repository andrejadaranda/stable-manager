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

// Use inside a dashboard page that is BUSINESS-ONLY (clients, lessons,
// finance, inbox, team, calendar, etc — anything that requires multiple
// users / a roster). Personal accounts (B2C €9/€15) own their stable but
// have no clients, no team, no billing collection — so these pages would
// either render an empty trap or worse, expose UI that doesn't apply.
//
// This sits ON TOP of requirePageRole: also rejects role=owner accounts
// whose stable.account_type === 'personal'. Sidebar hides the links, but
// URL access still works without this guard.
export async function requireBusinessAccount(
  ...allowed: Role[]
): Promise<SessionContext> {
  const session = await requirePageRole(...allowed);
  if (session.accountType === "personal") {
    redirect("/dashboard");
  }
  return session;
}
