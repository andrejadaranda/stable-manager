"use server";

// Farrier-visit server actions. The form sends a local "YYYY-MM-DDTHH:mm"
// start + a duration; we convert to ISO here (parsing as local time, not
// UTC) and persist via the farrierVisits service. RLS does the tenant +
// role enforcement; the service double-checks staff role.

import { revalidatePath } from "next/cache";
import { createFarrierVisit, deleteFarrierVisit } from "@/services/farrierVisits";
import { toFriendlyError } from "@/lib/errors/friendly";

export type FarrierActionResult = { ok: boolean; error: string | null };

function localToISO(local: string): string {
  // Parse "YYYY-MM-DDTHH:mm" as LOCAL time, then serialise to ISO/UTC.
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString();
}

export async function createFarrierVisitAction(
  formData: FormData,
): Promise<FarrierActionResult> {
  const startsLocal = String(formData.get("starts_at") ?? "");
  const duration = Number(formData.get("duration") ?? 60);
  const farrierName = String(formData.get("farrier_name") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const horseIds = formData.getAll("horse_ids").map((v) => String(v)).filter(Boolean);

  if (!startsLocal) return { ok: false, error: "Pick a date and time." };
  if (horseIds.length === 0) return { ok: false, error: "Select at least one horse." };

  try {
    const startsISO = localToISO(startsLocal);
    const endsISO = new Date(
      new Date(startsISO).getTime() + Math.max(15, duration) * 60_000,
    ).toISOString();

    await createFarrierVisit({
      starts_at: startsISO,
      ends_at: endsISO,
      farrier_name: farrierName,
      notes,
      horse_ids: horseIds,
    });

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/my-lessons");
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}

export async function deleteFarrierVisitAction(
  formData: FormData,
): Promise<FarrierActionResult> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing visit id." };
  try {
    await deleteFarrierVisit(id);
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/my-lessons");
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err).message };
  }
}
