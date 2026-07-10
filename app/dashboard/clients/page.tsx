import Link from "next/link";
import { requireBusinessAccount } from "@/lib/auth/redirects";
import { listClientsWithUpcomingCount } from "@/services/clients";
import { ClientListWithSearch } from "@/components/clients/client-list-search";
import { CreateClientPanel } from "@/components/clients/create-client-form";
import { PageHeader } from "@/components/ui";

type Filter = "all" | "riders" | "owners";

type Sort = "name" | "recent" | "owes";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { filter?: string; sort?: string };
}) {
  const session = await requireBusinessAccount("owner", "employee");
  const isOwner = session.role === "owner";

  const all = await listClientsWithUpcomingCount();

  const filter: Filter =
    searchParams.filter === "riders" ? "riders" :
    searchParams.filter === "owners" ? "owners" :
    "all";

  // "owes" sort is owner-only — employees never see balances.
  const sort: Sort =
    searchParams.sort === "recent" ? "recent" :
    searchParams.sort === "owes" && isOwner ? "owes" :
    "name";

  const filtered = all.filter((c) => {
    const ownerOnly = (c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only ?? false;
    if (filter === "owners") return ownerOnly;
    if (filter === "riders") return !ownerOnly;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "owes") return (a.balance ?? 0) - (b.balance ?? 0); // most negative (owes most) first
    if (sort === "recent") {
      const at = new Date((a as typeof a & { created_at?: string }).created_at ?? 0).getTime();
      const bt = new Date((b as typeof b & { created_at?: string }).created_at ?? 0).getTime();
      return bt - at;
    }
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });

  const counts = {
    all:    all.length,
    riders: all.filter((c) => !((c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only)).length,
    owners: all.filter((c) =>  ((c as typeof c & { is_horse_owner_only?: boolean }).is_horse_owner_only)).length,
  };

  // Build a URL preserving the other axis (filter ↔ sort) so chips compose.
  const qs = (next: Partial<{ filter: Filter; sort: Sort }>) => {
    const f = next.filter ?? filter;
    const s = next.sort ?? sort;
    const p = new URLSearchParams();
    if (f !== "all")  p.set("filter", f);
    if (s !== "name") p.set("sort", s);
    const str = p.toString();
    return str ? `/dashboard/clients?${str}` : "/dashboard/clients";
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
        <FilterChip href={qs({ filter: "all" })}    label="All"          count={counts.all}    active={filter === "all"} />
        <FilterChip href={qs({ filter: "riders" })} label="Riders"       count={counts.riders} active={filter === "riders"} />
        <FilterChip href={qs({ filter: "owners" })} label="Horse owners" count={counts.owners} active={filter === "owners"} />
      </div>

      {/* Sort row — "Owes" floats clients who owe the most to the top,
          owner-only since it exposes balances. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.12em] text-ink-400 mr-1 font-bold">Sort</span>
        <div className="inline-flex bg-surface-sunken rounded-full p-[3px]">
          <SortChip href={qs({ sort: "name" })}   label="Name"   active={sort === "name"} />
          <SortChip href={qs({ sort: "recent" })} label="Recent" active={sort === "recent"} />
          {isOwner && (
            <SortChip href={qs({ sort: "owes" })} label="Owes" active={sort === "owes"} />
          )}
        </div>
      </div>

      <ClientListWithSearch
        clients={sorted}
        showInviteButton={isOwner}
        showBalance={isOwner}
      />
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

function SortChip({
  href, label, active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        inline-flex items-center px-4 py-[7px] rounded-full text-[14px] font-semibold transition-colors
        ${active
          ? "bg-brand-700 text-white shadow-sm"
          : "text-ink-500 hover:text-ink-800"}
      `}
    >
      {label}
    </Link>
  );
}
