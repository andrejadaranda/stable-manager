import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** /dashboard/settings = land on the most relevant tab for the role. */
export default async function SettingsIndex() {
  const session = await getSession().catch(() => null);
  if (!session) redirect("/login");
  if (session.role === "owner") redirect("/dashboard/settings/stable");
  redirect("/dashboard/settings/profile");
}
