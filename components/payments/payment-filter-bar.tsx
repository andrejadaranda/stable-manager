"use client";

// Filter bar for the payments list — client, date range, method.
// Pushes choices into the URL searchParams so the server page re-queries.

import { useRouter } from "next/navigation";

type ClientOpt = { id: string; full_name: string };
type Method = "cash" | "card" | "transfer" | "other";

export function PaymentFilterBar({
  clients,
  current,
}: {
  clients: ClientOpt[];
  current: { from?: string; to?: string; client?: string; method?: Method };
}) {
  const router = useRouter();

  function apply(next: Partial<{ from: string; to: string; client: string; method: string }>) {
    const p = new URLSearchParams();
    const from = next.from ?? current.from;
    const to = next.to ?? current.to;
    const client = next.client ?? current.client;
    const method = next.method ?? current.method;
    // Empty string = explicit clear.
    if (next.from === "") { /* cleared */ } else if (from) p.set("from", from);
    if (next.to === "") { /* cleared */ } else if (to) p.set("to", to);
    if (next.client === "") { /* cleared */ } else if (client) p.set("client", client);
    if (next.method === "") { /* cleared */ } else if (method) p.set("method", method);
    const qs = p.toString();
    router.push(qs ? `/dashboard/payments?${qs}` : "/dashboard/payments");
  }

  const hasAny = current.from || current.to || current.client || current.method;
  const sel = "h-9 rounded-xl border border-ink-200 bg-white px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-ink-500 font-medium">
        Client
        <select
          className={`${sel} min-w-[10rem]`}
          value={current.client ?? ""}
          onChange={(e) => apply({ client: e.target.value })}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-ink-500 font-medium">
        From
        <input type="date" className={sel} value={current.from ?? ""} onChange={(e) => apply({ from: e.target.value })} />
      </label>

      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-ink-500 font-medium">
        To
        <input type="date" className={sel} value={current.to ?? ""} onChange={(e) => apply({ to: e.target.value })} />
      </label>

      <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-ink-500 font-medium">
        Method
        <select className={sel} value={current.method ?? ""} onChange={(e) => apply({ method: e.target.value })}>
          <option value="">Any</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="transfer">Transfer</option>
          <option value="other">Other</option>
        </select>
      </label>

      {hasAny && (
        <button
          type="button"
          onClick={() => router.push("/dashboard/payments")}
          className="h-9 px-3 rounded-xl text-[12px] font-medium text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100/60"
        >
          Clear
        </button>
      )}
    </div>
  );
}
