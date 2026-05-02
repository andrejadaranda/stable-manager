// Sessions index — staff log + recent activity feed.
//
// Refresh notes (2026-04-29):
//   * Premium hero with Fraunces title + KPI strip (this week / this
//     month / top horse / streak).
//   * Log form is collapsed behind a "+ Log session" CTA so the page
//     leads with data, not a form. The "log in 15 seconds" wedge stays
//     intact — one click expands the form.
//   * List uses the same card aesthetic as the calendar lessons.

import { listSessions, getStableSessionStats, type SessionStats } from "@/services/sessions";
import { listHorses } from "@/services/horses";
import { listClients } from "@/services/clients";
import { getSession, requireRole } from "@/lib/auth/session";
import { getStableFeatures } from "@/services/features";
import { LogSessionPanel } from "@/components/sessions/log-session-panel";
import { SessionList } from "@/components/sessions/session-list";
import { SessionsHero } from "@/components/sessions/sessions-hero";
import { FeatureDisabled, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const features = await getStableFeatures();
  if (!features.sessions) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Sessions" />
        <FeatureDisabled feature="Session log" isOwner={ctx.role === "owner"} />
      </div>
    );
  }

  // Defensive .catch — if any of these blows up due to seed-data
  // edge cases, the rest of the page still renders. The user reported
  // a client-side crash post-seed; isolating each call helps localise
  // the failure on next reproduction.
  const [horses, clients, recent, stats] = await Promise.all([
    listHorses({ activeOnly: true }).catch(() => []),
    listClients({ activeOnly: true }).catch(() => []),
    listSessions({ limit: 50 }).catch(() => []),
    getStableSessionStats().catch((): SessionStats => ({
      weekCount:           0,
      weekMinutes:         0,
      monthCount:          0,
      monthMinutes:        0,
      totalCount:          0,
      totalMinutes:        0,
      topHorse:            null,
      currentStreakWeeks:  0,
      typeBreakdown:       [],
    })),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SessionsHero
        title="Sessions"
        subtitle="Every ride that happened — training, hacks, turnout. Sessions are NOT billed (Lessons are). They feed the welfare workload count."
        stats={stats}
        scope="stable"
        action={
          <LogSessionPanel
            horses={horses.map((h) => ({ id: h.id, name: h.name }))}
            clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
          />
        }
      />

      <section aria-label="Recent sessions" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-navy-900">Recent</h2>
        <SessionList sessions={recent} canDelete />
      </section>
    </div>
  );
}
