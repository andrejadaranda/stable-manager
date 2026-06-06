// Farrier visits — schedulable calendar appointments with multiple horses.
// Table + RLS in migration 66_farrier_visits.sql. RLS exposes a visit to a
// horse-owner client when one of the attached horses is theirs, so the same
// list query powers both the stable calendar and the owner's /my-lessons.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";
import type { CalendarFarrierVisit } from "./farrierVisits.pure";

export type { CalendarFarrierVisit, FarrierVisitHorse } from "./farrierVisits.pure";

/**
 * Farrier visits overlapping the [from, to) window, with attached horses.
 * Works for staff and owner-clients alike — RLS narrows the rows.
 */
export async function getFarrierVisitsForCalendar(
  from: string,
  to: string,
): Promise<CalendarFarrierVisit[]> {
  await getSession();
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("farrier_visits")
    .select(
      `
      id, starts_at, ends_at, farrier_name, notes, status,
      farrier_visit_horses (
        horse:horses!farrier_visit_horses_horse_id_fkey ( id, name )
      )
      `,
    )
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((v: any): CalendarFarrierVisit => ({
    id: v.id,
    event_type: "farrier_visit",
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    farrier_name: v.farrier_name ?? null,
    notes: v.notes ?? null,
    status: v.status,
    horses: (v.farrier_visit_horses ?? [])
      .map((r: any) => r.horse)
      .filter(Boolean)
      .map((h: any) => ({ id: h.id, name: h.name })),
  }));
}

/** Create a farrier visit and attach the horses being shod. Staff only. */
export async function createFarrierVisit(input: {
  starts_at: string;
  ends_at: string;
  farrier_name?: string | null;
  notes?: string | null;
  horse_ids: string[];
}): Promise<{ id: string }> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("farrier_visits")
    .insert({
      stable_id: session.stableId,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      farrier_name: input.farrier_name?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const visitId = (data as any).id as string;
  const horseIds = Array.from(new Set(input.horse_ids)).filter(Boolean);
  if (horseIds.length > 0) {
    const rows = horseIds.map((horse_id) => ({ visit_id: visitId, horse_id }));
    const { error: jerr } = await supabase.from("farrier_visit_horses").insert(rows);
    if (jerr) throw jerr;
  }
  return { id: visitId };
}

/** Delete a farrier visit (junction rows cascade). Staff only. */
export async function deleteFarrierVisit(id: string): Promise<void> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("farrier_visits").delete().eq("id", id);
  if (error) throw error;
}
