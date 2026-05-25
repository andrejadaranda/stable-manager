// Live ride tracker page.
//
// Mobile-first — this is THE page riders open from their phone the
// instant they sit in the saddle. Loads the horse picker, mounts the
// LiveTracker client component, and resumes any in-flight session.
//
// Entitlement gate:
//   - Owners + employees of a subscribed stable: full access (free).
//   - Personal account owners: full access (free).
//   - Clients: must have Rider Pro (€2/mo add-on). Otherwise shown
//     RiderProPaywall instead of the tracker.

import { getSession } from "@/lib/auth/session";
import { hasRiderPro } from "@/lib/auth/rider-pro";
import { listHorses } from "@/services/horses";
import { listMyHorses } from "@/services/myHorses";
import { getActiveLiveSession } from "@/services/sessionTracking";
import { LiveTracker } from "@/components/sessions/LiveTracker";
import { RiderProPaywall } from "@/components/sessions/RiderProPaywall";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LiveSessionPage() {
  const ctx = await getSession();

  // All authenticated members can land here; gating happens by
  // entitlement, not role.
  const pro = await hasRiderPro();

  if (!pro.entitled) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Live ride"
          subtitle="Track your route, distance, speed and gait in real time."
        />
        <RiderProPaywall reason={pro.reason} />
      </div>
    );
  }

  // Horse picker source depends on role.
  //   owner/employee: every active horse in the stable
  //   client:         only the horses they're linked to (rider on lessons,
  //                   owned horses, etc.)
  let horsesPicker: Array<{ id: string; name: string }> = [];
  if (ctx.role === "client") {
    const my = await listMyHorses().catch(() => []);
    horsesPicker = my.map((h) => ({ id: h.id, name: h.name }));
  } else {
    const all = await listHorses({ activeOnly: true }).catch(() => []);
    horsesPicker = all.map((h) => ({ id: h.id, name: h.name }));
  }

  const active = await getActiveLiveSession().catch(() => null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live ride"
        subtitle={
          active
            ? "Resuming your in-progress ride. Tap Stop to finish."
            : "Track route, distance and speed in real time."
        }
      />

      <LiveTracker
        horses={horsesPicker}
        resumeSessionId={active?.id ?? null}
      />
    </div>
  );
}
