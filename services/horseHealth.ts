// Horse health & care service — staff CRUD on horse_health_records.
// RLS handles tenant isolation; service layer adds role gates and
// shapes the data for the Health tab UI.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession, requireRole } from "@/lib/auth/session";

export type HealthRecordKind = "vaccination" | "farrier" | "vet" | "injury";

export const HEALTH_RECORD_KINDS: HealthRecordKind[] = [
  "vaccination",
  "farrier",
  "vet",
  "injury",
];

export type HealthRecord = {
  id: string;
  stable_id: string;
  horse_id: string;
  kind: HealthRecordKind;
  occurred_on: string;        // YYYY-MM-DD
  next_due_on: string | null;
  resolved_on: string | null;
  title: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthSummaryStatus = "ok" | "due_soon" | "overdue" | "none";

export type HealthSummary = {
  /** "ok" / "due_soon" / "overdue" status per recurring kind. */
  vaccination: { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
  farrier:     { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
  vet:         { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
  /** Currently-open injury, if any. */
  active_injury: { occurred_on: string; title: string } | null;
};

const DUE_SOON_DAYS = 30;

function daysFromToday(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function statusForDue(nextDue: string | null): HealthSummaryStatus {
  if (!nextDue) return "none";
  const d = daysFromToday(nextDue);
  if (d < 0)              return "overdue";
  if (d <= DUE_SOON_DAYS) return "due_soon";
  return "ok";
}

// ---------- list ------------------------------------------------

export async function listHealthRecords(horseId: string): Promise<HealthRecord[]> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_health_records")
    .select("*")
    .eq("horse_id", horseId)
    .order("occurred_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HealthRecord[];
}

// ---------- summary --------------------------------------------

export async function getHealthSummary(horseId: string): Promise<HealthSummary> {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_health_records")
    .select("kind, occurred_on, next_due_on, resolved_on, title")
    .eq("horse_id", horseId)
    .order("occurred_on", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    kind: HealthRecordKind;
    occurred_on: string;
    next_due_on: string | null;
    resolved_on: string | null;
    title: string;
  }>;

  function summarize(kind: "vaccination" | "farrier" | "vet") {
    const ofKind = rows.filter((r) => r.kind === kind);
    const lastOccurred = ofKind[0]?.occurred_on ?? null;
    // Pick the earliest UPCOMING due date across this kind's records.
    const nextDue = ofKind
      .map((r) => r.next_due_on)
      .filter((d): d is string => d != null)
      .sort()[0] ?? null;
    return {
      status: statusForDue(nextDue),
      next_due_on: nextDue,
      last_occurred_on: lastOccurred,
    };
  }

  const activeInjury = rows.find(
    (r) => r.kind === "injury" && r.resolved_on == null,
  );

  return {
    vaccination: summarize("vaccination"),
    farrier:     summarize("farrier"),
    vet:         summarize("vet"),
    active_injury: activeInjury
      ? { occurred_on: activeInjury.occurred_on, title: activeInjury.title }
      : null,
  };
}

// ---------- create ---------------------------------------------

export type CreateHealthRecordInput = {
  horseId: string;
  kind: HealthRecordKind;
  occurredOn: string;        // YYYY-MM-DD
  nextDueOn?: string | null;
  resolvedOn?: string | null;
  title: string;
  notes?: string | null;
};

export async function createHealthRecord(input: CreateHealthRecordInput): Promise<HealthRecord> {
  const session = await getSession();
  requireRole(session, "owner", "employee");
  if (!input.title?.trim()) throw new Error("INVALID_TITLE");

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("horse_health_records")
    .insert({
      stable_id:   session.stableId,
      horse_id:    input.horseId,
      kind:        input.kind,
      occurred_on: input.occurredOn,
      next_due_on: input.kind === "injury"  ? null : (input.nextDueOn ?? null),
      resolved_on: input.kind === "injury"  ? (input.resolvedOn ?? null) : null,
      title:       input.title.trim(),
      notes:       input.notes?.trim() || null,
      created_by:  session.userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as HealthRecord;
}

// ---------- update ---------------------------------------------

export type UpdateHealthRecordInput = {
  kind?: HealthRecordKind;
  occurredOn?: string;
  nextDueOn?: string | null;
  resolvedOn?: string | null;
  title?: string;
  notes?: string | null;
};

export async function updateHealthRecord(id: string, input: UpdateHealthRecordInput) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (input.kind        !== undefined) update.kind        = input.kind;
  if (input.occurredOn  !== undefined) update.occurred_on = input.occurredOn;
  if (input.nextDueOn   !== undefined) update.next_due_on = input.nextDueOn;
  if (input.resolvedOn  !== undefined) update.resolved_on = input.resolvedOn;
  if (input.title       !== undefined) update.title       = input.title.trim();
  if (input.notes       !== undefined) update.notes       = input.notes?.trim() || null;

  const { data, error } = await supabase
    .from("horse_health_records")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- delete ---------------------------------------------

export async function deleteHealthRecord(id: string) {
  const session = await getSession();
  requireRole(session, "owner", "employee");

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("horse_health_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
