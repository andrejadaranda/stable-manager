// Pure types + constants for workingHours.
// Safe to import from client components — does NOT pull in supabase/server.
//
// services/workingHours.ts re-exports these for server callers.

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

export const DAY_LABELS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
