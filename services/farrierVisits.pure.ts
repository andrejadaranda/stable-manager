// Care-visit (farrier / vet) types + constants — safe to import from
// "use client" components (no supabase/server import here). Mirrors the
// .pure split used by guestContributors / weatherAlerts.
//
// NOTE: table + service keep the historical "farrierVisits" name; the
// `kind` column (migration 67) extends the same machinery to vet visits.

export type CareVisitKind = "farrier" | "vet";

export type FarrierVisitHorse = {
  id: string;
  name: string;
  /** What this horse's owner owes for the work on this horse (cents). */
  cost_cents: number | null;
  /** What the farrier/vet said about this specific horse. */
  note: string | null;
  /** ISO timestamp when this horse's charge was marked paid; null = unpaid. */
  paid_at: string | null;
};

/** Per-horse input when creating/editing a visit. */
export type FarrierHorseInput = {
  horse_id: string;
  cost_cents?: number | null;
  note?: string | null;
};

/** One care visit as seen on a single horse's dashboard. */
export type HorseCareVisit = {
  id: string;
  kind: CareVisitKind;
  starts_at: string;
  farrier_name: string | null;
  cost_cents: number | null;
  note: string | null;
  paid_at: string | null;
};

export type CalendarFarrierVisit = {
  id: string;
  event_type: "farrier_visit";
  kind: CareVisitKind;
  starts_at: string;
  ends_at: string;
  farrier_name: string | null;
  notes: string | null;
  status: string;
  /** What the stable paid the farrier/vet for the whole visit (cents). */
  expense_cents: number | null;
  horses: FarrierVisitHorse[];
};

export const VISIT_KIND_LABEL: Record<CareVisitKind, string> = {
  farrier: "Farrier",
  vet: "Vet",
};

// Stripe colors — farrier saddle-brown, vet sky-blue. Distinct from the
// lesson palette so both read at a glance on the calendar.
export const VISIT_KIND_COLOR: Record<CareVisitKind, string> = {
  farrier: "#B5793E",
  vet: "#0369A1",
};

// Kept for backwards compatibility with earlier imports.
export const FARRIER_EVENT_COLOR = VISIT_KIND_COLOR.farrier;
export const FARRIER_EVENT_LABEL = VISIT_KIND_LABEL.farrier;
