// Client portal — single horse detail.
//
// Two visibility tiers driven by horses.owner_client_id:
//   * OWNER (owner_client_id == me)
//       — Sees: every session on the horse, full notes, edit button.
//       — RLS sessions_read_own_horse_owner widens session reads.
//       — RLS horses_owner_client_update + horses_client_field_lock
//         trigger let them edit bio fields only.
//   * RIDER (rides via lessons, doesn't own)
//       — Sees: bio basics, public_bio, ONLY their own sessions.
//       — Banner explains the privacy boundary so the absence of
//         other-rider rows reads as intentional, not as a bug.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/redirects";
import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EditMyHorseButton } from "@/components/myHorses/edit-my-horse-dialog";
import { NewCareRequestButton } from "@/components/careRequests/new-care-request-button";
import { RequestLessonButton } from "@/components/lessonRequests/request-lesson-button";
import { HorseCareSection } from "@/components/horses/HorseCareSection";
import { getCareVisitsForHorse } from "@/services/farrierVisits";
import { getHorseOutstanding } from "@/services/horseBalance";
import { HorseOutstandingCard } from "@/components/horses/HorseOutstandingCard";
import {
  listCareRequestsForHorse,
  CARE_TYPE_LABEL,
  CARE_TYPE_EMOJI,
  STATUS_LABEL,
  URGENCY_LABEL,
} from "@/services/careRequests";
import { cancelCareRequestAction } from "./care-actions";

export const dynamic = "force-dynamic";

type HorseRow = {
  id: string;
  name: string;
  breed: string | null;
  date_of_birth: string | null;
  notes: string | null;
  public_bio: string | null;
  photo_url: string | null;
  active: boolean;
  owner_client_id: string | null;
};

type SessionRow = {
  id: string;
  started_at: string;
  duration_minutes: number | null;
  type: string | null;
  notes: string | null;
  rating: number | null;
};

// RFC-4122 UUID guard — see /horses/[id]/page.tsx for rationale. Prevents
// "invalid input syntax for type uuid" Postgres errors from junk slugs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MyHorseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePageRole("client");
  const session = await getSession();
  if (!session.clientId) notFound();

  if (!UUID_RE.test(params.id)) notFound();

  const supabase = createSupabaseServerClient();
  const { data: horse, error } = await supabase
    .from("horses")
    .select("id, name, breed, date_of_birth, notes, public_bio, photo_url, active, owner_client_id")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !horse) notFound();
  const h = horse as HorseRow;
  const isOwner = h.owner_client_id === session.clientId;

  // Sessions: owners see all, riders see own only.
  let sessionsQ = supabase
    .from("sessions")
    .select("id, started_at, duration_minutes, type, notes, rating")
    .eq("horse_id", h.id)
    .order("started_at", { ascending: false })
    .limit(20);
  if (!isOwner) sessionsQ = sessionsQ.eq("rider_client_id", session.clientId);
  const { data: sessions } = await sessionsQ;
  const rows = (sessions ?? []) as SessionRow[];
  const totalMinutes = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0);

  // Care requests — only the owner-client sees & creates these.
  const careRequests = isOwner ? await listCareRequestsForHorse(h.id) : [];

  // Farrier/vet visits + costs — owner sees their own horse's debts/notes.
  const careVisits = isOwner ? await getCareVisitsForHorse(h.id).catch(() => []) : [];
  const outstanding = isOwner
    ? await getHorseOutstanding(h.id).catch(() => ({ total_cents: 0, lines: [] }))
    : { total_cents: 0, lines: [] };

  const initial = (h.name?.[0] ?? "?").toUpperCase();
  const age = h.date_of_birth ? ageYears(h.date_of_birth) : null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link
        href="/dashboard/my-horses"
        className="text-sm text-ink-500 hover:text-ink-900 w-fit inline-flex items-center gap-1"
      >
        <span aria-hidden>←</span> My horses
      </Link>

      <header className="bg-white rounded-3xl shadow-soft overflow-hidden">
        <div
          className="h-20 md:h-24 w-full"
          style={{
            background:
              "linear-gradient(135deg, #1E2A47 0%, #2F406A 50%, #5C6B92 100%)",
          }}
          aria-hidden
        />
        <div className="px-6 pb-5 -mt-10">
          <div className="flex items-end gap-4 flex-wrap">
            {h.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={h.photo_url}
                alt={h.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-soft"
              />
            ) : (
              <span
                aria-hidden
                className="w-20 h-20 rounded-2xl shrink-0 inline-flex items-center justify-center bg-brand-500 text-white font-semibold text-3xl shadow-soft ring-4 ring-white"
              >
                {initial}
              </span>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h1
                  className="text-2xl tracking-tight text-ink-900 truncate"
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontWeight: 500,
                  }}
                >
                  {h.name}
                </h1>
                {isOwner && (
                  <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                    Owner
                  </span>
                )}
                {!h.active && (
                  <span className="text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">
                    Inactive
                  </span>
                )}
              </div>
              <p className="text-[13px] text-ink-500 mt-1">
                {[h.breed, age && `${age}y`].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 pb-1">
              <RequestLessonButton
                horses={[{ id: h.id, name: h.name }]}
                presetHorseId={h.id}
                variant="outline"
                label="Request a lesson"
              />
              {isOwner && (
                <EditMyHorseButton
                  horseId={h.id}
                  initialName={h.name}
                  initialBreed={h.breed}
                  initialDob={h.date_of_birth}
                  initialNotes={h.notes}
                  initialPublicBio={h.public_bio}
                />
              )}
            </div>
          </div>

          {/* Public bio — shown to BOTH owner and rider; owner edits via
              the dialog above, rider just reads. */}
          {h.public_bio && (
            <p className="mt-5 text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">
              {h.public_bio}
            </p>
          )}

          {/* Owner-private notes — only the owner sees this. */}
          {isOwner && h.notes && (
            <div className="mt-4 rounded-xl bg-ink-50/60 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">
                Private notes (only you see this)
              </p>
              <p className="text-[12.5px] text-ink-700 whitespace-pre-wrap leading-relaxed">
                {h.notes}
              </p>
            </div>
          )}

          {!isOwner && (
            <div className="mt-5 rounded-xl bg-ink-50/60 px-4 py-3 text-[12px] text-ink-600 leading-relaxed">
              <span className="font-medium text-ink-700">Privacy:</span> You
              see only the sessions and notes from your own rides on this
              horse. Other riders&apos; activity stays private.
            </div>
          )}
        </div>
      </header>

      {isOwner && outstanding.total_cents > 0 && (
        <HorseOutstandingCard outstanding={outstanding} />
      )}

      {isOwner && (
        <section className="bg-white rounded-2xl shadow-soft p-5">
          <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
                Care requests
              </h2>
              <p className="text-[12.5px] text-ink-500 mt-1">
                Ask the stable to arrange farrier, vet, feed, equipment, or transport for {h.name}.
              </p>
            </div>
            <NewCareRequestButton horseId={h.id} horseName={h.name} />
          </div>

          {careRequests.length === 0 ? (
            <p className="text-sm text-ink-500">
              No requests yet. Use the button above next time you need something
              arranged.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {careRequests.map((cr) => {
                const dateStr = new Date(cr.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit", month: "short",
                });
                const tone = STATUS_TONE[cr.status];
                return (
                  <li
                    key={cr.id}
                    className="rounded-xl border border-ink-100 bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
                          <span aria-hidden>{CARE_TYPE_EMOJI[cr.type]}</span>
                          {CARE_TYPE_LABEL[cr.type]}
                          <span className="text-[11px] text-ink-400 font-normal">
                            · {URGENCY_LABEL[cr.urgency]}
                          </span>
                        </p>
                        {cr.notes && (
                          <p className="text-[12.5px] text-ink-700 mt-1 whitespace-pre-wrap">
                            {cr.notes}
                          </p>
                        )}
                        {cr.preferred_date && (
                          <p className="text-[11.5px] text-ink-500 mt-1">
                            Preferred:{" "}
                            {new Date(cr.preferred_date).toLocaleDateString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </p>
                        )}
                        {cr.owner_response && (
                          <div className="mt-2 rounded-md bg-brand-50 px-3 py-2">
                            <p className="text-[10.5px] uppercase tracking-wider font-semibold text-brand-700 mb-0.5">
                              Stable response
                            </p>
                            <p className="text-[12.5px] text-ink-700 whitespace-pre-wrap">
                              {cr.owner_response}
                            </p>
                            {cr.scheduled_for && (
                              <p className="text-[11.5px] text-brand-700 mt-1 font-medium">
                                Scheduled for{" "}
                                {new Date(cr.scheduled_for).toLocaleDateString("en-GB", {
                                  day: "2-digit", month: "short", year: "numeric",
                                })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${tone}`}
                        >
                          {STATUS_LABEL[cr.status]}
                        </span>
                        <span className="text-[11px] text-ink-400">{dateStr}</span>
                        {cr.status === "pending" && (
                          <form action={cancelCareRequestAction}>
                            <input type="hidden" name="request_id" value={cr.id} />
                            <input type="hidden" name="horse_id"   value={h.id} />
                            <button
                              type="submit"
                              className="text-[11px] text-red-600 hover:text-red-800"
                            >
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {isOwner && (
        <HorseCareSection visits={careVisits} horseId={h.id} editable={false} />
      )}

      <section className="bg-white rounded-2xl shadow-soft p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">
            {isOwner ? "All sessions" : "My sessions"} ({rows.length})
          </h2>
          <span className="text-[12px] text-ink-500 tabular-nums">
            {totalMinutes >= 60
              ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
              : `${totalMinutes}m`}{" "}
            total
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">
            No sessions logged yet. As your trainer logs rides, they&apos;ll
            appear here.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((s) => (
              <li key={s.id} className="py-3 flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-900">
                    {new Date(s.started_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {s.type && (
                      <span className="ml-2 text-[10.5px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded bg-ink-100 text-ink-700">
                        {s.type}
                      </span>
                    )}
                  </p>
                  {s.notes && (
                    <p className="text-[12px] text-ink-500 mt-1 line-clamp-2">
                      {s.notes}
                    </p>
                  )}
                </div>
                <p className="text-[12.5px] text-ink-500 tabular-nums shrink-0">
                  {s.duration_minutes ?? 0}m
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  pending:      "bg-amber-50  text-amber-700",
  acknowledged: "bg-sky-50    text-sky-700",
  scheduled:    "bg-brand-50  text-brand-700",
  done:         "bg-emerald-50 text-emerald-700",
  declined:     "bg-ink-100   text-ink-600",
};

function ageYears(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let y = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) y -= 1;
  return Math.max(0, y);
}
