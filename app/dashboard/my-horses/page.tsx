// Client portal — "My horses" list.
//
// Two sections:
//   * Horses I own  — full visibility, edit available on detail page
//   * Horses I ride — own-data-only privacy (other riders' sessions
//                     and notes are hidden by RLS, this UI just labels
//                     it so the client understands the boundary)

import Link from "next/link";
import { requirePageRole } from "@/lib/auth/redirects";
import { listMyHorses, type MyHorseSummary } from "@/services/myHorses";

export const dynamic = "force-dynamic";

export default async function MyHorsesPage() {
  await requirePageRole("client");
  const horses = await listMyHorses();

  const owned  = horses.filter((h) => h.relationship === "owner");
  const ridden = horses.filter((h) => h.relationship === "rider");

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <header>
        <h1
          className="text-3xl tracking-tight text-ink-900"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
        >
          My horses
        </h1>
        <p className="text-sm text-ink-500 mt-1">
          The horses you own, and the ones you ride at the stable.
        </p>
      </header>

      {owned.length === 0 && ridden.length === 0 && (
        <section className="card-elevated p-8 text-center">
          <p className="text-sm text-ink-600">
            You don&apos;t have any horses linked yet. Once your trainer books
            a lesson with you and assigns a horse — it&apos;ll show up here.
          </p>
        </section>
      )}

      {owned.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
            Horses I own ({owned.length})
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {owned.map((h) => <HorseCard key={h.id} horse={h} />)}
          </ul>
        </section>
      )}

      {ridden.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
            Horses I ride ({ridden.length})
          </h2>
          <p className="text-[12px] text-ink-500 -mt-1">
            You see your own sessions, lessons, and goals on these horses.
            Other riders&apos; activity is private — that&apos;s by design.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ridden.map((h) => <HorseCard key={h.id} horse={h} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function HorseCard({ horse }: { horse: MyHorseSummary }) {
  const initial = (horse.name?.[0] ?? "?").toUpperCase();
  const age = horse.date_of_birth ? ageYears(horse.date_of_birth) : null;
  return (
    <li>
      <Link
        href={`/dashboard/my-horses/${horse.id}`}
        className="
          group flex items-center gap-4 p-4 rounded-2xl bg-white shadow-soft
          hover:shadow-lift transition-shadow
        "
      >
        <span
          aria-hidden
          className="w-14 h-14 rounded-2xl shrink-0 inline-flex items-center justify-center bg-brand-500 text-white font-semibold text-xl shadow-soft"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p
              className="text-base text-ink-900 truncate"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 500 }}
            >
              {horse.name}
            </p>
            {horse.relationship === "owner" && (
              <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                Owner
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-ink-500 mt-0.5 truncate">
            {[horse.breed, age && `${age}y`].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="text-[11.5px] text-ink-500 mt-1">
            {horse.sessions_visible} {horse.sessions_visible === 1 ? "session" : "sessions"}
            {horse.last_session_at && (
              <> · last {new Date(horse.last_session_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</>
            )}
          </p>
        </div>
        <span className="text-ink-400 group-hover:text-brand-700 transition-colors text-lg" aria-hidden>
          →
        </span>
      </Link>
    </li>
  );
}

function ageYears(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y -= 1;
  return Math.max(0, y);
}
