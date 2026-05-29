// Reports — operational summaries owners need monthly.
//
// trainerMonthly:   per-trainer hours + lesson count + revenue (payroll input).
// horseUtilization: per-horse lesson count + minutes + idle/over flag.
//
// Both functions take a YYYY-MM period and read straight from `lessons`.
// Lessons with status = scheduled and completed are counted; cancelled
// + no_show are excluded.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type TrainerMonthlyRow = {
  trainer_id:   string | null;
  trainer_name: string;
  lessons:      number;
  minutes:      number;
  hours:        number;       // minutes / 60, two decimals
  revenue:      number;       // sum of price for those lessons
};

export type HorseUtilizationRow = {
  horse_id:   string;
  horse_name: string;
  lessons:    number;
  minutes:    number;
  hours:      number;
  last_used:  string | null;
  daily_avg:  number;
  status:     "under" | "ok" | "over" | "idle";
};

function periodRange(period: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  const [y, m] = period.split("-").map((s) => Number(s));
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
  const end   = new Date(Date.UTC(y, m,     0, 23, 59, 59)).toISOString();
  return { start, end };
}

function durationMinutes(starts: string, ends: string): number {
  return Math.max(0, Math.round((new Date(ends).getTime() - new Date(starts).getTime()) / 60000));
}

export async function trainerMonthly(period: string): Promise<TrainerMonthlyRow[]> {
  const session = await getSession();
  requireRole(session, "owner");
  const r = periodRange(period);
  if (!r) throw new Error("INVALID_PERIOD");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("trainer_id, starts_at, ends_at, price, status, trainer:profiles!lessons_trainer_id_fkey(id, full_name)")
    .gte("starts_at", r.start)
    .lte("starts_at", r.end)
    .in("status", ["scheduled", "completed"]);
  if (error) throw error;

  const map = new Map<string, TrainerMonthlyRow>();
  for (const rowRaw of data ?? []) {
    const row = rowRaw as unknown as {
      trainer_id: string | null;
      starts_at: string;
      ends_at: string;
      price: number | null;
      // PostgREST can return the embed as either an object or a single-
      // element array depending on the FK shape; normalise here.
      trainer: { id: string; full_name: string | null } | Array<{ id: string; full_name: string | null }> | null;
    };
    const trainerObj = Array.isArray(row.trainer) ? row.trainer[0] ?? null : row.trainer;
    const key = row.trainer_id ?? "(unassigned)";
    const cur = map.get(key) ?? {
      trainer_id:   row.trainer_id,
      trainer_name: trainerObj?.full_name ?? "(unassigned)",
      lessons: 0, minutes: 0, hours: 0, revenue: 0,
    };
    cur.lessons += 1;
    cur.minutes += durationMinutes(row.starts_at, row.ends_at);
    cur.revenue += Number(row.price ?? 0);
    map.set(key, cur);
  }

  return Array.from(map.values())
    .map((t) => ({ ...t, hours: Math.round((t.minutes / 60) * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);
}

export async function horseUtilization(period: string): Promise<HorseUtilizationRow[]> {
  const session = await getSession();
  requireRole(session, "owner");
  const r = periodRange(period);
  if (!r) throw new Error("INVALID_PERIOD");

  const supabase = createSupabaseServerClient();

  const [horsesRes, lessonsRes] = await Promise.all([
    supabase.from("horses").select("id, name").eq("active", true).order("name"),
    supabase.from("lessons")
      .select("horse_id, starts_at, ends_at, status")
      .gte("starts_at", r.start)
      .lte("starts_at", r.end)
      .in("status", ["scheduled", "completed"]),
  ]);
  if (horsesRes.error)  throw horsesRes.error;
  if (lessonsRes.error) throw lessonsRes.error;

  const periodDays =
    (new Date(r.end).getTime() - new Date(r.start).getTime()) / 86400000;

  const counts = new Map<string, { lessons: number; minutes: number; last_used: string | null }>();
  for (const lRaw of lessonsRes.data ?? []) {
    const l = lRaw as { horse_id: string | null; starts_at: string; ends_at: string };
    if (!l.horse_id) continue;
    const cur = counts.get(l.horse_id) ?? { lessons: 0, minutes: 0, last_used: null };
    cur.lessons += 1;
    cur.minutes += durationMinutes(l.starts_at, l.ends_at);
    if (!cur.last_used || l.starts_at > cur.last_used) cur.last_used = l.starts_at;
    counts.set(l.horse_id, cur);
  }

  return (horsesRes.data ?? []).map((hRaw) => {
    const h = hRaw as { id: string; name: string };
    const c = counts.get(h.id) ?? { lessons: 0, minutes: 0, last_used: null };
    const dailyAvg = c.lessons / Math.max(1, periodDays);
    // Thresholds tuned for a typical riding school:
    // < 0.3 lessons/day = under-used, > 3.5/day = over-used, 0 = idle.
    const status: HorseUtilizationRow["status"] =
      c.lessons === 0   ? "idle"  :
      dailyAvg  < 0.3   ? "under" :
      dailyAvg  > 3.5   ? "over"  :
                          "ok";
    return {
      horse_id:   h.id,
      horse_name: h.name,
      lessons:    c.lessons,
      minutes:    c.minutes,
      hours:      Math.round((c.minutes / 60) * 100) / 100,
      last_used:  c.last_used,
      daily_avg:  Math.round(dailyAvg * 100) / 100,
      status,
    };
  }).sort((a, b) => b.lessons - a.lessons);
}
