// Sessions index — staff log + recent activity feed.
// The page is intentionally compact: form on top, list below. The "log in
// 15 seconds" wedge demands the form is always visible, never hidden in a
// modal.

import { listSessions } from "@/services/sessions";
import { listHorses } from "@/services/horses";
import { listClients } from "@/services/clients";
import { getSession, requireRole } from "@/lib/auth/session";
import { LogSessionForm } from "@/components/sessions/log-session-form";
import { SessionList } from "@/components/sessions/session-list";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  // Gate at the page level. RLS would block anyway, but failing cleanly
  // in app code yields a better error than a Postgres violation.
  const ctx = await getSession();
  requireRole(ctx, "owner", "employee");

  const [horses, clients, recent] = await Promise.all([
    listHorses({ activeOnly: true }),
    listClients({ activeOnly: true }),
    listSessions({ limit: 50 }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tightest text-ink-900">
          Sessions
        </h1>
        <p className="text-ink-600 text-sm md:text-base">
          Every ride that happened, in one place. Log a session in 15 seconds.
        </p>
      </header>

      <section
        aria-label="Log a session"
        className="bg-surface rounded-2xl shadow-soft p-4 md:p-6"
      >
        <LogSessionForm
          horses={horses.map((h) => ({ id: h.id, name: h.name }))}
          clients={clients.map((c) => ({ id: c.id, full_name: c.full_name }))}
        />
      </section>

      <section aria-label="Recent sessions" className="space-y-3">
        <h2 className="text-lg font-medium text-ink-800">Recent</h2>
        <SessionList sessions={recent} />
      </section>
    </div>
  );
}
