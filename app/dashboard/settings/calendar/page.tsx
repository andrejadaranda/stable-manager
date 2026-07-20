// Settings → Calendar sync.
//  • Export: the signed-in user's private iCal feed URL (Longrein → Google/Apple).
//  • Import: subscribe Longrein to an external calendar (e.g. spouse's work) so
//    its events become busy blocks. Import is staff-only (owner/employee).

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalendarSyncPanel } from "@/components/settings/calendar-sync-panel";
import { ExternalCalendarPanel } from "@/components/settings/external-calendar-panel";
import { getExternalCalendarConfig } from "@/services/external-calendar";

export const dynamic = "force-dynamic";

const APP_ORIGIN = "https://app.longrein.eu";

export default async function CalendarSyncPage() {
  const session = await getSession();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("calendar_token")
    .eq("id", session.userId)
    .maybeSingle();

  const token = (data as { calendar_token: string | null } | null)?.calendar_token ?? null;

  const isStaff = session.role === "owner" || session.role === "employee";
  const external = isStaff ? await getExternalCalendarConfig().catch(() => null) : null;

  return (
    <div className="flex flex-col gap-6">
      {token ? (
        <CalendarSyncPanel
          feedUrl={`${APP_ORIGIN}/api/calendar/${token}`}
          webcalUrl={`${APP_ORIGIN}/api/calendar/${token}`.replace(/^https?:\/\//, "webcal://")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif font-semibold text-[22px] text-ink-900">Calendar sync</h2>
          <p className="text-[13.5px] text-ink-500">
            Your calendar link isn&apos;t ready yet. Refresh in a moment, or contact support if it persists.
          </p>
        </div>
      )}

      {external && (
        <ExternalCalendarPanel
          initial={{
            url: external.url,
            label: external.label,
            syncedAt: external.syncedAt,
            status: external.status,
            blockCount: external.blockCount,
          }}
        />
      )}
    </div>
  );
}
