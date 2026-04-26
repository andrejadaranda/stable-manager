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
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div className="grid grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr] gap-3 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500 bg-neutral-50 border-b border-neutral-200">
        <div>Name</div>
        <div>Phone</div>
        <div>Email</div>
        <div>Skill</div>
        <div>Status</div>
        <div>Upcoming</div>
      </div>
      <ul className="divide-y divide-neutral-200">
        {clients.map((c) => (
          <li key={c.id}>
            <Link
              href={`/dashboard/clients/${c.id}`}
              className="grid grid-cols-[2fr_1.2fr_1.6fr_1fr_0.9fr_1fr] gap-3 px-5 py-3.5 text-sm hover:bg-neutral-50 transition-colors items-center"
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
                <span className="text-neutral-500">
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
  return <span className="text-neutral-400">—</span>;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-neutral-100 text-neutral-600 border border-neutral-200"
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-neutral-400"
        }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-neutral-300 rounded-lg bg-white p-10 text-center">
      <p className="text-sm font-semibold text-neutral-800">{title}</p>
      <p className="text-xs text-neutral-500 mt-1">{body}</p>
    </div>
  );
}
