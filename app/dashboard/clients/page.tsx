import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listClientsWithUpcomingCount } from "@/services/clients";
import { ClientList } from "@/components/clients/client-list";
import { CreateClientPanel } from "@/components/clients/create-client-form";
import { PageHeader } from "@/components/ui";

type Filter = "all" | "riders" | "owners";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requirePageRole("owner", "employee");

  const all = await listClientsWithUpcomingCount();

  const filter: Filter =
    searchParams.filter === "riders" ? "riders" :
    searchParams.filter === "owners" ? "owners" :
    "all";

  const filtered = all.filter((c) => {
    const ownerOnly = (c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only ?? false;
    if (filter === "owners") return ownerOnly;
    if (filter === "riders") return !ownerOnly;
    return true;
  });

  const counts = {
    all:    all.length,
    riders: all.filter((c) => !((c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only)).length,
    owners: all.filter((c) =>  ((c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only)).length,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        subtitle="Roster, balances, and upcoming lessons."
        actions={<CreateClientPanel />}
      />

      {/* Filter chips — riders vs horse-owners split */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip href="/dashboard/clients"               label="All"           count={counts.all}    active={filter === "all"} />
        <FilterChip href="/dashboard/clients?filter=riders" label="Riders"        count={counts.riders} active={filter === "riders"} />
        <FilterChip href="/dashboard/clients?filter=owners" label="Horse owners"  count={counts.owners} active={filter === "owners"} />
      </div>

      <ClientList clients={filtered} />
    </div>
  );
}

function FilterChip({
  href, label, count, active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        h-9 inline-flex items-center gap-2 px-3.5 rounded-full text-[12.5px] font-medium transition-colors
        ${active
          ? "bg-brand-700 text-white shadow-sm"
          : "bg-white text-ink-700 hover:bg-ink-100/60 ring-1 ring-ink-200"}
      `}
    >
      {label}
      <span className={`
        tabular-nums text-[11px] px-1.5 rounded-full
        ${active ? "bg-white/20" : "bg-ink-100 text-ink-600"}
      `}>
        {count}
      </span>
    </Link>
  );
}
