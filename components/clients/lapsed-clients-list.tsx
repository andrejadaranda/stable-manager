"use client";

// The "haven't been in for 2+ weeks" list — every lapsed client with when they
// were last seen, a link into their profile, and a "Don't show" action to drop
// one-off riders (tourists, trials) from the reactivation list for good.

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissLapsedClientAction } from "@/app/dashboard/clients/lapsed-actions";
import type { LapsedClient } from "@/services/clients";

export function LapsedClientsList({ clients }: { clients: LapsedClient[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const visible = clients.filter((c) => !hidden.has(c.id));

  function dismiss(id: string) {
    setHidden((prev) => new Set(prev).add(id)); // optimistic
    startTransition(async () => {
      const res = await dismissLapsedClientAction(id);
      if (!res.ok) setHidden((prev) => { const n = new Set(prev); n.delete(id); return n; });
    });
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Vilnius" });

  if (visible.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-ink-100 shadow-soft p-8 text-center">
        <p className="text-sm text-ink-500">No lapsed clients — everyone active has been in within the last 2 weeks. 🎉</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] text-ink-500">
        {visible.length} client{visible.length === 1 ? "" : "s"} haven’t had a lesson in 2+ weeks (and nothing booked).
        Tap a name to reach out, or “Don’t show” to drop one-offs like tourists.
      </p>
      {visible.map((c) => (
        <div key={c.id} className="bg-white rounded-2xl border border-ink-100 shadow-soft px-4 py-3 flex items-center gap-3">
          <Link href={`/dashboard/clients/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
            <span className="w-11 h-11 rounded-xl bg-brand-700 text-cream inline-flex items-center justify-center font-bold text-lg shrink-0">
              {c.full_name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-ink-900 truncate group-hover:text-brand-700">{c.full_name}</span>
              <span className="block text-[12.5px] text-ink-500">Last lesson {fmt(c.lastLessonAt)} · {c.daysSince} days ago</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => dismiss(c.id)}
            disabled={pending}
            className="shrink-0 text-[12px] font-medium text-ink-500 hover:text-alert-700 px-2.5 py-1.5 rounded-lg hover:bg-alert-50 transition-colors disabled:opacity-50"
            title="Remove from this list (e.g. a one-off tourist)"
          >
            Don’t show
          </button>
        </div>
      ))}
    </div>
  );
}
