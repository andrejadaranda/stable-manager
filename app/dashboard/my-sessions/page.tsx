// Client portal — "My rides".
// Mirrors /dashboard/my-lessons in scope and styling. Read-only feed of every
// session where the signed-in client was the rider.

import { requirePageRole } from "@/lib/auth/redirects";
import { listMySessions } from "@/services/sessions";
import { SessionList } from "@/components/sessions/session-list";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MySessionsPage() {
  await requirePageRole("client");

  const sessions = await listMySessions(50);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My rides"
        subtitle="Every session you've ridden, with notes from your trainer."
      />
      <SessionList sessions={sessions} />
    </div>
  );
}
