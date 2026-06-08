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
import { listHorsePhotos } from "@/services/horsePhotos";
import { HorseProfileHero } from "@/components/horses/HorseProfileHero";
import { HorseProfileTabs } from "@/components/horses/HorseProfileTabs";
import { OverviewTab } from "@/components/horses/OverviewTab";
import { SessionsTab } from "@/components/horses/SessionsTab";
import { HealthTab } from "@/components/horses/HealthTab";
import { GuestContributorsPanel } from "@/components/horses/GuestContributorsPanel";
import { listGuestContributorTokens } from "@/services/guestContributors";
import { BoardingTab } from "@/components/horses/BoardingTab";
import { PhotoGallery } from "@/components/horses/PhotoGallery";
import { ScheduleRail } from "@/components/horses/ScheduleRail";
import { getCareVisitsForHorse } from "@/services/farrierVisits";
import { getHorseOutstanding } from "@/services/horseBalance";
import { HorseOutstandingCard } from "@/components/horses/HorseOutstandingCard";
import { ComingSoonTab } from "@/components/horses/ComingSoonTab";
import { listChargesForHorse } from "@/services/boarding";
import { listBoardingRates } from "@/services/boardingRates";
import { listChargesForHorse as listMiscChargesForHorse } from "@/services/clientCharges";
import { getClient } from "@/services/clients";
import { getOwnProfile } from "@/services/account";

export const dynamic = "force-dynamic";

type SearchParams = { tab?: string };

const VALID_TABS = ["overview", "photos", "sessions", "boarding", "health", "goals", "media"] as const;
type Tab = (typeof VALID_TABS)[number];

// RFC-4122 UUID regex. We validate before touching the DB so a stray URL like
// /dashboard/horses/new (or any junk in the slot where an id belongs) returns
// a clean 404 instead of crashing Postgres with an "invalid input syntax for
// type uuid" cast error and bubbling a 500 to the user.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function HorseDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const session = await requirePageRole("owner", "employee");

  if (!UUID_RE.test(params.id)) notFound();

  const horse = await getHorseProfileSummary(params.id);
  if (!horse) notFound();

  const tab: Tab =
    (VALID_TABS as readonly string[]).includes(searchParams.tab ?? "")
      ? (searchParams.tab as Tab)
      : "overview";

  // Fetch tab-specific data only for the active tab. Schedule rail is
  // always loaded because it's visible on every tab on desktop.
  const upcomingLessons = await getHorseUpcomingLessons(params.id, 14);

  const canManageCare = session.role === "owner" || session.role === "employee";
  // Outstanding total (boarding + farrier/vet + other) — shown above the
  // tabs so the debt is visible the moment you open the horse.
  const outstanding = await getHorseOutstanding(params.id).catch(() => ({ total_cents: 0, lines: [] }));
  // Farrier/vet visits feed the Health tab (single source of truth).
  const careVisits = await getCareVisitsForHorse(params.id).catch(() => []);

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
    const [charges, ownerClient, allClients, miscCharges, ownProfile, boardingRates] = await Promise.all([
      listChargesForHorse(params.id),
      horse.owner_client_id ? getClient(horse.owner_client_id) : Promise.resolve(null),
      listClients({ activeOnly: true }),
      listMiscChargesForHorse(params.id),
      getOwnProfile().catch(() => null),
      listBoardingRates({ activeOnly: true }).catch(() => []),
    ]);
    tabContent = (
      <BoardingTab
        horseId={params.id}
        horseName={horse.name}
        ownerClient={ownerClient ? { id: ownerClient.id, full_name: ownerClient.full_name } : null}
        monthlyFee={horse.monthly_boarding_fee != null ? Number(horse.monthly_boarding_fee) : null}
        boardingStartDate={(horse as { boarding_start_date?: string | null }).boarding_start_date ?? null}
        availableForLessons={horse.available_for_lessons}
        charges={charges}
        miscCharges={miscCharges}
        clients={allClients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        rates={boardingRates.map((r) => ({ id: r.id, name: r.name, amount: Number(r.amount) }))}
        isOwner={session.role === "owner"}
        accountType={session.accountType === "personal" ? "personal" : "business"}
        selfDisplayName={ownProfile?.full_name ?? undefined}
      />
    );
  } else if (tab === "photos") {
    const photos = await listHorsePhotos(params.id).catch(() => []);
    tabContent = (
      <PhotoGallery
        horseId={params.id}
        initialPhotos={photos}
        canEdit={session.role === "owner" || session.role === "employee"}
      />
    );
  } else if (tab === "health") {
    const canManageGuests = session.role === "owner" || session.role === "employee";
    const [summary, records, guestTokens] = await Promise.all([
      getHealthSummary(params.id),
      listHealthRecords(params.id),
      canManageGuests ? listGuestContributorTokens(params.id).catch(() => []) : Promise.resolve([]),
    ]);
    const appOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.longrein.eu";
    tabContent = (
      <div className="flex flex-col gap-4">
        <HealthTab horseId={params.id} summary={summary} records={records} careVisits={careVisits} careEditable={canManageCare} />
        {canManageGuests && (
          <GuestContributorsPanel
            horseId={params.id}
            initialTokens={guestTokens}
            appOrigin={appOrigin}
          />
        )}
      </div>
    );
  } else if (tab === "goals") {
    tabContent = (
      <ComingSoonTab
        title="Goals & progress — coming June"
        body="Long-term goals per horse and per-rider training arcs ship in the June update. For now keep goals in the horse's Notes field — they'll migrate over when this tab launches."
        availability="Not yet available"
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

      {outstanding.total_cents > 0 && <HorseOutstandingCard outstanding={outstanding} />}

      <HorseProfileTabs activeTab={tab} horseId={params.id} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="min-w-0">{tabContent}</div>
        <ScheduleRail horseId={params.id} lessons={upcomingLessons} />
      </div>
    </div>
  );
}
