// Farrier-visit types + constants — safe to import from "use client"
// components (no supabase/server import here). Mirrors the .pure split
// used by guestContributors / weatherAlerts.

export type FarrierVisitHorse = { id: string; name: string };

export type CalendarFarrierVisit = {
  id: string;
  event_type: "farrier_visit";
  starts_at: string;
  ends_at: string;
  farrier_name: string | null;
  notes: string | null;
  status: string;
  horses: FarrierVisitHorse[];
};

// Saddle-brown — visually distinct from lesson events on the calendar.
export const FARRIER_EVENT_COLOR = "#B5793E";
export const FARRIER_EVENT_LABEL = "Farrier";
