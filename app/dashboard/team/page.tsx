import { requireBusinessAccount } from "@/lib/auth/redirects";
import { listMembers } from "@/services/profiles";
import { MemberList } from "@/components/team/member-list";
import { InviteEmployeePanel } from "@/components/team/invite-forms";

export default async function TeamPage() {
  await requireBusinessAccount("owner");

  // Team = owner + employees only. Clients live on /dashboard/clients
  // (which has its own Invite-to-App flow per #44 — link-based, no
  // password sharing). Mixing them in here was noisy and made it
  // unclear which page to use for which population.
  const members = await listMembers();

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Team</h1>
          <p className="text-sm text-neutral-500 mt-1">
            People who work at the stable. Invite clients on the{" "}
            <a href="/dashboard/clients" className="underline hover:text-neutral-900">Clients</a> page.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a
            href="/dashboard/team/substitute"
            className="h-10 px-3.5 inline-flex items-center rounded-xl text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
          >
            Substitute trainer
          </a>
          <InviteEmployeePanel />
        </div>
      </div>
      <MemberList members={members} />
    </div>
  );
}
