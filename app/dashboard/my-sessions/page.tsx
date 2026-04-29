// Client portal — "Your rides".
//
// Refresh (2026-04-29):
//   * Premium hero matches /dashboard/my-lessons aesthetic.
//   * Personal KPI strip — total rides, hours saddled, top horse, streak.
//   * Type breakdown chip row showing how the rider's time splits.
//   * Empty state with motivational copy + clear next step.

import { requirePageRole } from "@/lib/auth/redirects";
import { listMySessions, getMySessionStats } from "@/services/sessions";
import { SessionList } from "@/components/sessions/session-list";
import { SessionsHero } from "@/components/sessions/sessions-hero";

export const dynamic = "force-dynamic";

export default async function MySessionsPage() {
  await requirePageRole("client");

  const [sessions, stats] = await Promise.all([
    listMySessions(50),
    getMySessionStats(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SessionsHero
        title="Your rides"
        subtitle="Every session you've ridden, with notes from your trainer."
        stats={stats}
        scope="client"
      />

      <SessionList sessions={sessions} />
    </div>
  );
}
