// Pure types + constants for the horse health module. Safe to import
// from client components — does NOT pull in supabase/server.ts.

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
  occurred_on: string;
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
  vaccination: { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
  farrier:     { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
  vet:         { status: HealthSummaryStatus; next_due_on: string | null; last_occurred_on: string | null };
  active_injury: { occurred_on: string; title: string } | null;
};
