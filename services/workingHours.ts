// Per-stable working hours + holidays.
//
// Working hours: one row per day-of-week (0=Sunday … 6=Saturday).
// Missing day = stable is closed that day.
// Holidays: specific dates the stable is closed (Christmas, summer).

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type WorkingHour = {
  day_of_week: number;
  open_time:   string;  // HH:MM:SS
  close_time:  string;  // HH:MM:SS
};

export type Holiday = {
  id:          string;
  closed_date: string;  // YYYY-MM-DD
  label:       string | null;
};

export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export async function listWorkingHours(): Promise<WorkingHour[]> {
  const ctx = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stable_working_hours")
    .select("day_of_week, open_time, close_time")
    .eq("stable_id", ctx.stableId)
    .order("day_of_week");
  if (error) throw error;
  return (data ?? []) as WorkingHour[];
}

export async function upsertWorkingHour(
  day_of_week: number,
  open_time:   string,
  close_time:  string,
): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  if (day_of_week < 0 || day_of_week > 6) throw new Error("INVALID_DAY");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stable_working_hours")
    .upsert(
      { stable_id: ctx.stableId, day_of_week, open_time, close_time },
      { onConflict: "stable_id,day_of_week" },
    );
  if (error) throw error;
}

export async function deleteWorkingHour(day_of_week: number): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stable_working_hours")
    .delete()
    .eq("stable_id", ctx.stableId)
    .eq("day_of_week", day_of_week);
  if (error) throw error;
}

export async function listHolidays(): Promise<Holiday[]> {
  const ctx = await getSession();
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stable_holidays")
    .select("id, closed_date, label")
    .eq("stable_id", ctx.stableId)
    .order("closed_date");
  if (error) throw error;
  return (data ?? []) as Holiday[];
}

export async function addHoliday(closed_date: string, label?: string | null): Promise<{ id: string }> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closed_date)) throw new Error("INVALID_DATE");
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("stable_holidays")
    .insert({ stable_id: ctx.stableId, closed_date, label: label ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function removeHoliday(id: string): Promise<void> {
  const ctx = await getSession();
  requireRole(ctx, "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("stable_holidays")
    .delete()
    .eq("id", id)
    .eq("stable_id", ctx.stableId);
  if (error) throw error;
}
