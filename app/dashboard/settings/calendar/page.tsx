// Settings → Calendar sync. Shows the signed-in user's private iCal feed URL.

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalendarSyncPanel } from "@/components/settings/calendar-sync-panel";

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

  if (!token) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-serif font-semibold text-[22px] text-ink-900">Calendar sync</h2>
        <p className="text-[13.5px] text-ink-500">
          Your calendar link isn&apos;t ready yet. Refresh in a moment, or contact support if it persists.
        </p>
      </div>
    );
  }

  const feedUrl = `${APP_ORIGIN}/api/calendar/${token}`;
  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");

  return <CalendarSyncPanel feedUrl={feedUrl} webcalUrl={webcalUrl} />;
}
