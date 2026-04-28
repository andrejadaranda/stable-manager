import Link from "next/link";
import type { ClientWithUpcomingCount, SkillLevel } from "@/services/clients";
import { EmptyState, Badge } from "@/components/ui";

const SKILL_LABEL: Record<SkillLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  pro: "Pro",
};

export function ClientList({ clients }: { clients: ClientWithUpcomingCount[] }) {
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
      <div className="grid grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr] gap-3 px-6 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        <div>Name</div>
        <div>Phone</div>
        <div>Email</div>
        <div>Skill</div>
        <div>Status</div>
        <div>Upcoming</div>
      </div>
      <ul>
        {clients.map((c) => (
          <li key={c.id}>
            <Link
              href={`/dashboard/clients/${c.id}`}
              className="grid grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr] gap-3 px-6 py-4 text-sm hover:bg-neutral-50/70 transition-colors items-center"
            >
              <div className="font-semibold text-neutral-900">{c.full_name}</div>
              <div className="text-neutral-700">{c.phone ?? <Dash />}</div>
              <div className="text-neutral-700 truncate">{c.email ?? <Dash />}</div>
              <div className="text-neutral-700">
                {c.skill_level ? SKILL_LABEL[c.skill_level] : <Dash />}
              </div>
              <div>
                <StatusPill active={c.active} />
              </div>
              <div className="text-neutral-700 tabular-nums">
                {c.upcoming_count}{" "}
                <span className="text-neutral-400">
                  {c.upcoming_count === 1 ? "lesson" : "lessons"}
                </span>
              </div>
            </Link>
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
