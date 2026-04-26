import Link from "next/link";
import type { ClientWithUpcomingCount, SkillLevel } from "@/services/clients";

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
        title="No clients yet"
        body='Add your first client with "+ New client" to start scheduling lessons for them.'
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
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-neutral-300"
        }`}
      />
      <span className={active ? "text-neutral-700" : "text-neutral-400"}>
        {active ? "Active" : "Inactive"}
      </span>
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-12 text-center">
      <p className="text-base font-semibold text-neutral-800">{title}</p>
      <p className="text-sm text-neutral-500 mt-1.5">{body}</p>
    </div>
  );
}
