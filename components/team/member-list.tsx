import type { Member } from "@/services/profiles";

const ROLE_BADGE: Record<Member["role"], string> = {
  owner:    "bg-neutral-900   text-white         border-neutral-900",
  employee: "bg-blue-50       text-blue-800      border-blue-200",
  client:   "bg-emerald-50    text-emerald-800   border-emerald-200",
};

const ROLE_LABEL: Record<Member["role"], string> = {
  owner:    "Owner",
  employee: "Employee",
  client:   "Client",
};

export function MemberList({ members }: { members: Member[] }) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No team members yet.</p>
    );
  }

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div className="grid grid-cols-[2fr_2fr_1fr] gap-3 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 bg-neutral-50 border-b border-neutral-200">
        <div>Name</div>
        <div>Email</div>
        <div>Role</div>
      </div>
      <ul className="divide-y divide-neutral-200">
        {members.map((m) => (
          <li
            key={m.id}
            className="grid grid-cols-[2fr_2fr_1fr] gap-3 px-5 py-3.5 text-sm items-center hover:bg-neutral-50 transition-colors"
          >
            <div className="font-semibold text-neutral-900">
              {m.full_name ?? <span className="text-neutral-400">—</span>}
            </div>
            <div className="text-neutral-700 truncate">
              {m.email ?? <span className="text-neutral-400">—</span>}
            </div>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_BADGE[m.role]}`}
              >
                {ROLE_LABEL[m.role]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
