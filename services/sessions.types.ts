// Pure types + constants for the sessions module. Safe to import
// from client components — does NOT pull in supabase/server.ts (which
// imports next/headers and breaks client bundles).
//
// services/sessions.ts re-exports these for server-side convenience.

export type SessionType =
  | "flat"
  | "dressage"
  | "jumping"
  | "cross_country"
  | "lunging"
  | "groundwork"
  | "hack"
  | "western"
  | "vaulting"
  | "rehab"
  | "other";

export const SESSION_TYPES: SessionType[] = [
  "flat",
  "dressage",
  "jumping",
  "cross_country",
  "lunging",
  "groundwork",
  "hack",
  "western",
  "vaulting",
  "rehab",
  "other",
];

/** Display labels for session types — keep in sync with SESSION_TYPES. */
export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  flat:          "Flat",
  dressage:      "Dressage",
  jumping:       "Jumping",
  cross_country: "Cross-country",
  lunging:       "Lunging",
  groundwork:    "Groundwork",
  hack:          "Hack / trail",
  western:       "Western",
  vaulting:      "Vaulting",
  rehab:         "Rehab / recovery",
  other:         "Other",
};

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
