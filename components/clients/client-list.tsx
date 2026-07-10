import Link from "next/link";
import type { ClientWithUpcomingCount, SkillLevel } from "@/services/clients";
import { EmptyState } from "@/components/ui";
import { InviteToAppButton } from "@/components/clients/invite-to-app-button";

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro",
};

/** Owner-only props: invite button + balance hidden for employees. */
export function ClientList({
  clients,
  showInviteButton = false,
  showBalance = false,
}: {
  clients: ClientWithUpcomingCount[];
  showInviteButton?: boolean;
  showBalance?: boolean;
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
    <ul className="flex flex-col gap-3">
      {clients.map((c) => {
        const ownerOnly = (c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only ?? false;
        const owes = showBalance && c.balance < 0;
        const hasAccount = Boolean(c.profile_id) || c.has_longrein_account;
        const sub = ownerOnly
          ? "Horse owner"
          : `Rider${c.skill_level ? ` · ${SKILL_LABEL[c.skill_level]}` : hasAccount ? "" : " · no account yet"}`;

        return (
          <li
            key={c.id}
            className="bg-white border border-ink-100 rounded-[20px] shadow-soft overflow-hidden"
          >
            {/* Tappable header → profile */}
            <Link
              href={`/dashboard/clients/${c.id}`}
              className="flex items-center gap-3.5 px-4 pt-4 pb-3 active:scale-[0.99] transition-transform"
            >
              <span
                className={`shrink-0 w-12 h-12 rounded-[15px] inline-flex items-center justify-center text-[15px] font-bold tracking-tight ${
                  ownerOnly ? "bg-saddle-100 text-saddle-700" : "bg-brand-100 text-brand-700"
                }`}
              >
                {initials(c.full_name)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-[17px] leading-tight text-ink-900 truncate">
                    {c.full_name}
                  </span>
                  {c.active && <span className="w-[7px] h-[7px] rounded-full bg-brand-500 shrink-0" aria-label="Active" />}
                </span>
                <span className="block text-[13px] text-ink-500 mt-0.5 truncate">{sub}</span>
              </span>
              <span className="shrink-0 inline-flex items-center">
                {owes ? (
                  <span className="text-[14.5px] font-semibold text-alert-700 tabular-nums whitespace-nowrap">
                    {fmtOwes(-c.balance)} due
                  </span>
                ) : (
                  <svg className="text-ink-300" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
                )}
              </span>
            </Link>

            {/* Bottom bar — phone + lessons/status or invite (outside the Link) */}
            <div className="flex items-center justify-between gap-2.5 mx-4 mb-3.5 pt-3 border-t border-ink-100">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 min-w-0">
                <svg className="text-ink-300 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></svg>
                <span className="truncate tabular-nums">{c.phone ?? "—"}</span>
              </span>

              <span className="shrink-0 flex items-center gap-2">
                <span className="text-[13px] text-ink-500 whitespace-nowrap">
                  <b className="text-ink-800 font-bold tabular-nums">{c.upcoming_count}</b>{" "}
                  {c.upcoming_count === 1 ? "lesson" : "lessons"}
                  {" · "}
                  {owes ? (
                    <span className="text-alert-700 font-semibold">owes</span>
                  ) : hasAccount ? (
                    <span className="text-brand-600 font-semibold">has account</span>
                  ) : (
                    <span className="text-brand-600 font-semibold">settled</span>
                  )}
                </span>
                {showInviteButton && (
                  <InviteToAppButton
                    clientId={c.id}
                    hasPortalAccount={Boolean(c.profile_id)}
                    hasLongreinAccount={c.has_longrein_account}
                    hasPendingInvite={c.has_pending_invite}
                    hasEmail={Boolean(c.email)}
                    compact
                  />
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Up to two initials from a full name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Compact EUR for the owes badge — no decimals (e.g. "€480"). */
function fmtOwes(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
