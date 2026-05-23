// Pure types + presentation maps for care_requests.
//
// Why split from services/careRequests.ts: that file imports from
// lib/supabase/server (which imports next/headers) and is therefore
// server-only. Client components ("use client") need the types and
// label maps but cannot pull in the server file — Next refuses to
// bundle next/headers for the browser.
//
// Service file re-exports these so server-side callers can keep
// importing from one place.

export type CareRequestType =
  | "farrier"
  | "vet"
  | "feed"
  | "equipment"
  | "transport"
  | "other";

export type CareRequestUrgency = "low" | "normal" | "high";

export type CareRequestStatus =
  | "pending"
  | "acknowledged"
  | "scheduled"
  | "done"
  | "declined";

export const CARE_TYPE_LABEL: Record<CareRequestType, string> = {
  farrier:   "Farrier",
  vet:       "Vet",
  feed:      "Feed",
  equipment: "Equipment",
  transport: "Transport",
  other:     "Other",
};

export const CARE_TYPE_EMOJI: Record<CareRequestType, string> = {
  farrier:   "🧲",
  vet:       "🩺",
  feed:      "🌾",
  equipment: "🧰",
  transport: "🚛",
  other:     "✉️",
};

export const URGENCY_LABEL: Record<CareRequestUrgency, string> = {
  low:    "Whenever",
  normal: "Soon",
  high:   "Urgent",
};

export const STATUS_LABEL: Record<CareRequestStatus, string> = {
  pending:      "Pending",
  acknowledged: "Acknowledged",
  scheduled:    "Scheduled",
  done:         "Done",
  declined:     "Declined",
};

export type CareRequestRow = {
  id:                   string;
  stable_id:            string;
  horse_id:             string;
  requester_client_id:  string;
  type:                 CareRequestType;
  urgency:              CareRequestUrgency;
  preferred_date:       string | null;
  notes:                string | null;
  status:               CareRequestStatus;
  owner_response:       string | null;
  responded_by:         string | null;
  responded_at:         string | null;
  scheduled_for:        string | null;
  created_at:           string;
  updated_at:           string;
};

export type CareRequestWithContext = CareRequestRow & {
  horse_name:      string;
  requester_name:  string | null;
};
