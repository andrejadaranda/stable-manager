import { requirePageRole } from "@/lib/auth/redirects";
import { listMembers } from "@/services/profiles";
import { listUnlinkedClients } from "@/services/clients";
import { MemberList } from "@/components/team/member-list";
import {
  InviteEmployeePanel,
  InviteClientPanel,
} from "@/components/team/invite-forms";

export default async function TeamPage() {
  await requirePageRole("owner");

  const [members, unlinkedClients] = await Promise.all([
    listMembers(),
    listUnlinkedClients(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Team</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Invite employees to manage operations or grant clients portal access.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <InviteClientPanel unlinkedClients={unlinkedClients} />
          <InviteEmployeePanel />
        </div>
      </div>
      <MemberList members={members} />
    </div>
  );
}
