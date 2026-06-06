// Care-visit (farrier / vet) types + constants — safe to import from
// "use client" components (no supabase/server import here). Mirrors the
// .pure split used by guestContributors / weatherAlerts.
//
// NOTE: table + service keep the historical "farrierVisits" name; the
// `kind` column (migration 67) extends the same machinery to vet visits.

export type CareVisitKind = "farrier" | "vet";

export type FarrierVisitHorse = { id: string; name: string };

export type CalendarFarrierVisit = {
  id: string;
  event_type: "farrier_visit";
  kind: CareVisitKind;
  starts_at: string;
  ends_at: string;
  farrier_name: string | null;
  notes: string | null;
  status: string;
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
