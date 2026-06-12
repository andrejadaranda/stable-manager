// Pure types + presentation maps for lesson_requests.
// See careRequests.types.ts for the same pattern + rationale.

export type LessonRequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "countered";

export type LessonRequestRow = {
  id:                     string;
  stable_id:              string;
  requester_client_id:    string;
  horse_id:               string | null;
  preferred_trainer_id:   string | null;
  requested_start:        string;
  proposed_start:         string | null;
  requested_duration_min: number;
  notes:                  string | null;
  status:                 LessonRequestStatus;
  accepted_lesson_id:     string | null;
  decline_reason:         string | null;
  responded_by:           string | null;
  responded_at:           string | null;
  created_at:             string;
  updated_at:             string;
};

export type LessonRequestWithContext = LessonRequestRow & {
  horse_name:             string | null;
  preferred_trainer_name: string | null;
  requester_name:         string | null;
};

export const LESSON_STATUS_LABEL: Record<LessonRequestStatus, string> = {
  pending:   "Pending",
  accepted:  "Accepted",
  declined:  "Declined",
  cancelled: "Cancelled",
  countered: "New time proposed",
};
