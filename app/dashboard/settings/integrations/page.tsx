import { requirePageRole } from "@/lib/auth/redirects";
import { getConnectionPublic, listGoogleCalendars } from "@/services/googleCalendar";
import { GoogleCalendarPanel } from "@/components/settings/google-calendar-panel";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { google?: string };
}) {
  await requirePageRole("owner", "employee", "client");

  const connection = await getConnectionPublic().catch(() => null);
  const calendars = connection ? await listGoogleCalendars().catch(() => []) : [];
  const flash =
    searchParams.google === "connected" ? "connected" :
    searchParams.google === "denied" ? "denied" :
    searchParams.google === "error" ? "error" :
    null;

  return <GoogleCalendarPanel connection={connection} calendars={calendars} flash={flash} />;
}
