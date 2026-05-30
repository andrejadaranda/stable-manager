"use client";

// Client-side instant search wrapper around <ClientList />. Same
// rationale as HorseListWithSearch — at 100+ clients, name search is
// indispensable; pagination is overkill until 500+.

import { useState, useMemo } from "react";
import type { ClientWithUpcomingCount } from "@/services/clients";
import { ClientList } from "./client-list";

export function ClientListWithSearch({
  clients,
  showInviteButton = false,
  showBalance = false,
}: {
  clients: ClientWithUpcomingCount[];
  showInviteButton?: boolean;
  showBalance?: boolean;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => {
      if (c.full_name?.toLowerCase().includes(needle))         return true;
      if (c.email?.toLowerCase().includes(needle))             return true;
      if (c.phone?.toLowerCase().includes(needle))             return true;
      return false;
    });
  }, [clients, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${clients.length} client${clients.length === 1 ? "" : "s"} by name, email or phone…`}
          className="
            w-full h-10 pl-10 pr-3 rounded-xl border border-ink-200
            text-sm bg-white text-ink-900 placeholder:text-ink-400
            focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500
          "
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {q.trim() && (
        <p className="text-[12px] text-ink-500 -mt-1.5">
          Showing {filtered.length} of {clients.length}
        </p>
      )}

      <ClientList clients={filtered} showInviteButton={showInviteButton} showBalance={showBalance} />
    </div>
  );
}
