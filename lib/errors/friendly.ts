/**
 * Maps known internal error codes / Postgres SQLSTATE to LT user-facing
 * messages. Service layer throws short canonical strings (e.g. "FORBIDDEN",
 * "HORSE_DOUBLE_BOOKED"); this module translates them to friendly copy
 * before they reach the UI.
 *
 * If we don't recognize the error, we fall back to a generic message and
 * log the original — never leak raw Supabase / Postgres strings to the UI.
 */

const MAP: Record<string, string> = {
  // Service-layer canonical errors
  UNAUTHENTICATED:           "Reikia prisijungti iš naujo.",
  FORBIDDEN:                 "Jūsų rolė neleidžia atlikti šio veiksmo.",
  USER_HAS_NO_STABLE:        "Jūsų paskyra dar nėra susieta su jokia arklide.",
  CLIENT_NOT_LINKED:         "Šios paskyros klientas dar nesusietas su portalu.",
  HORSE_DOUBLE_BOOKED:       "Šis arklys tuo pačiu metu turi kitą pamoką.",
  HORSE_OR_TRAINER_DOUBLE_BOOKED: "Arklys arba treneris jau užimti šiuo laiku.",
  INVALID_TIME_RANGE:        "Pamokos pabaiga turi būti vėliau nei pradžia.",
  INVALID_AMOUNT:            "Suma turi būti didesnė už nulį.",
  STABLE_NAME_TOO_SHORT:     "Arklidės pavadinimas per trumpas (min. 2 simboliai).",
  STABLE_NAME_TOO_LONG:      "Arklidės pavadinimas per ilgas (maks. 80 simbolių).",
  FULL_NAME_REQUIRED:        "Vardas privalomas.",
  FULL_NAME_TOO_LONG:        "Vardas per ilgas (maks. 80 simbolių).",

  // Postgres SQLSTATE
  "23505": "Toks įrašas jau egzistuoja.",                         // unique_violation
  "23503": "Susijęs įrašas neegzistuoja arba jau ištrintas.",     // fk_violation
  "23514": "Įvestos reikšmės netinka — patikrinkite formą.",      // check_violation
  "23P01": "Arklys arba treneris jau užimti šiuo laiku.",         // exclusion_violation
  "42501": "Jūsų rolė neleidžia atlikti šio veiksmo.",            // insufficient_privilege
  PGRST116: "Įrašas nerastas arba jis priklauso kitai arklidei.", // PostgREST not found
};

const GENERIC = "Įvyko nelaukta klaida. Bandykite dar kartą po akimirkos.";

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
