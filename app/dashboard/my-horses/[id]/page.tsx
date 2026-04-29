// Client portal — public horse view.
//
// A rider lands here from /dashboard/my-lessons by tapping the horse
// name on their assigned lesson card. They see the photo, the name,
// and the owner-curated public bio — nothing else. The goal: a young
// rider arriving at the stable can recognise the horse from the photo
// without asking the trainer.
//
// RLS gates this hard: horses_read_via_own_lesson (07_calendar_policies)
// limits the SELECT to horses tied to the caller's own lessons. Even
// if someone guesses an id outside their roster, the row returns null.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getHorsePublicView } from "@/services/horses";

export const dynamic = "force-dynamic";

export default async function MyHorseProfile({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRole("client");

  const horse = await getHorsePublicView(params.id);
  if (!horse) notFound();

  const initial = horse.name[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <Link
        href="/dashboard/my-lessons"
        className="text-[12px] text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 w-fit"
      >
        ← My lessons
      </Link>

      <div className="bg-white rounded-2xl shadow-soft p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
        {horse.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={horse.photo_url}
            alt={horse.name}
            className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover ring-1 ring-white"
          />
        ) : (
          <div
            className="w-32 h-32 md:w-40 md:h-40 rounded-2xl flex items-center justify-center"
            style={{ background: "#F5DDCB" }}
            aria-hidden
          >
            <span
              className="text-5xl text-brand-700 font-display"
              style={{ fontFamily: "Fraunces, Georgia, serif", fontWeight: 500 }}
            >
              {initial}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl text-navy-900 leading-none">
            {horse.name}
          </h1>
          {horse.breed && (
            <p className="text-[12px] uppercase tracking-[0.14em] text-ink-500 mt-2">
              {horse.breed}
            </p>
          )}
        </div>
      </div>

      {horse.public_bio ? (
        <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6">
          <h2 className="text-sm font-semibold text-navy-900 mb-2">
            About {horse.name}
          </h2>
          <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
            {horse.public_bio}
          </p>
        </section>
      ) : (
        <section className="bg-white rounded-2xl shadow-soft p-5 md:p-6 text-center">
          <p className="text-sm text-ink-500">
            No description yet. Ask your trainer to introduce you.
          </p>
        </section>
      )}
    </div>
  );
}
