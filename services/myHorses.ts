// =============================================================
// Client-portal "My horses" service.
//
// Two distinct collections per client:
//   * OWNED   — horses with horses.owner_client_id = mine.
//               Privacy: I see EVERYTHING on this horse (every session,
//               every rider's notes, full health log). I can EDIT
//               basic fields (name, breed, notes, photo).
//   * RIDDEN  — horses I've been a lesson rider on but don't own.
//               Privacy: I see ONLY my own sessions/goals on this horse.
//               The horse's bio basics (name, breed, photo) are visible,
//               but other riders' notes, the stable's pricing, full
//               health log etc are HIDDEN. This service returns the
//               trimmed shape so the page doesn't accidentally leak.
//
// All queries run as the signed-in client and rely on the existing RLS:
//   * sessions_read_own_client          — rider sees own sessions
//   * sessions_read_own_horse_owner     — owner sees all sessions
//   * horses (no SELECT policy by role) — clients see horses joined
//     via lessons OR ownership

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

export type MyHorseSummary = {
  id:           string;
  name:         string;
  breed:        string | null;
  date_of_birth: string | null;
  active:       boolean;
  /** "owner" = full visibility + edit. "rider" = trimmed view. */
  relationship: "owner" | "rider";
  /** Per-relationship roll-up: how many sessions are visible to me
   *  on this horse. Owners get total; riders get their own. */
  sessions_visible:  number;
  /** Optional last activity date (ISO) — most recent session_at I can see. */
  last_session_at:   string | null;
};

/**
 * Returns the union of owned + ridden horses for the calling client.
 * One row per horse — when a client both owns and rides the same horse,
 * `relationship = "owner"` wins (broader visibility).
 */
export async function listMyHorses(): Promise<MyHorseSummary[]> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const supabase = createSupabaseServerClient();

  // OWNED horses — direct lookup. RLS lets the client see horses where
  // owner_client_id = themselves via the existing horses_read policy.
  const ownedRes = await supabase
    .from("horses")
    .select("id, name, breed, date_of_birth, active")
    .eq("owner_client_id", session.clientId);

  if (ownedRes.error) throw ownedRes.error;
  const ownedRows = (ownedRes.data ?? []) as Array<{
    id: string; name: string; breed: string | null;
    date_of_birth: string | null; active: boolean;
  }>;
  const ownedIds = new Set(ownedRows.map((h) => h.id));

  // RIDDEN horses — distinct horse_id from lessons.client_id = me where
  // horse_id IS NOT NULL. We can include past + upcoming; visibility on
  // the horse row itself is RLS-narrowed.
  const lessonsRes = await supabase
    .from("lessons")
    .select("horse_id, horse:horses(id, name, breed, date_of_birth, active)")
    .eq("client_id", session.clientId)
    .not("horse_id", "is", null);

  if (lessonsRes.error) throw lessonsRes.error;
  // Supabase types FK joins as arrays even when the relationship is 1:1;
  // cast through `unknown` then collapse the array case to the first row.
  type LessonRow = {
    horse_id: string;
    horse:
      | { id: string; name: string; breed: string | null; date_of_birth: string | null; active: boolean }
      | { id: string; name: string; breed: string | null; date_of_birth: string | null; active: boolean }[]
      | null;
  };
  const riddenById = new Map<string, MyHorseSummary>();
  for (const r of ((lessonsRes.data ?? []) as unknown) as LessonRow[]) {
    const horse = Array.isArray(r.horse) ? (r.horse[0] ?? null) : r.horse;
    if (!horse || ownedIds.has(r.horse_id)) continue;  // owner row wins
    if (riddenById.has(r.horse_id)) continue;
    riddenById.set(r.horse_id, {
      id:                horse.id,
      name:              horse.name,
      breed:             horse.breed,
      date_of_birth:     horse.date_of_birth,
      active:            horse.active,
      relationship:      "rider",
      sessions_visible:  0,
      last_session_at:   null,
    });
  }

  // Per-horse session counts. Owner counts EVERY session on the horse
  // (RLS already widens that view). Rider counts only their own.
  const horseIds = [
    ...ownedRows.map((h) => h.id),
    ...Array.from(riddenById.keys()),
  ];
  const sessionsByHorse = new Map<string, { count: number; last: string | null }>();
  if (horseIds.length > 0) {
    const sessionsRes = await supabase
      .from("sessions")
      .select("horse_id, started_at, rider_client_id")
      .in("horse_id", horseIds)
      .order("started_at", { ascending: false });
    if (sessionsRes.error) throw sessionsRes.error;
    for (const s of (sessionsRes.data ?? []) as Array<{
      horse_id: string; started_at: string; rider_client_id: string | null;
    }>) {
      // For riders, only count rows where they were the rider (RLS
      // already filters to those, but defence-in-depth).
      const isOwned = ownedIds.has(s.horse_id);
      if (!isOwned && s.rider_client_id !== session.clientId) continue;
      const prev = sessionsByHorse.get(s.horse_id);
      sessionsByHorse.set(s.horse_id, {
        count: (prev?.count ?? 0) + 1,
        last:  prev?.last ?? s.started_at,  // sorted desc, first wins
      });
    }
  }

  const owned: MyHorseSummary[] = ownedRows.map((h) => {
    const stats = sessionsByHorse.get(h.id);
    return {
      id:               h.id,
      name:             h.name,
      breed:            h.breed,
      date_of_birth:    h.date_of_birth,
      active:           h.active,
      relationship:     "owner",
      sessions_visible: stats?.count ?? 0,
      last_session_at:  stats?.last ?? null,
    };
  });

  const ridden = Array.from(riddenById.values()).map((h) => {
    const stats = sessionsByHorse.get(h.id);
    return {
      ...h,
      sessions_visible: stats?.count ?? 0,
      last_session_at:  stats?.last ?? null,
    };
  });

  // Owned first (more important to the client), then ridden alpha by name.
  ridden.sort((a, b) => a.name.localeCompare(b.name));
  return [...owned, ...ridden];
}

// =============================================================
// Horse-owner client EDIT — only the bio fields, never workload caps
// or active toggle. The DB trigger horses_client_field_lock rejects
// anything else; this service mirrors that contract at the type level
// so the caller can't pass extra props.
// =============================================================
export type EditMyHorseInput = {
  name?:           string;
  breed?:          string | null;
  date_of_birth?:  string | null;  // YYYY-MM-DD
  notes?:          string | null;
  public_bio?:     string | null;
  photo_url?:      string | null;
};

export async function updateMyHorse(
  horseId: string,
  input: EditMyHorseInput,
): Promise<void> {
  const session = await getSession();
  if (session.role !== "client") throw new Error("FORBIDDEN");
  if (!session.clientId) throw new Error("CLIENT_NOT_LINKED");

  const update: Record<string, unknown> = {};
  if (input.name           !== undefined) {
    const trimmed = (input.name ?? "").trim();
    if (!trimmed)         throw new Error("HORSE_NAME_REQUIRED");
    if (trimmed.length > 60) throw new Error("HORSE_NAME_TOO_LONG");
    update.name = trimmed;
  }
  if (input.breed          !== undefined) update.breed          = nullIfEmpty(input.breed);
  if (input.date_of_birth  !== undefined) update.date_of_birth  = input.date_of_birth || null;
  if (input.notes          !== undefined) update.notes          = nullIfEmpty(input.notes);
  if (input.public_bio     !== undefined) update.public_bio     = nullIfEmpty(input.public_bio);
  if (input.photo_url      !== undefined) update.photo_url      = nullIfEmpty(input.photo_url);

  if (Object.keys(update).length === 0) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horses")
    .update(update)
    .eq("id", horseId)
    .eq("owner_client_id", session.clientId);  // belt + braces vs RLS

  if (error) throw error;
}

function nullIfEmpty(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}
