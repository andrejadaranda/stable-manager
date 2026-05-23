// Stable picker — public, lists every stable that accepts join requests.
// User picks one → redirected to /signup/join/[slug] to submit application.

import Link from "next/link";
import { listPublicStablesForJoin } from "@/services/joinRequests";

export const dynamic = "force-dynamic";

export default async function JoinStablePickerPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const all = await listPublicStablesForJoin().catch(() => []);
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const matches = q
    ? all.filter((s) => s.name.toLowerCase().includes(q) || s.slug.includes(q))
    : all;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tightest text-ink-900">
          Find your stable
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          Apply to an existing Longrein stable. The stable owner will review
          and confirm.
        </p>
      </header>

      <form className="flex gap-2" action="/signup/join" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by stable name…"
          className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 text-white px-4 text-sm font-medium hover:bg-neutral-800"
        >
          Search
        </button>
      </form>

      {matches.length === 0 ? (
        <p className="text-sm text-ink-500 bg-ink-50/60 rounded-md px-3 py-3">
          {q
            ? `No stable matches "${q}". Try a different search, or ask your stable for a direct invite link.`
            : "No stables are accepting applications yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((s) => (
            <li key={s.id}>
              <Link
                href={`/signup/join/${s.slug}`}
                className="
                  block rounded-xl border border-ink-200 bg-white
                  px-4 py-3 hover:bg-ink-50/60 transition-colors group
                "
              >
                <p className="font-medium text-navy-900">{s.name}</p>
                <p className="text-[11.5px] text-ink-500 mt-0.5">
                  longrein.eu/signup/join/<span className="font-mono">{s.slug}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-ink-600 pt-5 border-t border-ink-100">
        <Link href="/signup" className="font-medium text-brand-700 hover:text-brand-800">
          ← Back to signup options
        </Link>
      </p>
    </div>
  );
}
