"use server";

// CSV import for clients + horses. Each row goes through the existing
// service-layer create function so all validations / RLS / triggers
// fire — same as if the user typed the row by hand.

import { revalidatePath } from "next/cache";
import { createClient, type SkillLevel } from "@/services/clients";
import { createHorse } from "@/services/horses";
import { fromCsv } from "@/lib/utils/csv";
import { toFriendlyError } from "@/lib/errors/friendly";
import { getSession, requireRole } from "@/lib/auth/session";

export type ImportState = {
  error: string | null;
  /** Rows successfully inserted. */
  inserted: number | null;
  /** Rows skipped — usually validation errors or duplicates. */
  skipped: number | null;
  /** Up to 5 sample errors so the user can see what to fix. */
  errors: string[] | null;
};

const initial: ImportState = {
  error:    null,
  inserted: null,
  skipped:  null,
  errors:   null,
};

const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "pro"];

function normaliseHeaders(rows: Array<Record<string, string>>) {
  return rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k.toLowerCase().trim().replace(/\s+/g, "_")] = v;
    }
    return out;
  });
}

// =============================================================
// Clients
// =============================================================
export async function importClientsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await getSession();
  try {
    requireRole(session, "owner");
  } catch {
    return { ...initial, error: "Owner only." };
  }

  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) return { ...initial, error: "Paste a CSV first." };

  let rows: Array<Record<string, string>>;
  try {
    rows = normaliseHeaders(fromCsv(csv));
  } catch {
    return { ...initial, error: "Couldn't parse the CSV." };
  }
  if (rows.length === 0) {
    return { ...initial, error: "No rows found." };
  }

  let inserted = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    const fullName = (row.full_name || row.name || "").trim();
    if (!fullName) {
      errors.push(`Row ${i + 2}: missing full_name`);
      continue;
    }
    const email = (row.email || "").trim();
    if (email && !email.includes("@")) {
      errors.push(`Row ${i + 2}: invalid email`);
      continue;
    }
    const skillRaw = (row.skill_level || row.skill || "").toLowerCase().trim();
    let skillLevel: SkillLevel | undefined;
    if (skillRaw) {
      if (!SKILL_LEVELS.includes(skillRaw as SkillLevel)) {
        errors.push(`Row ${i + 2}: invalid skill_level "${skillRaw}"`);
        continue;
      }
      skillLevel = skillRaw as SkillLevel;
    }
    const priceRaw = (row.default_lesson_price || row.price || "").trim();
    let price: number | undefined;
    if (priceRaw) {
      const n = Number(priceRaw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        errors.push(`Row ${i + 2}: invalid price "${priceRaw}"`);
        continue;
      }
      price = n;
    }

    try {
      await createClient({
        fullName,
        email: email || undefined,
        phone: (row.phone || "").trim() || undefined,
        skillLevel,
        notes: (row.notes || "").trim() || undefined,
        active: true,
      });
      inserted += 1;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${toFriendlyError(err).message}`);
    }
  }

  if (inserted > 0) revalidatePath("/dashboard/clients");

  return {
    error:    null,
    inserted,
    skipped:  rows.length - inserted,
    errors:   errors.slice(0, 5),
  };
}

// =============================================================
// Horses
// =============================================================
export async function importHorsesAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await getSession();
  try {
    requireRole(session, "owner");
  } catch {
    return { ...initial, error: "Owner only." };
  }

  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) return { ...initial, error: "Paste a CSV first." };

  let rows: Array<Record<string, string>>;
  try {
    rows = normaliseHeaders(fromCsv(csv));
  } catch {
    return { ...initial, error: "Couldn't parse the CSV." };
  }
  if (rows.length === 0) {
    return { ...initial, error: "No rows found." };
  }

  let inserted = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    const name = (row.name || "").trim();
    if (!name) {
      errors.push(`Row ${i + 2}: missing name`);
      continue;
    }

    const dailyRaw  = (row.daily_lesson_limit  || row.daily  || "").trim();
    const weeklyRaw = (row.weekly_lesson_limit || row.weekly || "").trim();
    const dob       = (row.date_of_birth        || row.dob    || "").trim();

    let daily:  number | undefined;
    let weekly: number | undefined;
    if (dailyRaw) {
      const n = Number.parseInt(dailyRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        errors.push(`Row ${i + 2}: invalid daily_lesson_limit`);
        continue;
      }
      daily = n;
    }
    if (weeklyRaw) {
      const n = Number.parseInt(weeklyRaw, 10);
      if (!Number.isFinite(n) || n < 0) {
        errors.push(`Row ${i + 2}: invalid weekly_lesson_limit`);
        continue;
      }
      weekly = n;
    }

    try {
      await createHorse({
        name,
        breed:             (row.breed || "").trim() || undefined,
        dateOfBirth:       dob || undefined,
        dailyLessonLimit:  daily,
        weeklyLessonLimit: weekly,
        notes:             (row.notes || "").trim() || undefined,
        active:            true,
      });
      inserted += 1;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${toFriendlyError(err).message}`);
    }
  }

  if (inserted > 0) revalidatePath("/dashboard/horses");

  return {
    error:    null,
    inserted,
    skipped:  rows.length - inserted,
    errors:   errors.slice(0, 5),
  };
}
