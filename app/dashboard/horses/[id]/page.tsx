// /dashboard/horses/[id] — premium Horse Profile screen.
//
// Phase 1 scope:
//   - Sticky hero (photo, name, breed/age, status pill, owner badge,
//     KPI strip, primary action)
//   - Tabs: Overview / Sessions / Health / Goals / Media
//     (Health, Goals, Media render Coming-soon placeholders for now)
//   - Right rail with the 7-day schedule
//
// Visibility: staff only in Phase 1 (matches existing horses RLS).
// Owner-client and rider-client lenses come in Phase 2.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import {
  getHorseProfileSummary,
  getHorseHeatmap,
  getHorseTypeBreakdown,
  getHorseUpcomingLessons,
} from "@/services/horseProfile";
import { listSessions } from "@/services/sessions";
import { listClients } from "@/services/clients";
import { getHealthSummary, listHealthRecords } from "@/services/horseHealth";
import { HorseProfileHero } from "@/components/horses/HorseProfileHero";
import { HorseProfileTabs } from "@/components/horses/HorseProfileTabs";
import { OverviewTab } from "@/components/horses/OverviewTab";
import { SessionsTab } from "@/components/horses/SessionsTab";
import { HealthTab } from "@/components/horses/HealthTab";
import { BoardingTab } from "@/components/horses/BoardingTab";
import { ScheduleRail } from "@/components/horses/ScheduleRail";
import { ComingSoonTab } from "@/components/horses/ComingSoonTab";
import { listChargesForHorse } from "@/services/boarding";
import { getClient } from "@/services/clients";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

const VALID_TABS = ["overview", "sessions", "boarding", "health", "goals", "media"] as const;
type Tab = (typeof VALID_TABS)[number];

export default async function HorseDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const session = await requirePageRole("owner", "employee");

  const horse = await getHorseProfileSummary(params.id);
  if (!horse) notFound();

  const tab: Tab =
    (VALID_TABS as readonly string[]).includes(searchParams.tab ?? "")
      ? (searchParams.tab as Tab)
      : "overview";

  // Fetch tab-specific data only for the active tab. Schedule rail is
  // always loaded because it's visible on every tab on desktop.
  const upcomingLessons = await getHorseUpcomingLessons(params.id, 14);

  let tabContent: React.ReactNode = null;
  if (tab === "overview") {
    const [heatmap, breakdown, recentSessions] = await Promise.all([
      getHorseHeatmap(params.id, 84),
      getHorseTypeBreakdown(params.id, 30),
      listSessions({ horseId: params.id, limit: 5 }),
    ]);
    tabContent = (
      <OverviewTab
        horse={horse}
        heatmap={heatmap}
        breakdown={breakdown}
        recentSessions={recentSessions}
      />
    );
  } else if (tab === "sessions") {
    const [sessions, clients] = await Promise.all([
      listSessions({ horseId: params.id, limit: 100 }),
      listClients({ activeOnly: true }),
    ]);
    tabContent = (
      <SessionsTab
        sessions={sessions}
        horseId={params.id}
        clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
      />
    );
  } else if (tab === "boarding") {
    const [charges, ownerClient, allClients] = await Promise.all([
      listChargesForHorse(params.id),
      horse.owner_client_id ? getClient(horse.owner_client_id) : Promise.resolve(null),
      listClients({ activeOnly: true }),
    ]);
    tabContent = (
      <BoardingTab
        horseId={params.id}
        horseName={horse.name}
        ownerClient={ownerClient ? { id: ownerClient.id, full_name: ownerClient.full_name } : null}
        monthlyFee={horse.monthly_boarding_fee != null ? Number(horse.monthly_boarding_fee) : null}
        availableForLessons={horse.available_for_lessons}
        charges={charges}
        clients={allClients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        isOwner={session.role === "owner"}
      />
    );
  } else if (tab === "health") {
    const [summary, records] = await Promise.all([
      getHealthSummary(params.id),
      listHealthRecords(params.id),
    ]);
    tabContent = <HealthTab horseId={params.id} summary={summary} records={records} />;
  } else if (tab === "goals") {
    tabContent = (
      <ComingSoonTab
        title="Goals & progress"
        body="Long-term goals for this horse plus a per-rider training arc."
        availability="Phase 3"
      />
    );
  } else if (tab === "media") {
    tabContent = (
      <ComingSoonTab
        title="Media"
        body="Training photos and videos. Trainers can tag specific riders."
        availability="Phase 5"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dashboard/horses"
        className="text-sm text-ink-500 hover:text-ink-900 w-fit inline-flex items-center gap-1"
      >
        <span aria-hidden>←</span> Horses
      </Link>

      <HorseProfileHero horse={horse} />

      <HorseProfileTabs activeTab={tab} horseId={params.id} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="min-w-0">{tabContent}</div>
        <ScheduleRail horseId={params.id} lessons={upcomingLessons} />
      </div>
    </div>
  );
}
