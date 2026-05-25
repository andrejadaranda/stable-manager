// Live ride tracker page.
//
// Mobile-first — this is THE page riders open from their phone the
// instant they sit in the saddle. Loads the horse picker, mounts the
// LiveTracker client component, and resumes any in-flight session.
//
// SEO-irrelevant (gated by auth) so we don't pump structured data.

import { getSession, requireRole } from "@/lib/auth/session";
import { listHorses } from "@/services/horses";
import { getActiveLiveSession } from "@/services/sessionTracking";
import { LiveTracker } from "@/components/sessions/LiveTracker";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LiveSessionPage() {
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const [horses, active] = await Promise.all([
    listHorses({ activeOnly: true }).catch(() => []),
    getActiveLiveSession().catch(() => null),
  ]);

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
        horses={horses.map((h) => ({ id: h.id, name: h.name }))}
        resumeSessionId={active?.id ?? null}
      />
    </div>
  );
}
