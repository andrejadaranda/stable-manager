// Pure types + constants for the sessions module. Safe to import
// from client components — does NOT pull in supabase/server.ts (which
// imports next/headers and breaks client bundles).
//
// services/sessions.ts re-exports these for server-side convenience.

export type SessionType =
  | "flat"
  | "jumping"
  | "lunging"
  | "groundwork"
  | "hack"
  | "other";

export const SESSION_TYPES: SessionType[] = [
  "flat",
  "jumping",
  "lunging",
  "groundwork",
  "hack",
  "other",
];

export type SessionRow = {
  id: string;
  stable_id: string;
  horse_id: string;
  rider_client_id: string | null;
  rider_profile_id: string | null;
  rider_name_freeform: string | null;
  trainer_id: string;
  lesson_id: string | null;
  started_at: string;
  duration_minutes: number;
  type: SessionType;
  notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
};

export type SessionWithLabels = SessionRow & {
  horse:        { id: string; name: string } | null;
  rider_client: { id: string; full_name: string } | null;
  trainer:      { id: string; full_name: string | null } | null;
};
