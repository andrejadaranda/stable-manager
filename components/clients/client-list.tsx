import Link from "next/link";
import type { ClientWithUpcomingCount, SkillLevel } from "@/services/clients";
import { EmptyState, Badge } from "@/components/ui";
import { InviteToAppButton } from "@/components/clients/invite-to-app-button";

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro",
};

/** Owner-only props: invite button hidden for employees. */
export function ClientList({
  clients,
  showInviteButton = false,
}: {
  clients: ClientWithUpcomingCount[];
  showInviteButton?: boolean;
}) {
  if (clients.length === 0) {
    return (
      <EmptyState
        title="No clients on your roster yet"
        body="Add a client to start booking lessons and tracking balances. You can invite them to the client portal later."
        primary={{ label: "Add your first client", href: "/dashboard/clients?new=1" }}
      />
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header only on md+; mobile uses a stacked card per row. The
          column template grows by one auto-width column when invite
          buttons are enabled, so we don't clobber the existing layout
          for non-owners. */}
      <div
        className={`hidden md:grid gap-3 px-5 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400 ${
          showInviteButton
            ? "grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr_auto]"
            : "grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr]"
        }`}
      >
        <div>Name</div>
        <div>Phone</div>
        <div>Email</div>
        <div>Skill</div>
        <div>Status</div>
        <div>Upcoming</div>
        {showInviteButton && <div className="text-right">Portal</div>}
      </div>
      <ul className="divide-y divide-ink-100/60 md:divide-y-0">
        {clients.map((c) => (
          <li key={c.id} className="relative">
            {/* The invite button sits ABSOLUTELY positioned at the
                right edge so its click doesn't trigger the row-wide
                <Link>. The link itself stays full-width for keyboard
                navigation; mouse users still get the inline action. */}
            <Link
              href={`/dashboard/clients/${c.id}`}
              className={`
                block px-4 md:px-5 py-3.5 md:py-4 text-sm
                hover:bg-neutral-50/70 transition-colors
                md:grid md:gap-3 md:items-center
                ${showInviteButton
                  ? "md:grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr_auto]"
                  : "md:grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr]"}
              `}
            >
              <div className="flex items-center justify-between md:block min-w-0">
                <span className="font-semibold text-neutral-900 truncate">{c.full_name}</span>
                <span className="md:hidden ml-2 shrink-0"><StatusPill active={c.active} /></span>
              </div>
              <div className="text-neutral-700 hidden md:block truncate">{c.phone ?? <Dash />}</div>
              <div className="text-neutral-700 hidden md:block truncate">{c.email ?? <Dash />}</div>
              <div className="text-neutral-700 hidden md:block">
                {c.skill_level ? SKILL_LABEL[c.skill_level] : <Dash />}
              </div>
              <div className="hidden md:block"><StatusPill active={c.active} /></div>
              <div className="text-neutral-700 tabular-nums hidden md:block">
                {c.upcoming_count}{" "}
                <span className="text-neutral-400">
                  {c.upcoming_count === 1 ? "lesson" : "lessons"}
                </span>
              </div>
              {showInviteButton && (
                <div className="hidden md:flex md:justify-end">
                  {/* Spacer cell — actual button sits absolutely below */}
                  <span aria-hidden className="opacity-0 select-none">
                    placeholder
                  </span>
                </div>
              )}

              {/* Mobile-only meta row */}
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-neutral-600 md:hidden">
                {c.phone && <span className="tabular-nums">{c.phone}</span>}
                {c.email && <span className="truncate max-w-[16rem]">{c.email}</span>}
                {c.skill_level && (
                  <span className="text-neutral-500">{SKILL_LABEL[c.skill_level]}</span>
                )}
                <span className="text-neutral-500 tabular-nums">
                  {c.upcoming_count} {c.upcoming_count === 1 ? "lesson" : "lessons"}
                </span>
              </div>
            </Link>

            {/* Inline invite action — sits inside the row visually but
                outside the <Link> click region so it doesn't navigate
                away. Owner-only via the showInviteButton gate. */}
            {showInviteButton && (
              <div className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 hidden md:block z-10">
                <InviteToAppButton
                  clientId={c.id}
                  hasPortalAccount={Boolean(c.profile_id)}
                  hasLongreinAccount={c.has_longrein_account}
                  hasPendingInvite={c.has_pending_invite}
                  hasEmail={Boolean(c.email)}
                  compact
                />
              </div>
            )}
            {showInviteButton && (
              <div className="md:hidden px-4 pb-3 -mt-1 flex justify-end">
                <InviteToAppButton
                  clientId={c.id}
                  hasPortalAccount={Boolean(c.profile_id)}
                  hasLongreinAccount={c.has_longrein_account}
                  hasPendingInvite={c.has_pending_invite}
                  hasEmail={Boolean(c.email)}
                  compact
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dash() {
  return <span className="text-neutral-300">—</span>;
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot>Active</Badge>
  ) : (
    <Badge tone="muted" dot>Inactive</Badge>
  );
}
