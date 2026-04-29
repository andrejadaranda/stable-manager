/**
 * Maps known internal error codes / Postgres SQLSTATE to user-facing
 * messages. Service layer throws short canonical strings (e.g. "FORBIDDEN",
 * "HORSE_DOUBLE_BOOKED"); this module translates them to friendly copy
 * before they reach the UI.
 *
 * If we don't recognize the error, we fall back to a generic message and
 * log the original — never leak raw Supabase / Postgres strings to the UI.
 */

const MAP: Record<string, string> = {
  // Service-layer canonical errors
  UNAUTHENTICATED:           "Please sign in again.",
  FORBIDDEN:                 "Your role doesn't allow this action.",
  USER_HAS_NO_STABLE:        "Your account isn't linked to a stable yet.",
  CLIENT_NOT_LINKED:         "This account's client record isn't linked to the portal yet.",
  HORSE_DOUBLE_BOOKED:       "This horse already has another lesson at that time.",
  HORSE_OR_TRAINER_DOUBLE_BOOKED: "The horse or trainer is already booked at that time.",
  INVALID_TIME_RANGE:        "Lesson end must be after the start.",
  INVALID_AMOUNT:            "Amount must be greater than zero.",
  INVALID_PACKAGE_SIZE:      "A package must include at least one lesson.",
  INVALID_EXPIRY:            "Expiry date must be after the purchase date.",
  PACKAGE_NOT_FOUND:         "That package no longer exists.",
  PACKAGE_WRONG_CLIENT:      "That package belongs to a different client.",
  PACKAGE_EXPIRED:           "That package has expired.",
  PACKAGE_EXHAUSTED:         "That package has no remaining lessons.",
  SERVICE_NAME_REQUIRED:     "Service name is required.",
  SERVICE_NAME_TOO_LONG:     "Service name is too long (max. 80 characters).",
  SERVICE_NAME_DUPLICATE:    "A service with that name already exists.",
  INVALID_DURATION:          "Duration must be between 5 and 600 minutes.",
  HORSE_NOT_FOUND:           "Horse not found.",
  HORSE_HAS_NO_OWNER:        "Set an owner on the horse before creating a boarding charge.",
  HORSE_OVER_DAILY_LIMIT:    "This horse has already reached its daily lesson limit. Add a reason to override.",
  HORSE_OVER_WEEKLY_LIMIT:   "This horse has already reached its weekly lesson limit. Add a reason to override.",
  REMINDER_EMPTY:            "Reminder text cannot be empty.",
  REMINDER_TOO_LONG:         "Reminder is too long (max. 500 characters).",
  AGREEMENT_LABEL_REQUIRED:  "Add a name for the custom document.",
  AGREEMENT_DUPLICATE:       "This document type is already on file for this client.",
  CHARGE_LABEL_REQUIRED:     "Add a name for the custom charge.",
  INVALID_RECURRENCE_COUNT:  "Pick at least 1 occurrence.",
  RECURRENCE_TOO_LONG:       "Series is capped at 52 occurrences.",
  CHARGE_NOT_FOUND:          "Boarding charge not found.",
  INVALID_PERIOD:            "Invalid period — use YYYY-MM.",
  STABLE_NAME_TOO_SHORT:     "Stable name is too short (min. 2 characters).",
  STABLE_NAME_TOO_LONG:      "Stable name is too long (max. 80 characters).",
  FULL_NAME_REQUIRED:        "Name is required.",
  FULL_NAME_TOO_LONG:        "Name is too long (max. 80 characters).",

  // Postgres SQLSTATE
  "23505": "That record already exists.",                                  // unique_violation
  "23503": "A related record doesn't exist or was deleted.",               // fk_violation
  "23514": "The values don't pass validation — please check the form.",    // check_violation
  "23P01": "The horse or trainer is already booked at that time.",         // exclusion_violation
  "42501": "Your role doesn't allow this action.",                         // insufficient_privilege
  PGRST116: "Record not found, or it belongs to a different stable.",      // PostgREST not found
};

const GENERIC = "Something went wrong. Please try again in a moment.";

export type FriendlyError = {
  message: string;
  code: string;
};

/**
 * Convert any thrown value into a stable {message, code} pair.
 * Keep the message *short* — it's rendered as a toast or inline error.
 */
export function toFriendlyError(err: unknown): FriendlyError {
  if (err instanceof Error) {
    const known = MAP[err.message];
    if (known) return { message: known, code: err.message };
  }
  // Supabase errors come back as { code, message, details, hint } objects.
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string; message?: string };
    if (e.code && MAP[e.code]) return { message: MAP[e.code], code: e.code };
  }
  if (typeof err === "string" && MAP[err]) return { message: MAP[err], code: err };
  // Final fallback — no leak.
  return { message: GENERIC, code: "UNKNOWN" };
}

/** Convenience wrapper for server actions. */
export async function safeRun<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const f = toFriendlyError(err);
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[safeRun]", f.code, err);
    }
    return { ok: false, error: f.message };
  }
}
